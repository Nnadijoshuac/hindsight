// Transactions, CSV parsing, and a deterministic demo persona.
import { DAY_MS, toIsoDate } from './util.ts';

export interface Txn {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // integer cents; + inflow, - outflow
}


export function parseCsv(csv: string): Txn[] {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const cols = header.toLowerCase().split(',').map((c) => c.trim());
  const di = cols.indexOf('date');
  const de = cols.indexOf('description');
  const am = cols.indexOf('amount');
  if (di < 0 || de < 0 || am < 0) throw new Error('CSV needs date, description, amount columns');
  return rows.filter(Boolean).map((r) => {
    const f = r.split(',');
    return { date: f[di].trim(), description: f[de].trim(), amount: Math.round(Number(f[am]) * 100) };
  });
}

export const toCsv = (txns: Txn[]) =>
  ['date,description,amount', ...txns.map((t) => `${t.date},${t.description},${(t.amount / 100).toFixed(2)}`)].join('\n');

// --- demo persona: "Ada", freelance designer, 24 months ---

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


export function demoPersona(months = 24, start = '2024-11-01', seed = 7): Txn[] {
  const r = rng(seed);
  const between = (lo: number, hi: number) => Math.round((lo + r() * (hi - lo)) * 100);
  const out: Txn[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const end = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + months, 1));
  let nextProject = new Date(s.getTime() + 20 * DAY_MS);

  for (let d = new Date(s); d < end; d = new Date(d.getTime() + DAY_MS)) {
    const day = d.getUTCDate();
    const m = d.getUTCMonth(); // 0..11
    const date = toIsoDate(d);
    const add = (description: string, amount: number) => out.push({ date, description, amount: Math.round(amount) });

    // fixed bills
    if (day === 1) add('RENT LANDLORD LTD', -95000);
    if (day === 3) add('FIBERNET INTERNET', -4000);
    if (day === 7) add('NETFLIX', -1549);
    if (day === 12) add('FIGMA SUBSCRIPTION', -1500);
    if (day === 20) add('MOBILE PHONE PLAN', -2500);
    if (day === 15) add('POWER UTILITY', -between(m >= 5 && m <= 7 ? 95 : 55, m >= 5 && m <= 7 ? 130 : 80));

    // everyday spending, with seasonal peaks (summer travel, December)
    const season = m === 11 ? 1.8 : m === 6 || m === 7 ? 1.5 : 1;
    if (r() < 0.3) add('GROCERY MART', -between(30, 90) * (m === 11 ? 1.3 : 1));
    if (r() < 0.45 * season) add('CAFE / TRANSPORT', -between(5, 30));
    if ((m === 6 || m === 7) && r() < 0.06) add('AIRLINE / HOTEL', -between(150, 400));

    // income: retainer (late sometimes), lumpy projects every 6-9 weeks, occasional small gigs
    const retainerDay = 26 + Math.floor(r() * 3);
    if (day === retainerDay) add('CLIENT ACME RETAINER', 120000);
    if (d >= nextProject) {
      add('CLIENT NOVA PROJECT', between(1500, 2600));
      nextProject = new Date(d.getTime() + (42 + Math.floor(r() * 21)) * DAY_MS);
    }
    if (day === 10 && r() < 0.35) add('UPWORK GIG', between(250, 600));
  }
  return out;
}
