# Feasibility check: 2026-10-29

Each risky dependency was tested live from this repo's code.

| # | Question | Result | How to reproduce |
|---|---|---|---|
| 1 | Can we verify NEAR AI's private-inference (TEE) proof from code? | ✅ **Yes.** Gateway and model reports both pass: Intel DCAP quote signature, TCB `UpToDate`, not debug mode, nonce + signer bound in report data, nonce echoed, MRCONFIGID matches app_compose, RTMR3 event-log replay. NVIDIA GPU evidence present. **No API key needed for attestation.** | `npm run check:attest` |
| 2 | Can we get a NEAR Intents quote without spending? | ✅ **Yes (public).** `dry: true` quotes work with no key: 10 USDC (NEAR) → 9.9957 USDC (Base) ~22s; 25 USDC → 5.7754 NEAR ~20s. | `npm run check:quote -- 10 USDC:near USDC:base` |
| 2b | …and a **confidential** quote? | ✅ **Yes, with a 1Click partner key** (free, partners.near-intents.org). Without one the API returns 401. With `ONECLICK_JWT` set: `confidentiality=basic` quote, 10 USDC (NEAR) → 9.9957 USDC (Base), no funds moved. | same command with `ONECLICK_JWT` set |
| 1b | Can we prove a model's *answer* came from that TEE? | ✅ **Yes.** `provider_tee` signature recovered via EIP-191 matches the pre-verified model signer, and the signed text equals `model:sha256(request):sha256(response)` over our exact bytes. | `npm run check:chat` |
| 3 | Can an on-chain contract enforce the agent's spending limits? | ✅ Vault contract with allowlist / auto-limit / daily cap / kill switch / owner approval: 8 unit tests. **Deployed to testnet** at [`hindsight-dev.testnet`](https://testnet.nearblocks.io/address/hindsight-dev.testnet); `get_policy` returns the configured $100 daily cap / $40 auto-limit. Agent is a separate account, `hindsight-agent.testnet`. Live guardrail test: the agent requested $25 to `unknown-merchant.testnet` (memo "URGENT invoice, pay now") and the contract held it as Pending, "payee not on allowlist" (tx `5wUq7FFNEJufX5ezXvH1XvmaWh8TLbiQwgcLH2pUKQtN`). | `npm run test:contract` |
| 4 | Is there a private model to run forecasts on? | ✅ NEAR-hosted TEE models in the public catalog include `deepseek-ai/DeepSeek-V4.1-Flash-1017` ($0.30/$1.20 per M tokens, 1M ctx), `z-ai/glm-5.3-flash`, `Qwen/Qwen3.8-27B`, plus **`openai/privacy-filter`** (PII stripping). Completions need a NEAR AI Cloud API key. | `curl https://cloud-api.near.ai/v1/models` |

## Gotchas found
- **1Click validates accounts:** `refundTo` / `recipient` must be real accounts or addresses; made-up names return "Internal server error" or "recipient is not valid".
- **Attestation uses canonical model IDs** with `x-no-aliasing: true`; `zai-org/GLM-5.3-Flash` is rejected, while `z-ai/glm-5.3-flash` is the catalog ID.
- **Response signatures:** to bind a completion to the TEE, keep exact request and response bytes, then fetch `/v1/signature/{chat_id}` and match `signature_kind: provider_tee` to the pre-verified model signer (docs: response-signatures). Planned for the forecast step.
- **No Intents testnet** (organizer FAQ Q-007): use `dry: true` and tiny mainnet amounts from a separate dev account.

## Setup needed for the live demo
1. ~~NEAR AI Cloud API key~~: done 2026-10-29 (key `hindsight-dev`, $10 limit)
2. ~~1Click partner key~~: done 2026-10-29 (org "Hindsight", key label `hindsight-dev`)
3. ~~Testnet account~~: `hindsight-dev.testnet`, vault deployed 2026-10-29. Still to do: a separate agent account, and a small mainnet dev account for the recorded Intents demo
