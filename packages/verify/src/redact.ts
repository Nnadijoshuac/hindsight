// @hindsight/verify: strip personal data before any text reaches a model.
// Uses NEAR AI Cloud's openai/privacy-filter (token classification inside a TEE) via /v1/privacy/redact.
// Docs: https://docs.near.ai/cloud/guides/specialized-endpoints.md
import { NEAR_AI_BASE } from './index.ts';

export interface Redaction { text: string; redacted: boolean }

/**
 * Redact names, emails, phone numbers, account numbers and similar from each line.
 *
 * Lines go to the filter as one newline-joined document: in testing it classified far more
 * accurately with that context than when given an array of short fragments.
 */
export async function redact(lines: string[], apiKey: string): Promise<Redaction[]> {
  if (!lines.length) return [];
  const res = await fetch(`${NEAR_AI_BASE}/privacy/redact`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/privacy-filter', input: lines.join('\n') }),
  });
  if (!res.ok) throw new Error(`redact ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { data: { redacted: string }[] };
  const out = body.data[0].redacted.split('\n');
  if (out.length !== lines.length) throw new Error('redaction changed the number of lines');
  return out.map((text, i) => ({ text, redacted: text !== lines[i] }));
}
