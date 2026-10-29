import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoPersona, parseCsv, toCsv } from '../src/data.ts';
import { backtest, predictMonth, projectBalance, train } from '../src/model.ts';

test('demo persona is deterministic', () => {
  assert.deepEqual(demoPersona(3), demoPersona(3));
});

test('CSV round-trips', () => {
  const t = demoPersona(2);
  assert.deepEqual(parseCsv(toCsv(t)), t);
});

test('learns fixed bills on their usual day', () => {
  const m = train(demoPersona(12));
  const rent = m.bills.find((b) => b.name === 'RENT LANDLORD LTD');
  assert.ok(rent);
  assert.equal(rent.day, 1);
  assert.equal(rent.amount, -95000);
});

test('seasonality is only learned once that calendar month has been seen', () => {
  assert.equal(train(demoPersona(3, '2025-01-01')).seasonal[6], undefined); // no July yet
  assert.ok(train(demoPersona(12, '2025-01-01')).seasonal[6] > 1); // summer spending is higher
});

test('more history lowers average forecast error across simulated users', () => {
  const seeds = [7, 1, 2, 3, 4, 5, 6, 8];
  const avg = (i: number) => seeds.map((s) => backtest(demoPersona(36, '2023-11-01', s))[i].errorPct).reduce((a, b) => a + b, 0) / seeds.length;
  assert.ok(avg(3) < avg(0), `24-month error ${avg(3)} should beat 3-month error ${avg(0)}`);
});

test('balance projection applies rent on the 1st', () => {
  const m = train(demoPersona(12));
  const p = projectBalance(m, '2026-10-31', 100000, 3);
  assert.ok(p[0].events.includes('RENT LANDLORD LTD'));
  assert.ok(Number.isFinite(predictMonth(m, '2026-11')));
});
