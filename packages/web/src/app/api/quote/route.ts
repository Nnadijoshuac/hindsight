// GET /api/quote: a dry-run NEAR Intents 1Click quote (250 USDC Base -> NEAR). Nothing moves.
// Confidential when a 1Click partner JWT is configured.
import { connection } from 'next/server';
import { buildQuoteRequest, findToken, getQuote, listTokens } from '@hindsight/intents';

export async function GET() {
  await connection();
  const tokens = await listTokens();
  const jwt = process.env.ONECLICK_JWT;
  const request = buildQuoteRequest({
    from: findToken(tokens, 'USDC', 'base'),
    to: findToken(tokens, 'USDC', 'near'),
    amount: '250',
    // 1Click validates addresses, so dry runs use real-looking placeholders.
    sender: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    recipient: 'demo.near',
    dry: true,
    confidentiality: jwt ? 'basic' : 'public',
  });
  return Response.json(await getQuote(request, jwt));
}
