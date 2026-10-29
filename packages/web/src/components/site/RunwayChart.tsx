'use client';
// 45-day projected balance, drawn with the context that makes a forecast readable: dollar gridlines,
// weekly dates, a widening "likely range", a safety-buffer line, and labelled pay days and bills.
// Only the tightest day is green.
import { motion } from 'motion/react';
import type { BalancePoint } from '@hindsight/forecast';
import { formatUsd, shortDate } from '@/lib/format';
import { eventLabel } from '@/lib/events';

const W = 760, H = 340;
const PAD = { top: 56, right: 56, bottom: 30, left: 0 };
const FLAG_ROWS = [12, 30];
const SAFETY_BUFFER = 20_000; // $200
const LABELLED_EVENT_MIN = 10_000; // only events of $100+ get a flag

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Smooth path that never overshoots the data (monotone cubic, Fritsch-Carlson). Balances jump on
 * pay days and rent, and a naive spline would invent bumps around every jump.
 */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  const dx = pts.slice(1).map(([x], k) => x - pts[k][0]);
  const slope = pts.slice(1).map(([, y], k) => (y - pts[k][1]) / dx[k]);
  const tangent = pts.map((_, k) =>
    k === 0 ? slope[0] : k === n - 1 ? slope[n - 2] : slope[k - 1] * slope[k] <= 0 ? 0 : (slope[k - 1] + slope[k]) / 2);
  for (let k = 0; k < n - 1; k++) {
    if (slope[k] === 0) { tangent[k] = tangent[k + 1] = 0; continue; }
    const a = tangent[k] / slope[k], b = tangent[k + 1] / slope[k], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); tangent[k] = t * a * slope[k]; tangent[k + 1] = t * b * slope[k]; }
  }
  const f = (v: number) => v.toFixed(1);
  return pts.reduce((d, [x, y], k) => {
    if (k === 0) return `M${f(x)},${f(y)}`;
    const [x0, y0] = pts[k - 1], h = dx[k - 1] / 3;
    return `${d} C${f(x0 + h)},${f(y0 + tangent[k - 1] * h)} ${f(x - h)},${f(y - tangent[k] * h)} ${f(x)},${f(y)}`;
  }, '');
}

/** Two label rows: a flag drops to the second row when it would collide with the one before it. */
function placeFlags<T extends { x: number }>(flags: T[], minGap = 150): (T & { row: number })[] {
  const lastX = [-Infinity, -Infinity];
  return flags.map((flag) => {
    const row = flag.x - lastX[0] >= minGap ? 0 : 1;
    lastX[row] = flag.x;
    return { ...flag, row };
  });
}

export function RunwayChart({ points, lowest, start, eventAmounts }: {
  points: BalancePoint[];
  lowest: BalancePoint;
  start: { date: string; balance: number };
  eventAmounts: Record<string, number>;
}) {
  const series = [start, ...points];
  const values = series.map((p) => p.balance);
  const range = Math.max(...values) - Math.min(...values);
  // Uncertainty grows with distance from today, roughly with the square root of time.
  const spread = (i: number) => 0.22 * range * Math.sqrt(i / (series.length - 1));

  const lo = Math.min(0, ...values.map((v, i) => v - spread(i)));
  const hi = Math.max(...values.map((v, i) => v + spread(i)));
  const x = (i: number) => PAD.left + (i / (series.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const base = H - PAD.bottom;

  const line = smoothPath(series.map((p, i) => [x(i), y(p.balance)]));
  const upper = series.map((p, i) => [x(i), y(p.balance + spread(i))] as [number, number]);
  const lower = series.map((p, i) => [x(i), y(p.balance - spread(i))] as [number, number]).reverse();
  const band = `${smoothPath(upper)} L${lower.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' L')} Z`;

  const step = 50_000; // $500 gridlines
  const ticks = Array.from({ length: Math.floor(hi / step) + 1 }, (_, k) => k * step).filter((v) => v >= lo);
  const weeks = series.map((p, i) => ({ p, i })).filter(({ i }) => i % 7 === 0);
  const low = series.findIndex((p) => p.date === lowest.date);

  const flags = placeFlags(series.flatMap((p, i) => (('events' in p ? p.events : []) as string[])
    .map((name) => ({ i, x: x(i), name, amount: eventAmounts[name] ?? 0 }))
    .filter((e) => Math.abs(e.amount) >= LABELLED_EVENT_MIN)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full overflow-visible" role="img"
      aria-label="Projected balance for the next 45 days with likely range, safety buffer and upcoming events">
      {/* reference grid: dollars and weeks */}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={0} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-neutral-300' : 'stroke-neutral-100'} />
          <text x={W - PAD.right + 10} y={y(v) + 4} className="fill-neutral-400 font-mono text-[10px]">{formatUsd(v).replace('.00', '')}</text>
        </g>
      ))}
      {weeks.map(({ p, i }) => (
        <text key={p.date} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : 'middle'} className="fill-neutral-400 font-mono text-[10px] tracking-wide">
          {i === 0 ? 'TODAY' : shortDate(p.date).toUpperCase()}
        </text>
      ))}

      {/* safety buffer */}
      <line x1={0} x2={W - PAD.right} y1={y(SAFETY_BUFFER)} y2={y(SAFETY_BUFFER)} className="stroke-neutral-400" strokeDasharray="2 5" />
      <text x={W - PAD.right - 4} y={y(SAFETY_BUFFER) - 6} textAnchor="end" className="fill-neutral-500 font-mono text-[10px] tracking-wide">SAFETY BUFFER · $200</text>

      {/* likely range, then the forecast itself */}
      <motion.path d={band} className="fill-neutral-900/[0.05]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 1 }} />
      <motion.path d={line} fill="none" className="stroke-neutral-900" strokeWidth={2} strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease }} />

      {/* pay days and bills, flagged above the plot */}
      {flags.map((f, k) => (
        <motion.g key={`${f.i}-${f.name}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 + k * 0.08 }}>
          <line x1={f.x} x2={f.x} y1={FLAG_ROWS[f.row] + 6} y2={y(series[f.i].balance)} className="stroke-neutral-200" />
          <circle cx={x(f.i)} cy={y(series[f.i].balance)} r={3} className="fill-white stroke-neutral-900" strokeWidth={1.5} />
          <text x={f.x} y={FLAG_ROWS[f.row]} textAnchor="middle" className="fill-neutral-600 text-[11px]">
            {eventLabel(f.name)} <tspan className="fill-neutral-400">{f.amount > 0 ? '+' : '−'}{formatUsd(Math.abs(f.amount)).replace('.00', '')}</tspan>
          </text>
        </motion.g>
      ))}

      {/* the one thing that needs attention */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
        <circle cx={x(low)} cy={y(lowest.balance)} r={12} className="fill-signal/15">
          <animate attributeName="r" values="6;14;6" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx={x(low)} cy={y(lowest.balance)} r={5} className="fill-signal" />
        <text x={x(low) + 12} y={y(lowest.balance) + 18} className="fill-signal font-mono text-[11px] font-medium tracking-wide">
          TIGHTEST · {formatUsd(lowest.balance)} · {shortDate(lowest.date).toUpperCase()}
        </text>
      </motion.g>
      <text x={W - PAD.right - 4} y={y(series.at(-1)!.balance + spread(series.length - 1)) - 8} textAnchor="end"
        className="fill-neutral-400 font-mono text-[10px] tracking-wide">LIKELY RANGE</text>
      <line x1={x(0)} x2={x(0)} y1={PAD.top - 8} y2={base} className="stroke-neutral-900" strokeWidth={1} />
    </svg>
  );
}
