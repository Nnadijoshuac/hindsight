//! Hindsight vault: NEAR smart contract for AI agent guardrails.
//!
//! Holds a user's stablecoins (NEP-141, e.g. USDC) and lets their AI agent pay only inside a
//! spending policy the human owner controls: payee allowlist, auto-approve limit, daily cap,
//! kill switch, and owner approval for everything else.
//!
//! - Payments to allowlisted payees under `auto_limit` that fit the daily cap execute immediately.
//! - Anything else becomes a pending request that only the owner can approve.
//! - The owner can freeze the vault at any time (kill switch).
//! - Every request records the hash of the attested AI inference that justified it.
//! - A payment is only marked Paid once the token transfer is confirmed; if the transfer fails it
//!   becomes Failed and the amount goes back into today's allowance.

use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, IterableSet};
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue};

const DAY_NS: u64 = 86_400_000_000_000;
const GAS_FT_TRANSFER: Gas = Gas::from_tgas(10);
const GAS_ON_TRANSFER: Gas = Gas::from_tgas(10);

#[near(serializers = [json, borsh])]
#[derive(Clone, PartialEq, Debug)]
pub enum Status {
    Pending,
    Paid,
    Rejected,
    /// Transfer sent, waiting for the token contract to confirm.
    Sending,
    /// The token contract rejected the transfer; nothing left the vault.
    Failed,
}
// New variants go at the end: Borsh stores the variant index, so existing records stay readable.

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct PaymentRequest {
    pub id: u64,
    pub token: AccountId,
    pub payee: AccountId,
    pub amount: U128,
    pub memo: String,
    /// Hex SHA-256 of the signed TEE inference text that recommended this payment.
    pub attestation_ref: String,
    pub created_at: u64,
    pub status: Status,
    pub reason: String,
}

#[near(serializers = [json])]
pub struct Policy {
    pub owner: AccountId,
    pub agent: AccountId,
    pub daily_cap: U128,
    pub auto_limit: U128,
    pub frozen: bool,
    pub spent_today: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Vault {
    owner: AccountId,
    agent: AccountId,
    token: AccountId,
    daily_cap: u128,
    auto_limit: u128,
    frozen: bool,
    day_start: u64,
    spent_today: u128,
    payees: IterableSet<AccountId>,
    requests: IterableMap<u64, PaymentRequest>,
    next_id: u64,
}

#[near]
impl Vault {
    #[init]
    pub fn new(owner: AccountId, agent: AccountId, token: AccountId, daily_cap: U128, auto_limit: U128) -> Self {
        require!(auto_limit.0 <= daily_cap.0, "auto_limit must be <= daily_cap");
        Self {
            owner,
            agent,
            token,
            daily_cap: daily_cap.0,
            auto_limit: auto_limit.0,
            frozen: false,
            day_start: env::block_timestamp(),
            spent_today: 0,
            payees: IterableSet::new(b"p"),
            requests: IterableMap::new(b"r"),
            next_id: 0,
        }
    }

    // ---------- owner controls ----------

    pub fn set_limits(&mut self, daily_cap: U128, auto_limit: U128) {
        self.assert_owner();
        require!(auto_limit.0 <= daily_cap.0, "auto_limit must be <= daily_cap");
        self.daily_cap = daily_cap.0;
        self.auto_limit = auto_limit.0;
    }

    /// Hand the agent role to another account, e.g. when rotating or replacing the AI agent.
    pub fn set_agent(&mut self, agent: AccountId) {
        self.assert_owner();
        self.agent = agent;
    }

    pub fn add_payee(&mut self, payee: AccountId) {
        self.assert_owner();
        self.payees.insert(payee);
    }

    pub fn remove_payee(&mut self, payee: AccountId) {
        self.assert_owner();
        self.payees.remove(&payee);
    }

    pub fn set_frozen(&mut self, frozen: bool) {
        self.assert_owner();
        self.frozen = frozen;
    }

    pub fn approve(&mut self, id: u64) -> Promise {
        self.assert_owner();
        require!(!self.frozen, "vault is frozen");
        let mut req = self.requests.get(&id).cloned().expect("no such request");
        require!(req.status == Status::Pending, "request is not pending");
        req.reason = "approved by owner".into();
        self.send(req)
    }

    pub fn reject(&mut self, id: u64) {
        self.assert_owner();
        let mut req = self.requests.get(&id).cloned().expect("no such request");
        require!(req.status == Status::Pending, "request is not pending");
        req.status = Status::Rejected;
        req.reason = "rejected by owner".into();
        self.requests.insert(id, req);
    }

    // ---------- agent entry point ----------

