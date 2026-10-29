import { buildQuoteRequest, findToken, getQuote, listTokens } from './index.ts';

// Usage: node packages/intents/src/cli.ts [amount] [FROM:chain] [TO:chain]
const [amount = '10', from = 'USDC:near', to = 'USDC:base'] = process.argv.slice(2);
const jwt = process.env.ONECLICK_JWT;

// Dry runs need real-looking addresses on each chain; 1Click rejects unknown accounts.
const placeholder = (chain: string) => (chain === 'near' ? 'demo.near' : '0x742d35Cc6634C0532925a3b844Bc454e4438f44e');

const tokens = await listTokens();
const [fs, fc] = from.split(':');
const [ts, tc] = to.split(':');
const req = buildQuoteRequest({
  from: findToken(tokens, fs, fc),
  to: findToken(tokens, ts, tc),
  amount,
  sender: placeholder(fc),
  recipient: placeholder(tc),
  dry: true,
  confidentiality: jwt ? 'basic' : 'public',
});

const q = await getQuote(req, jwt);
console.log(`DRY RUN (no funds move) · confidentiality=${q.quoteRequest.confidentiality ?? 'public'}`);
console.log(`Quote: ${amount} ${from} -> ${q.quote.amountOutFormatted} ${to} (~$${Number(q.quote.amountOutUsd).toFixed(2)}) in ~${q.quote.timeEstimate}s`);
if (!jwt) console.log('Note: set ONECLICK_JWT to request a confidential quote.');
