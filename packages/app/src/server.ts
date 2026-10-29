// Hindsight web app server: one screen showing the private cashflow forecast, the NEAR AI TEE
// privacy proof, a NEAR Intents dry-run quote, and the on-chain agent spending policy.
// Run: npm start  ->  http://localhost:3000
import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { DEMO_START_BALANCE, demoAda, demoPanel } from '../../forecast/src/demo.ts';
import { panelBacktest, runway, train } from '../../forecast/src/model.ts';
import { dayOfMonth, distinctMonths, groupBy, monthKey } from '../../forecast/src/util.ts';
import { buildQuoteRequest, findToken, getQuote, listTokens } from '../../intents/src/index.ts';
import { verifyModel } from '../../verify/src/index.ts';
import { viewCall } from './near.ts';

const PORT = Number(process.env.PORT ?? 3000);
const VAULT = process.env.VAULT_ACCOUNT ?? 'hindsight-dev.testnet';
const MODEL = 'deepseek-ai/DeepSeek-V4.1-Flash-1017';
// The React front end (packages/web) is built to static files and served from here.
const PUBLIC_DIR = join(import.meta.dirname, '..', '..', 'web', 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

// The forecast is deterministic for the demo, so compute it once at startup.
const ada = demoAda();
const lastDate = ada[ada.length - 1].date;
// Transactions per day, one row per month: drives the animated history grid on the landing page.
const byMonth = groupBy(ada, (t) => monthKey(t.date));
const activity = distinctMonths(ada.map((t) => t.date)).map((m) => {
  const counts = Array<number>(31).fill(0);
  for (const t of byMonth.get(m) ?? []) counts[dayOfMonth(t.date) - 1]++;
  return { month: m, counts };
});

const forecast = {
  activity,
  persona: 'Ada, freelance designer',
  transactions: ada.length,
  from: lastDate,
  startBalance: DEMO_START_BALANCE,
  accuracy: panelBacktest(demoPanel()),
  runway: runway(train(ada), lastDate, DEMO_START_BALANCE),
};

const routes: Record<string, () => Promise<unknown>> = {
  '/api/forecast': async () => forecast,
  '/api/privacy': async () => verifyModel(MODEL, process.env.NEAR_AI_CLOUD_API_KEY),
  '/api/vault': async () => {
    const [policy, payees, requests] = await Promise.all([
      viewCall('testnet', VAULT, 'get_policy'),
      viewCall('testnet', VAULT, 'get_payees'),
      viewCall('testnet', VAULT, 'get_requests', { from: 0, limit: 20 }),
    ]);
    return { account: VAULT, policy, payees, requests };
  },
  '/api/quote': async () => {
    const tokens = await listTokens();
    const jwt = process.env.ONECLICK_JWT;
    const req = buildQuoteRequest({
      from: findToken(tokens, 'USDC', 'base'),
      to: findToken(tokens, 'USDC', 'near'),
      amount: '250',
      sender: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      recipient: 'demo.near',
      dry: true,
      confidentiality: jwt ? 'basic' : 'public',
    });
    return getQuote(req, jwt);
  },
};

function send(res: ServerResponse, status: number, body: string | Buffer, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
  res.end(body);
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  try {
    const route = routes[path];
    if (route) return send(res, 200, JSON.stringify(await route()));
    const file = path === '/' ? 'index.html' : path.slice(1);
    if (file.includes('..')) return send(res, 400, 'bad path', 'text/plain');
    send(res, 200, await readFile(join(PUBLIC_DIR, file)), MIME[extname(file)] ?? 'application/octet-stream');
  } catch (err) {
    const notFound = (err as NodeJS.ErrnoException).code === 'ENOENT';
    send(res, notFound ? 404 : 502, JSON.stringify({ error: notFound ? 'not found' : (err as Error).message }));
  }
}).listen(PORT, () => console.log(`Hindsight running at http://localhost:${PORT}`));