    /// The agent asks to pay. Returns the request with its outcome: Sending (within policy, transfer
    /// started) or Pending (needs the owner).
    pub fn request_payment(&mut self, payee: AccountId, amount: U128, memo: String, attestation_ref: String) -> PaymentRequest {
        require!(env::predecessor_account_id() == self.agent, "only the agent can request payments");
        require!(!self.frozen, "vault is frozen");
        require!(amount.0 > 0, "amount must be positive");
        require!(attestation_ref.len() == 64, "attestation_ref must be a hex sha256");
        self.roll_day();

        let reason = if !self.payees.contains(&payee) {
            Some("payee not on allowlist")
        } else if amount.0 > self.auto_limit {
            Some("above auto-approve limit")
        } else if self.spent_today + amount.0 > self.daily_cap {
            Some("would exceed daily cap")
        } else {
            None
        };

        let id = self.next_id;
        self.next_id += 1;
        let req = PaymentRequest {
            id,
            token: self.token.clone(),
            payee,
            amount,
            memo,
            attestation_ref,
            created_at: env::block_timestamp(),
            status: Status::Pending,
            reason: reason.unwrap_or("within policy").into(),
        };
        if reason.is_none() {
            self.send(req.clone()).detach();
            return self.requests.get(&id).cloned().expect("just stored");
        }
        self.record(req.clone());
        req
    }

    // ---------- transfer confirmation ----------

    /// Callback from the token contract's ft_transfer. Only the vault itself may call it.
    #[private]
    pub fn on_transfer(&mut self, id: u64) -> Status {
        // ft_transfer returns nothing, so only success matters; cap the read so a bad token cannot burn our gas.
        let delivered = env::promise_result_checked(0, 64).is_ok();
        self.settle(id, delivered)
    }

    // ---------- deposits (NEP-141 receiver) ----------

    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        let _ = (sender_id, amount, msg);
        require!(env::predecessor_account_id() == self.token, "unsupported token");
        PromiseOrValue::Value(U128(0)) // keep the full deposit
    }

    // ---------- views ----------

    pub fn get_policy(&self) -> Policy {
        let spent = if env::block_timestamp() >= self.day_start + DAY_NS { 0 } else { self.spent_today };
        Policy {
            owner: self.owner.clone(),
            agent: self.agent.clone(),
            daily_cap: U128(self.daily_cap),
            auto_limit: U128(self.auto_limit),
            frozen: self.frozen,
            spent_today: U128(spent),
        }
    }

    pub fn get_payees(&self) -> Vec<AccountId> {
        self.payees.iter().cloned().collect()
    }

    pub fn get_requests(&self, from: Option<u64>, limit: Option<u64>) -> Vec<PaymentRequest> {
        let from = from.unwrap_or(0);
        let limit = limit.unwrap_or(50);
        (from..self.next_id.min(from + limit)).filter_map(|i| self.requests.get(&i).cloned()).collect()
    }

