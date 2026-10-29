import { privateChat } from './inference.ts';

const key = process.env.NEAR_AI_CLOUD_API_KEY;
if (!key) {
  console.error('Set NEAR_AI_CLOUD_API_KEY in .env');
  process.exit(1);
}
const model = process.argv[2] ?? 'deepseek-ai/DeepSeek-V4.1-Flash-1017';
const r = await privateChat(model, [{ role: 'user', content: 'In one sentence: why should a freelancer track their cash runway?' }], key);
console.log(`Model reply: ${r.content.trim()}`);
console.log(`Signature: ${r.signatureKind ?? '-'} signer=${r.signer || '-'}`);
console.log(r.verified ? 'RESULT: response signed by the attested TEE' : `RESULT: NOT verified (${r.reason})`);
process.exit(r.verified ? 0 : 1);
