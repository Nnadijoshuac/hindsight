// Server-side settings. Secrets come from the repo-root .env (loaded in next.config.ts).
export const VAULT_ACCOUNT = process.env.VAULT_ACCOUNT ?? 'hindsight-dev.testnet';
export const PRIVATE_MODEL = 'deepseek-ai/DeepSeek-V4.1-Flash-1017';
