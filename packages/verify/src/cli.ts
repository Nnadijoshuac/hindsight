import { verifyModel } from './index.ts';

const model = process.argv[2] ?? 'deepseek-ai/DeepSeek-V4.1-Flash-1017';
const r = await verifyModel(model, process.env.NEAR_AI_CLOUD_API_KEY);

const line = (label: string, c: { ok: boolean; tcbStatus?: string; signer: string; checks: Record<string, boolean>; error?: string }) => {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${label}  signer=${c.signer}  tcb=${c.tcbStatus ?? '-'}`);
  for (const [k, v] of Object.entries(c.checks)) console.log(`        ${v ? '✓' : '✗'} ${k}`);
  if (c.error) console.log(`        error: ${c.error}`);
};

console.log(`Model: ${r.model}\nNonce: ${r.nonce}`);
line('gateway', r.gateway);
r.models.forEach((m, i) => line(`model[${i}]`, m));
console.log(`GPU evidence present: ${r.hasGpuEvidence}`);
console.log(r.ok ? 'RESULT: TEE attestation verified' : 'RESULT: NOT verified');
process.exit(r.ok ? 0 : 1);
