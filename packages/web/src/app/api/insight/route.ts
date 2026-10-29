// GET /api/insight: a short cashflow insight written by a TEE-hosted model, with personal data
// redacted first and the reply's signature verified against the attested hardware key.
import { connection } from 'next/server';
import { buildInsight } from '@/lib/server/insight';

export async function GET() {
  await connection();
  const apiKey = process.env.NEAR_AI_CLOUD_API_KEY;
  if (!apiKey) return Response.json({ error: 'NEAR_AI_CLOUD_API_KEY is not set' }, { status: 503 });
  return Response.json(await buildInsight(apiKey));
}
