# Hindsight

**Foresight from your own hindsight.** A private money forecaster for people with irregular income. The more history you give it, the more accurate it gets, and nobody can read your data. We prove that with hardware attestation, not a privacy policy.

> Built for NEAR HACKATHON (Nov 2026). Tracks: **Privacy & Private AI · Real-World Money · AI Security & Defense**.
> Status: 🚧 feasibility stage. See [docs/FEASIBILITY.md](docs/FEASIBILITY.md).

## What it does
1. **Forecasts your cashflow** (rent, bills, runway) from bank CSV exports and wallet history.
2. **Gets better with more data.** We show forecast error on held-back months falling as history grows.
3. **Keeps your data private.** It runs only inside NEAR AI's confidential hardware (TEE), after the app verifies an Intel TDX + NVIDIA attestation.
4. **Acts within your limits.** An agent can move stablecoins across chains via NEAR Intents, but only through a vault contract with your allowlist, limits, daily cap and off switch.

## Try it (do X → see Y)
Requirements: Node ≥ 24, Rust via rustup (the toolchain is pinned in `rust-toolchain.toml` and installs automatically). No API keys needed for steps 1–4.
On Windows, run the contract tests with `AWS_LC_SYS_PREBUILT_NASM=1` set (avoids needing the NASM assembler).

```bash
npm install
```

| Step | Command | Expected result |
|---|---|---|
| 0 | `npm start`, then open http://localhost:3000 | Builds and serves the Next.js app. A laptop-sized app screen shows Ada's 45-day forecast (likely range, safety buffer, labelled pay days and bills), then a live proof strip, an animated 36-month history grid, the live TEE attestation checklist, the vault policy read from NEAR testnet, and a confidential NEAR Intents quote |
| 1 | `npm run check:attest` | Gateway + model reports each list 7 ✓ checks; ends with `RESULT: TEE attestation verified` |
| 1b | `npm run check:chat` *(needs `NEAR_AI_CLOUD_API_KEY`)* | A short model reply, then `RESULT: response signed by the attested TEE`: the answer is bound to our exact request and response bytes and signed by the verified hardware key |
| 2 | `npm run check:quote -- 10 USDC:near USDC:base` | `DRY RUN (no funds move)` and a quote like `10 USDC:near -> 9.99 USDC:base` |
| 3 | `npm run forecast` | Error chart falling from ~42% (3 months of history) to ~30% (24 months), averaged over 8 simulated freelancers, then a 45-day balance projection with a rent check |
| 3b | `npm test` | 15 passing tests (attestation math, signature recovery, quote building, forecaster incl. "more history → lower error") |
| 4 | `npm run test:contract` | 8 passing vault tests: allowlist, auto-limit, daily cap, kill switch, owner-only approval |

## How it works
```
 your CSV / wallets ──► PII filter (TEE) ──► forecaster (TEE model) ──► forecast + recommended action
                              ▲                      ▲                            │
                     attestation verified    attestation verified                 ▼
                      before data is sent    + signed response          vault.request_payment()
                                                                  (allowlist · auto-limit · daily cap)
                                                                               │
                                                                               ▼
                                                                NEAR Intents (1Click) cross-chain move
```

| NEAR tech | Where |
|---|---|
| Web app: Next.js 16 (App Router, route handlers), Tailwind CSS 4, shadcn/ui, React Bits (CountUp, FadeContent), Motion | [packages/web](packages/web) |
| NEAR AI Cloud TEE inference + attestation | [packages/verify/src/index.ts](packages/verify/src/index.ts) |
| NEAR Intents 1Click API (dry-run / confidential quotes) | [packages/intents/src/index.ts](packages/intents/src/index.ts) |
| NEAR smart contract (spending policy vault), live on testnet at `hindsight-dev.testnet` | [contracts/vault/src/lib.rs](contracts/vault/src/lib.rs) |

## Feature → code map
| Claim | Code | Test |
|---|---|---|
| Verifies TEE quote, nonce, signer, config, event log | `checkNearReport` in packages/verify/src/index.ts | packages/verify/test/verify.test.ts |
| Quotes are dry-run by default | `buildQuoteRequest` in packages/intents/src/index.ts | packages/intents/test/intents.test.ts |
| Agent can't pay unknown payees / over limits / when frozen | `request_payment` in contracts/vault/src/lib.rs | `cargo test` (8 tests) |

## What works / what's next
| | |
|---|---|
| ✅ Works | Live attestation verification, private TEE inference with verified response signatures, live dry-run + confidential quotes, forecaster with backtest, vault policy logic + tests, vault deployed on testnet |
| 🔜 Next | Separate agent account + live guardrail demo, PII filter pass, AI categorisation and alerts, CSV upload in the web app |

## Libraries & AI assistance
`@phala/dcap-qvl` (Intel DCAP quote verification), `@noble/curves` (EIP-191 signer recovery), `near-sdk` (Rust); web: Next.js 16, Tailwind CSS, shadcn/ui, React Bits, Motion, Geist fonts. Parts of this code were written with Claude Code.

## License
MIT. See [LICENSE](LICENSE).
