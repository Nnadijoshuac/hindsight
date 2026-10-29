// Typed access to the Hindsight API (packages/app/src/server.ts). Each panel loads independently.
import { useEffect, useState } from 'react';
import type { BacktestRow, RunwaySummary } from '@forecast/model.ts';

export interface ForecastView {
  persona: string;
  transactions: number;
  from: string;
  startBalance: number;
  activity: { month: string; counts: number[] }[];
  accuracy: BacktestRow[];
  runway: RunwaySummary;
}

export interface CheckResult { ok: boolean; signer: string; tcbStatus?: string; checks: Record<string, boolean> }
export interface PrivacyView { model: string; ok: boolean; gateway: CheckResult; models: CheckResult[]; hasGpuEvidence: boolean }

export interface PaymentRequest { id: number; payee: string; amount: string; memo: string; status: 'Pending' | 'Paid' | 'Rejected'; reason: string }
export interface VaultView {
  account: string;
  policy: { owner: string; agent: string; daily_cap: string; auto_limit: string; frozen: boolean; spent_today: string };
  payees: string[];
  requests: PaymentRequest[];
}

export interface QuoteView {
  quote: { amountOutFormatted: string; timeEstimate: number };
  quoteRequest: { confidentiality?: string };
}

export type Loadable<T> = { data?: T; error?: string };

export function useApi<T>(path: string): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({});
  useEffect(() => {
    let alive = true;
    fetch(path)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        if (alive) setState({ data: body as T });
      })
      .catch((err: Error) => alive && setState({ error: err.message }));
    return () => { alive = false; };
  }, [path]);
  return state;
}
