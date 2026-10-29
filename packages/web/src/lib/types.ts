// Shapes of the data each API route returns. Shared by route handlers and client components.
import type { BacktestRow, RunwaySummary } from '@hindsight/forecast';

export interface ForecastView {
  persona: string;
  transactions: number;
  from: string;
  startBalance: number;
  activity: { month: string; counts: number[] }[];
  /** Event name -> signed amount in cents (bills negative, income positive). */
  eventAmounts: Record<string, number>;
  accuracy: BacktestRow[];
  runway: RunwaySummary;
}

export interface CheckResult { ok: boolean; signer: string; tcbStatus?: string; checks: Record<string, boolean> }
export interface PrivacyView { model: string; ok: boolean; gateway: CheckResult; models: CheckResult[]; hasGpuEvidence: boolean }

export interface PaymentRequest { id: number; payee: string; amount: string; memo: string; status: 'Pending' | 'Sending' | 'Paid' | 'Rejected' | 'Failed'; reason: string }
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

export interface InsightView {
  text: string;
  verified: boolean;
  signer: string;
  reason?: string;
  model: string;
  linesSent: number;
  linesRedacted: number;
}
