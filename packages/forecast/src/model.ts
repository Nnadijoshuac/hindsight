// @hindsight/forecast: private cashflow forecasting that compounds with a person's own history.
//
// It learns three things: fixed bills (same payee, same day each month), how much each income
// source brings in per month, and how everyday spending changes through the year. Longer
// histories estimate lumpy income more accurately and are the only way to see seasonality.
import type { Txn } from './data.ts';
import {
  DAY_MS, addMonths, dayOfMonth, daysInMonth, distinctMonths, groupBy, mean, median, monthIndex, monthKey, stdDev, sum, toIsoDate,
} from './util.ts';

export interface Bill { name: string; day: number; amount: number }
export interface IncomeSource { name: string; perMonth: number; day: number }

export interface Model {
  months: string[];
  bills: Bill[];
  income: IncomeSource[];
  /** Average non-bill spending per day, in cents (negative). */
  dailySpend: number;
  /** Calendar month (0-11) -> multiplier on dailySpend. Missing until that month has been seen. */
  seasonal: Record<number, number>;
}

// A payee counts as a fixed bill if it appears in most months on a stable day of the month.
const BILL_MIN_SHARE_OF_MONTHS = 0.7;
const BILL_MAX_DAY_SPREAD = 3;
// Only income this regular and this large is scheduled into the balance projection.
const RELIABLE_INCOME_MIN = 50_000; // $500/month

const groupKey = (t: Txn) => `${t.amount < 0 ? 'out' : 'in'}:${t.description}`;

export function train(txns: Txn[]): Model {
  const months = distinctMonths(txns.map((t) => t.date));
  const groups = groupBy(txns, groupKey);

  const bills: Bill[] = [];
  const income: IncomeSource[] = [];
  for (const [key, group] of groups) {
    const name = group[0].description;
    const days = group.map((t) => dayOfMonth(t.date));

    if (key.startsWith('in:')) {
      income.push({ name, perMonth: sum(group.map((t) => t.amount)) / months.length, day: median(days) });
      continue;
    }

    const monthsSeen = distinctMonths(group.map((t) => t.date)).length;
    const isBill = monthsSeen >= Math.max(2, BILL_MIN_SHARE_OF_MONTHS * months.length) && stdDev(days) <= BILL_MAX_DAY_SPREAD;
    if (isBill) {
      // Use recent amounts so price changes (rent increases) are picked up quickly.
      bills.push({ name, day: median(days), amount: median(group.slice(-3).map((t) => t.amount)) });
    }
  }

  const billNames = new Set(bills.map((b) => b.name));
  const everyday = txns.filter((t) => t.amount < 0 && !billNames.has(t.description));
  const spendByMonth = groupBy(everyday, (t) => monthKey(t.date));
  const dailyByMonth = months.map((m) => sum((spendByMonth.get(m) ?? []).map((t) => t.amount)) / daysInMonth(m));
  const dailySpend = mean(dailyByMonth);

  return { months, bills, income, dailySpend, seasonal: learnSeasonality(months, dailyByMonth, dailySpend) };
}

function learnSeasonality(months: string[], dailyByMonth: number[], dailySpend: number) {
  const ratios = groupBy(months.map((m, i) => ({ m, ratio: dailyByMonth[i] / dailySpend })), (x) => String(monthIndex(x.m)));
  const seasonal: Record<number, number> = {};
  for (const [idx, xs] of ratios) seasonal[Number(idx)] = mean(xs.map((x) => x.ratio));
  return seasonal;
}

const seasonFactor = (model: Model, monthIdx: number) => model.seasonal[monthIdx] ?? 1;

/** Predicted net cashflow for a calendar month, in cents. */
export function predictMonth(model: Model, month: string): number {
  const bills = sum(model.bills.map((b) => b.amount));
  const income = sum(model.income.map((s) => s.perMonth));
  const everyday = model.dailySpend * seasonFactor(model, monthIndex(month)) * daysInMonth(month);
  return bills + income + everyday;
}

export interface BalancePoint { date: string; balance: number; events: string[] }

/** Day-by-day projected balance for the next `days`, starting the day after `from`. */
export function projectBalance(model: Model, from: string, startBalance: number, days = 45): BalancePoint[] {
  // Lumpy income is left out on purpose: the projection should show the worst realistic case.
  const scheduledIncome = model.income.filter((s) => s.perMonth >= RELIABLE_INCOME_MIN);
  const points: BalancePoint[] = [];
  let balance = startBalance;

  for (let i = 1; i <= days; i++) {
    const day = new Date(Date.parse(`${from}T00:00:00Z`) + i * DAY_MS);
    const dom = day.getUTCDate();
    const events: string[] = [];

    for (const bill of model.bills.filter((b) => Math.round(b.day) === dom)) {
      balance += bill.amount;
      events.push(bill.name);
    }
    for (const source of scheduledIncome.filter((s) => Math.round(s.day) === dom)) {
      balance += source.perMonth;
      events.push(source.name);
    }
    balance += model.dailySpend * seasonFactor(model, day.getUTCMonth());
    points.push({ date: toIsoDate(day), balance: Math.round(balance), events });
  }
  return points;
}

export interface BacktestRow { trainMonths: number; errorPct: number }

/**
 * How accurate is the forecast with N months of history?
 *
 * Every window size is tested on the same held-out periods, so the comparison is fair: from each
 * forecast origin we train on only the previous N months and predict the next `horizon` months of
 * net cashflow. Error is |predicted - actual| as a % of what was actually spent in those months.
 */
export function backtest(txns: Txn[], windows = [3, 6, 12, 24], origins = 10, horizon = 3): BacktestRow[] {
  const months = distinctMonths(txns.map((t) => t.date));
  const byMonth = groupBy(txns, (t) => monthKey(t.date));
  const txnsIn = (ms: string[]) => ms.flatMap((m) => byMonth.get(m) ?? []);

  const firstOrigin = months.length - horizon - origins + 1;
  if (firstOrigin < Math.max(...windows)) throw new Error('not enough history for the largest window');

  return windows.map((window) => {
    let totalError = 0;
    let totalSpent = 0;
    for (let o = firstOrigin; o < firstOrigin + origins; o++) {
      const model = train(txnsIn(months.slice(o - window, o)));
      const target = Array.from({ length: horizon }, (_, k) => addMonths(months[o], k));
      const actual = txnsIn(target);

      totalError += Math.abs(sum(target.map((m) => predictMonth(model, m))) - sum(actual.map((t) => t.amount)));
      totalSpent += -sum(actual.filter((t) => t.amount < 0).map((t) => t.amount));
    }
    return { trainMonths: window, errorPct: Math.round((1000 * totalError) / totalSpent) / 10 };
  });
}
