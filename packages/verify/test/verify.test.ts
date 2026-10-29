import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { expectedMrConfigId, expectedReportData, replayRtmr3, type NearReport } from '../src/index.ts';

const base: NearReport = {
  signing_address: '0x' + 'ab'.repeat(20),
  signing_algo: 'ecdsa',
  intel_quote: '',
  request_nonce: 'cd'.repeat(32),
  event_log: [],
  info: { tcb_info: JSON.stringify({ app_compose: '{"x":1}' }) },
};

test('report data = signer padded to 32 bytes || nonce', () => {
  const rd = expectedReportData(base, 'cd'.repeat(32));
  assert.equal(rd.length, 64);
  assert.equal(rd.subarray(0, 20).toString('hex'), 'ab'.repeat(20));
  assert.ok(rd.subarray(20, 32).equals(Buffer.alloc(12)));
  assert.equal(rd.subarray(32).toString('hex'), 'cd'.repeat(32));
});

test('a different nonce produces different report data (replay protection)', () => {
  assert.ok(!expectedReportData(base, 'cd'.repeat(32)).equals(expectedReportData(base, 'ce'.repeat(32))));
});

test('MRCONFIGID = 01 || sha256(app_compose) || 15 zero bytes', () => {
  const m = expectedMrConfigId(base);
  assert.equal(m.length, 48);
  assert.equal(m[0], 1);
  assert.equal(m.subarray(1, 33).toString('hex'), createHash('sha256').update('{"x":1}').digest('hex'));
});

test('RTMR3 replay ignores non-imr3 events and rejects tampered digests', () => {
  assert.ok(replayRtmr3([{ imr: 1, event_type: 1, event: 'x', event_payload: '' }]).equals(Buffer.alloc(48)));
  assert.throws(() => replayRtmr3([{ imr: 3, event_type: 1, event: 'x', event_payload: '00', digest: '11'.repeat(48) }]));
});
