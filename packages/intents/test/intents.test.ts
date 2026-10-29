import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteRequest, toBaseUnits, type Token } from '../src/index.ts';

const usdc: Token = { assetId: 'nep141:usdc', symbol: 'USDC', blockchain: 'near', decimals: 6 };
const near: Token = { assetId: 'nep141:wrap.near', symbol: 'wNEAR', blockchain: 'near', decimals: 24 };

test('toBaseUnits converts without float error', () => {
  assert.equal(toBaseUnits('10', 6), '10000000');
  assert.equal(toBaseUnits('0.1', 6), '100000');
  assert.equal(toBaseUnits('1.5', 24), '1500000000000000000000000');
  assert.throws(() => toBaseUnits('0.0000001', 6));
});

test('quote requests default to dry run', () => {
  const r = buildQuoteRequest({ from: usdc, to: near, amount: '10', sender: 'a.near', recipient: 'b.near' });
  assert.equal(r.dry, true);
  assert.equal(r.amount, '10000000');
  assert.equal(r.confidentiality, undefined);
});

test('confidential quotes set the confidentiality flag', () => {
  const r = buildQuoteRequest({ from: usdc, to: near, amount: '1', sender: 'a.near', recipient: 'b.near', confidentiality: 'basic' });
  assert.equal(r.confidentiality, 'basic');
});
