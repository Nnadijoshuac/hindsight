// @hindsight/intents: minimal NEAR Intents 1Click API client.
// Cross-chain stablecoin quotes (NEAR, Base, Arbitrum, Solana…), dry-run by default, with optional
// Confidential Intents (confidentiality=basic) when a 1Click partner JWT is configured.
// Spec: https://1click.chaindefuser.com/docs/v0/openapi.yaml
export const ONECLICK_BASE = 'https://1click.chaindefuser.com/v0';

export interface Token {
  assetId: string;
  symbol: string;
  blockchain: string;
  decimals: number;
  price?: number;
}

export type Confidentiality = 'public' | 'basic' | 'advanced';

export interface QuoteRequest {
  dry: boolean;
  swapType: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  slippageTolerance: number; // basis points
  originAsset: string;
  depositType: 'ORIGIN_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  destinationAsset: string;
  amount: string;
  refundTo: string;
  refundType: 'ORIGIN_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  recipient: string;
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  deadline: string;
  confidentiality?: Confidentiality;
}

export interface QuoteResponse {
  quote: { amountIn: string; amountOut: string; amountOutFormatted: string; amountOutUsd: string; timeEstimate: number; depositAddress?: string };
  quoteRequest: QuoteRequest;
  signature: string;
}

const headers = (jwt?: string) => ({
  'Content-Type': 'application/json',
  ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
});

export async function listTokens(): Promise<Token[]> {
  const res = await fetch(`${ONECLICK_BASE}/tokens`);
  if (!res.ok) throw new Error(`tokens ${res.status}`);
  return (await res.json()) as Token[];
}

export function findToken(tokens: Token[], symbol: string, blockchain: string): Token {
  const t = tokens.find((x) => x.symbol === symbol && x.blockchain === blockchain);
  if (!t) throw new Error(`token ${symbol} on ${blockchain} not supported`);
  return t;
}

/** Human amount ("10.5") -> base units string, without floating point. */
export function toBaseUnits(amount: string, decimals: number): string {
  const [whole, frac = ''] = amount.split('.');
  if (frac.length > decimals) throw new Error(`too many decimals (max ${decimals})`);
  return BigInt(whole + frac.padEnd(decimals, '0')).toString();
}

export function buildQuoteRequest(p: {
  from: Token; to: Token; amount: string; sender: string; recipient: string;
  dry?: boolean; confidentiality?: Confidentiality; slippageBps?: number; ttlMinutes?: number;
}): QuoteRequest {
  return {
    dry: p.dry ?? true,
    swapType: 'EXACT_INPUT',
    slippageTolerance: p.slippageBps ?? 100,
    originAsset: p.from.assetId,
    depositType: 'ORIGIN_CHAIN',
    destinationAsset: p.to.assetId,
    amount: toBaseUnits(p.amount, p.from.decimals),
    refundTo: p.sender,
    refundType: 'ORIGIN_CHAIN',
    recipient: p.recipient,
    recipientType: 'DESTINATION_CHAIN',
    deadline: new Date(Date.now() + (p.ttlMinutes ?? 30) * 60_000).toISOString(),
    ...(p.confidentiality && p.confidentiality !== 'public' ? { confidentiality: p.confidentiality } : {}),
  };
}

export async function getQuote(req: QuoteRequest, jwt?: string): Promise<QuoteResponse> {
  const res = await fetch(`${ONECLICK_BASE}/quote`, { method: 'POST', headers: headers(jwt), body: JSON.stringify(req) });
  const body = await res.json();
  if (!res.ok) throw new Error(`quote ${res.status}: ${body.message ?? JSON.stringify(body)}`);
  return body as QuoteResponse;
}
