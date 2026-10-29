// A private, verifiable AI insight about the forecast.
//   1. Recent transaction descriptions are stripped of personal data by NEAR AI's privacy filter.
//      Dates and amounts are not personal data, so they stay structured and never go through it.
//   2. The model's TEE is attested before anything is sent (privateChat refuses otherwise).
//   3. The reply's provider_tee signature is checked against that attested key.
import { demoAda, formatUsd, titleCase } from '@hindsight/forecast';
import { privateChat } from '@hindsight/verify/inference.ts';
import { redact } from '@hindsight/verify/redact.ts';
import type { InsightView } from '@/lib/types';
import { PRIVATE_MODEL } from './config';
import { buildForecast } from './forecast';

const RECENT_LINES = 25;

export async function buildInsight(apiKey: string): Promise<InsightView> {
  const forecast = buildForecast();
  const { lowest, rent } = forecast.runway;

  const recent = demoAda().slice(-RECENT_LINES);
  const cleaned = await redact(recent.map((t) => titleCase(t.description)), apiKey);
  const lines = recent.map((t, i) => `${t.date} ${cleaned[i].text} ${formatUsd(t.amount)}`);

  const summary = [
    `Balance today: ${formatUsd(forecast.startBalance)} (${forecast.from}).`,
    `Lowest projected balance in the next 45 days: ${formatUsd(lowest.balance)} on ${lowest.date}.`,
    rent && `Next rent ${rent.date}: ${rent.covered ? 'covered' : 'short'}, balance after ${formatUsd(rent.balanceAfter)}.`,
    `Forecast error with 24 months of history: ${forecast.accuracy.at(-1)!.errorPct}%.`,
    'Recent transactions (personal data redacted):',
    ...lines,
  ].filter(Boolean).join('\n');

  const reply = await privateChat(PRIVATE_MODEL, [
    {
      role: 'system',
      content: 'You are a calm personal cashflow assistant. Reply in at most two short sentences, plain text, no markdown. Name the single most useful action and the date it matters by.',
    },
    { role: 'user', content: summary },
  ], apiKey);

  return {
    text: reply.content.trim(),
    verified: reply.verified,
    signer: reply.signer,
    reason: reply.reason,
    model: PRIVATE_MODEL,
    linesSent: cleaned.length,
    linesRedacted: cleaned.filter((r) => r.redacted).length,
  };
}
