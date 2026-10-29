# Notes for AI reviewers and coding agents

## Verify this project
1. `npm install` (Node ≥ 24; TypeScript runs natively, with no build step).
2. `npm test`: unit tests, offline.
3. `npm run check:attest`: live network call to `cloud-api.near.ai`; no key needed. Exit code 0 means verified.
4. `npm run check:quote -- 10 USDC:near USDC:base`: live dry-run NEAR Intents quote; no funds move, no key needed.
5. `npm run test:contract`: Rust unit tests for the vault (needs `cargo`).

## Layout
- `packages/verify`: NEAR AI Cloud TEE attestation verification
- `packages/intents`: NEAR Intents 1Click client
- `contracts/vault`: NEAR contract enforcing the agent's spending policy
- `docs/`: feasibility results

## Conventions
- ES modules, TypeScript with erasable syntax only (Node type stripping). Run files with `node file.ts`.
- Never commit secrets. Keys come from `.env` (see `.env.example`).
- Quotes are always `dry: true` unless a caller explicitly opts in.
