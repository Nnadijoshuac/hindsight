import { readFileSync } from 'node:fs';
import { demoPersona, parseCsv } from './data.ts';
import { backtest, projectBalance, train } from './model.ts';

// Usage: node packages/forecast/src/cli.ts [history.csv] [startBalanceUSD]
const [file, startUsd = '1450'] = process.argv.slice(2);
const txns = file ? parseCsv(readFileSync(file, 'utf8')) : demoPersona(36, '2023-11-01');
const usd = (c: number) => `${c < 0 ? '-' : ''}$${Math.abs(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

console.log(`History: ${txns.length} transactions${file ? ` from ${file}` : ' (demo persona: Ada, freelance designer)'}\n`);

// With no CSV, average over a panel of simulated freelancers so one lucky persona can't flatter the chart.
const panel = file ? [txns] : [7, 1, 2, 3, 4, 5, 6, 8].map((seed) => demoPersona(36, '2023-11-01', seed));
console.log(`3-month cashflow forecast error vs. months of history (10 identical held-out periods${file ? '' : `, averaged over ${panel.length} simulated freelancers`}):`);
const runs = panel.map((t) => backtest(t));
const rows = runs[0].map((r, i) => ({ trainMonths: r.trainMonths, errorPct: Math.round((10 * runs.reduce((a, x) => a + x[i].errorPct, 0)) / runs.length) / 10 }));
const max = Math.max(...rows.map((r) => r.errorPct));
for (const r of rows) console.log(`  ${String(r.trainMonths).padStart(2)} months  ${'█'.repeat(Math.round((30 * r.errorPct) / max)).padEnd(30)} ${r.errorPct}%`);

const model = train(txns);
const last = txns[txns.length - 1].date;
const path = projectBalance(model, last, Number(startUsd) * 100);
console.log(`\nNext 45 days from ${last}, starting balance ${usd(Number(startUsd) * 100)}:`);
const rent = model.bills.find((b) => /RENT/.test(b.name));
const low = path.reduce((a, p) => (p.balance < a.balance ? p : a));
console.log(`  Lowest point: ${usd(low.balance)} on ${low.date}`);
const rentDay = path.find((p) => rent && p.events.includes(rent.name));
if (rentDay && rentDay.balance < 0) {
  console.log(`  ALERT: rent on ${rentDay.date} leaves you ${usd(rentDay.balance)}, short by ${usd(-rentDay.balance)}.`);
} else if (rentDay) {
  console.log(`  Rent on ${rentDay.date} is covered (balance after: ${usd(rentDay.balance)}).`);
}
