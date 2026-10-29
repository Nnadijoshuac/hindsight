// Builds the demo forecast once. Used by the page (prerendered at build time) and by /api/forecast.
import {
  DEMO_START_BALANCE, dayOfMonth, demoAda, demoPanel, distinctMonths, groupBy, monthKey, panelBacktest, runway, train,
} from '@hindsight/forecast';
import type { ForecastView } from '@/lib/types';

export function buildForecast(): ForecastView {
  const ada = demoAda();
  const lastDate = ada[ada.length - 1].date;
  const model = train(ada);

  // Transactions per day, one row per month: drives the animated history grid.
  const byMonth = groupBy(ada, (t) => monthKey(t.date));
  const activity = distinctMonths(ada.map((t) => t.date)).map((month) => {
    const counts = Array<number>(31).fill(0);
    for (const t of byMonth.get(month) ?? []) counts[dayOfMonth(t.date) - 1]++;
    return { month, counts };
  });

  // Signed amount for every scheduled event name, so the UI can label rent, bills and pay days.
  const eventAmounts = Object.fromEntries([
    ...model.bills.map((b) => [b.name, b.amount] as const),
    ...model.income.map((s) => [s.name, Math.round(s.perMonth)] as const),
  ]);

  return {
    persona: 'Ada, freelance designer',
    transactions: ada.length,
    from: lastDate,
    startBalance: DEMO_START_BALANCE,
    activity,
    eventAmounts,
    accuracy: panelBacktest(demoPanel()),
    runway: runway(model, lastDate, DEMO_START_BALANCE),
  };
}
