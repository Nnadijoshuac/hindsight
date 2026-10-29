import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { recoverEip191 } from '../src/inference.ts';

const sign = (priv: Uint8Array, text: string) => {
  const msg = Buffer.from(text, 'utf8');
  const h = keccak_256(Buffer.concat([Buffer.from(`\x19Ethereum Signed Message:\n${msg.length}`), msg]));
  const s = secp256k1.sign(h, priv);
  return Buffer.concat([Buffer.from(s.toCompactRawBytes()), Buffer.from([27 + s.recovery])]).toString('hex');
};
const addressOf = (priv: Uint8Array) =>
  '0x' + Buffer.from(keccak_256(secp256k1.getPublicKey(priv, false).subarray(1)).subarray(-20)).toString('hex');

test('recovers the signer of an EIP-191 message', () => {
  const priv = secp256k1.utils.randomPrivateKey();
  const text = 'model:aa:bb';
  assert.equal(recoverEip191(text, sign(priv, text)), addressOf(priv));
});

test('a tampered message recovers a different signer', () => {
  const priv = secp256k1.utils.randomPrivateKey();
  assert.notEqual(recoverEip191('model:aa:cc', sign(priv, 'model:aa:bb')), addressOf(priv));
});