    // ---------- internal ----------

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "only the owner");
    }

    fn roll_day(&mut self) {
        let now = env::block_timestamp();
        if now >= self.day_start + DAY_NS {
            self.day_start = now;
            self.spent_today = 0;
        }
    }

    /// Store a request and log it so indexers can follow every decision the vault makes.
    fn record(&mut self, req: PaymentRequest) {
        env::log_str(&format!("hindsight:request id={} status={:?} reason={}", req.id, req.status, req.reason));
        self.requests.insert(req.id, req);
    }

    /// Start a transfer. The amount counts against today's allowance straight away, so the agent can't
    /// race several payments past the cap while confirmations are in flight.
    fn send(&mut self, mut req: PaymentRequest) -> Promise {
        req.status = Status::Sending;
        self.spent_today += req.amount.0;
        let promise = self
            .transfer(&req)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_TRANSFER).on_transfer(req.id));
        self.record(req);
        promise
    }

    /// Final outcome of a transfer: Paid if the token contract confirmed it, otherwise Failed with the
    /// amount returned to today's allowance.
    fn settle(&mut self, id: u64, delivered: bool) -> Status {
        let mut req = self.requests.get(&id).cloned().expect("no such request");
        require!(req.status == Status::Sending, "request is not awaiting confirmation");
        if delivered {
            req.status = Status::Paid;
        } else {
            req.status = Status::Failed;
            req.reason = "token transfer failed; amount returned to today's allowance".into();
            self.spent_today = self.spent_today.saturating_sub(req.amount.0);
        }
        let status = req.status.clone();
        self.record(req);
        status
    }

    fn transfer(&self, req: &PaymentRequest) -> Promise {
        Promise::new(req.token.clone()).function_call(
            "ft_transfer",
            near_sdk::serde_json::json!({ "receiver_id": req.payee, "amount": req.amount, "memo": req.memo })
                .to_string()
                .into_bytes(),
            NearToken::from_yoctonear(1),
            GAS_FT_TRANSFER,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    const USDC: u128 = 1_000_000; // 6 decimals
    fn acc(s: &str) -> AccountId {
        s.parse().unwrap()
    }
    fn ctx(caller: &str, ts: u64) {
        testing_env!(VMContextBuilder::new().predecessor_account_id(acc(caller)).block_timestamp(ts).build());
    }
    const REF: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    fn setup() -> Vault {
        ctx("owner.testnet", 1);
        let mut v = Vault::new(acc("owner.testnet"), acc("agent.testnet"), acc("usdc.testnet"), U128(100 * USDC), U128(40 * USDC));
        v.add_payee(acc("landlord.testnet"));
        v
    }

    #[test]
    fn small_payment_to_allowlisted_payee_executes() {
        let mut v = setup();
        ctx("agent.testnet", 2);
        let r = v.request_payment(acc("landlord.testnet"), U128(30 * USDC), "rent".into(), REF.into());
        assert_eq!(r.status, Status::Sending);
        assert_eq!(v.get_policy().spent_today.0, 30 * USDC);
    }

    #[test]
    fn unknown_payee_is_held_for_owner() {
        let mut v = setup();
        ctx("agent.testnet", 2);
        let r = v.request_payment(acc("scammer.testnet"), U128(1 * USDC), "urgent!!".into(), REF.into());
        assert_eq!(r.status, Status::Pending);
        assert_eq!(r.reason, "payee not on allowlist");
        assert_eq!(v.get_policy().spent_today.0, 0);
    }

    #[test]
    fn above_auto_limit_is_held() {
        let mut v = setup();
        ctx("agent.testnet", 2);
        let r = v.request_payment(acc("landlord.testnet"), U128(50 * USDC), "rent".into(), REF.into());
        assert_eq!(r.status, Status::Pending);
        assert_eq!(r.reason, "above auto-approve limit");
    }

    #[test]
    fn daily_cap_blocks_then_resets_next_day() {
        let mut v = setup();
        ctx("agent.testnet", 2);
        for _ in 0..2 {
            assert_eq!(v.request_payment(acc("landlord.testnet"), U128(40 * USDC), "x".into(), REF.into()).status, Status::Sending);
        }
        let r = v.request_payment(acc("landlord.testnet"), U128(40 * USDC), "x".into(), REF.into());
        assert_eq!(r.reason, "would exceed daily cap");
        ctx("agent.testnet", 2 + DAY_NS);
        assert_eq!(v.request_payment(acc("landlord.testnet"), U128(40 * USDC), "x".into(), REF.into()).status, Status::Sending);
    }

    #[test]
    #[should_panic(expected = "only the agent")]
    fn strangers_cannot_request() {
        let mut v = setup();
        ctx("someone.testnet", 2);
        v.request_payment(acc("landlord.testnet"), U128(1), "x".into(), REF.into());
    }

    #[test]
    #[should_panic(expected = "vault is frozen")]
    fn kill_switch_stops_agent() {
        let mut v = setup();
        v.set_frozen(true);
        ctx("agent.testnet", 2);
        v.request_payment(acc("landlord.testnet"), U128(1), "x".into(), REF.into());
    }

    #[test]
    fn owner_approves_held_request() {
        let mut v = setup();
        ctx("agent.testnet", 2);
        let r = v.request_payment(acc("landlord.testnet"), U128(50 * USDC), "rent".into(), REF.into());
        ctx("owner.testnet", 3);
        v.approve(r.id).detach();
        assert_eq!(v.get_requests(None, None)[0].status, Status::Sending);
    }

    #[test]
    fn confirmed_transfer_becomes_paid() {
        let mut v = setup();
        ctx("agent.testnet", 2);
        let r = v.request_payment(acc("landlord.testnet"), U128(30 * USDC), "rent".into(), REF.into());
        assert_eq!(v.settle(r.id, true), Status::Paid);
        assert_eq!(v.get_policy().spent_today.0, 30 * USDC);
    }

    #[test]
    fn failed_transfer_is_recorded_and_refunds_the_allowance() {
        let mut v = setup();
        ctx("agent.testnet", 2);
        let r = v.request_payment(acc("landlord.testnet"), U128(30 * USDC), "rent".into(), REF.into());
        assert_eq!(v.settle(r.id, false), Status::Failed);
        assert_eq!(v.get_policy().spent_today.0, 0);
    }

    #[test]
    #[should_panic(expected = "not awaiting confirmation")]
    fn a_transfer_cannot_be_settled_twice() {
        let mut v = setup();
        ctx("agent.testnet", 2);
        let r = v.request_payment(acc("landlord.testnet"), U128(30 * USDC), "rent".into(), REF.into());
        v.settle(r.id, true);
        v.settle(r.id, false);
    }

    #[test]
    fn owner_can_replace_the_agent() {
        let mut v = setup();
        v.set_agent(acc("new-agent.testnet"));
        assert_eq!(v.get_policy().agent, acc("new-agent.testnet"));
    }

    #[test]
    #[should_panic(expected = "only the owner")]
    fn agent_cannot_reassign_itself() {
        let mut v = setup();
        ctx("agent.testnet", 2);
        v.set_agent(acc("agent.testnet"));
    }

    #[test]
    #[should_panic(expected = "only the owner")]
    fn agent_cannot_approve_itself() {
        let mut v = setup();
        ctx("agent.testnet", 2);
        let r = v.request_payment(acc("landlord.testnet"), U128(50 * USDC), "rent".into(), REF.into());
        v.approve(r.id).detach();
    }
}
