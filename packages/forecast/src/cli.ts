import { readFileSync } from 'node:fs';
import { parseCsv } from './data.ts';
import { DEMO_START_BALANCE, demoAda, demoPanel } from './demo.ts';
import { panelBacktest, runway, train } from './model.ts';
import { formatUsd } from './util.ts';

// Usage: node packages/forecast/src/cli.ts [history.csv] [startBalanceUSD]
const [file, startUsd] = process.argv.slice(2);
const txns = file ? parseCsv(readFileSync(file, 'utf8')) : demoAda();
const startBalance = startUsd ? Number(startUsd) * 100 : DEMO_START_BALANCE;

console.log(`History: ${txns.length} transactions${file ? ` from ${file}` : ' (demo persona: Ada, freelance designer)'}\n`);

const rows = panelBacktest(file ? [txns] : demoPanel());
const scope = file ? '' : `, averaged over ${demoPanel().length} simulated freelancers`;
console.log(`3-month cashflow forecast error vs. months of history (10 identical held-out periods${scope}):`);
const worst = Math.max(...rows.map((r) => r.errorPct));
for (const r of rows) {
  const bar = '█'.repeat(Math.round((30 * r.errorPct) / worst)).padEnd(30);
  console.log(`  ${String(r.trainMonths).padStart(2)} months  ${bar} ${r.errorPct}%`);
}

const lastDate = txns[txns.length - 1].date;
const summary = runway(train(txns), lastDate, startBalance);
console.log(`\nNext 45 days from ${lastDate}, starting balance ${formatUsd(startBalance)}:`);
console.log(`  Lowest point: ${formatUsd(summary.lowest.balance)} on ${summary.lowest.date}`);
if (summary.rent) {
  const { date, balanceAfter, covered } = summary.rent;
  console.log(covered
    ? `  Rent on ${date} is covered (balance after: ${formatUsd(balanceAfter)}).`
    : `  ALERT: rent on ${date} leaves you ${formatUsd(balanceAfter)}, short by ${formatUsd(-balanceAfter)}.`);
}
