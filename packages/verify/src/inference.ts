// @hindsight/verify: private, verifiable inference on NEAR AI Cloud.
// Verifies the TEE before sending data, then proves the reply came from that TEE by checking the
// provider_tee response signature (EIP-191) over SHA-256 of the exact request and response bytes.
// Spec: https://docs.near.ai/cloud/verification/cloud-api/response-signatures.md
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { NEAR_AI_BASE, sha256hex, verifyModel } from './index.ts';

/** Recover the Ethereum address that produced an EIP-191 personal_sign signature over `text`. */
export function recoverEip191(text: string, signatureHex: string): string {
  const msg = Buffer.from(text, 'utf8');
  const prefixed = Buffer.concat([Buffer.from(`\x19Ethereum Signed Message:\n${msg.length}`, 'utf8'), msg]);
  const sig = Buffer.from(signatureHex.replace(/^0x/, ''), 'hex');
  const v = sig[64] >= 27 ? sig[64] - 27 : sig[64];
  const pub = secp256k1.Signature.fromCompact(sig.subarray(0, 64)).addRecoveryBit(v).recoverPublicKey(keccak_256(prefixed));
  const uncompressed = pub.toRawBytes(false).subarray(1);
  return '0x' + Buffer.from(keccak_256(uncompressed).subarray(-20)).toString('hex');
}

export interface PrivateCompletion {
  content: string;
  verified: boolean;
  signer: string;
  signatureKind?: string;
  reason?: string;
}

export async function privateChat(model: string, messages: { role: string; content: string }[], apiKey: string): Promise<PrivateCompletion> {
  // 1. Fresh evidence BEFORE sending data. Refuse to send if the TEE does not verify.
  const att = await verifyModel(model, apiKey);
  if (!att.ok) throw new Error('TEE attestation failed; refusing to send data');
  const signers = new Set(att.models.map((m) => m.signer.split(':')[1].toLowerCase()));

  // 2. Send the completion, keeping exact request and response bytes.
  const body = JSON.stringify({ model, messages, stream: false, temperature: 0 });
  const res = await fetch(`${NEAR_AI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'x-no-aliasing': 'true', 'Accept-Encoding': 'identity' },
    body,
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`completion ${res.status}: ${raw.slice(0, 300)}`);
  const json = JSON.parse(raw);
  const content: string = json.choices?.[0]?.message?.content ?? '';

  // 3. Fetch the signature (it can take a moment to be recorded).
  let sig: any;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${NEAR_AI_BASE}/signature/${json.id}?signing_algo=ecdsa`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } });
    if (r.ok) { sig = await r.json(); if (sig.signature) break; }
    await new Promise((s) => setTimeout(s, 1000));
  }
  if (!sig?.signature) return { content, verified: false, signer: '', reason: 'no response signature available' };

  // 4. Check the signed text binds our exact bytes, and the signer is the TEE we verified.
  const expected = `${model}:${sha256hex(body)}:${sha256hex(raw)}`;
  const signer = recoverEip191(sig.text, sig.signature).toLowerCase();
  const kind = sig.signature_kind;
  if (kind !== 'provider_tee') return { content, verified: false, signer, signatureKind: kind, reason: `signature kind ${kind} does not bind to the model TEE` };
  if (sig.text !== expected) return { content, verified: false, signer, signatureKind: kind, reason: 'signed text does not match our request/response hashes' };
  if (!signers.has(signer)) return { content, verified: false, signer, signatureKind: kind, reason: 'signer is not the attested model key' };
  return { content, verified: true, signer, signatureKind: kind };
}
