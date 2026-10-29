// 45-day projected balance. The line draws itself in; the tightest day is the only thing in green.
import { motion } from 'motion/react';
import type { BalancePoint } from '@forecast/model.ts';
import { formatUsd, shortDate } from '@/lib/format';

const W = 800, H = 280, TOP = 20, BOTTOM = 30;

export function RunwayChart({ points, lowest }: { points: BalancePoint[]; lowest: BalancePoint }) {
  const values = points.map((p) => p.balance);
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => TOP + (1 - (v - min) / (max - min)) * (H - TOP - BOTTOM);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
  const base = H - BOTTOM;
  const low = points.findIndex((p) => p.date === lowest.date); // JSON copies, so match by date
  const labelOnLeft = low > points.length * 0.7;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label="Projected balance for the next 45 days">
      <line x1={0} x2={W} y1={base} y2={base} className="stroke-neutral-300" />
      <motion.path d={`${line} L${W},${base} L0,${base} Z`} className="fill-neutral-900/[0.04]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.8 }} />
      <motion.path d={line} fill="none" className="stroke-neutral-900" strokeWidth={2}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }} />
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
        <line x1={x(low)} x2={x(low)} y1={TOP} y2={base} className="stroke-signal" strokeDasharray="3 4" />
        <circle cx={x(low)} cy={y(lowest.balance)} r={5} className="fill-signal" />
        <text x={x(low) + (labelOnLeft ? -10 : 10)} y={TOP + 10} textAnchor={labelOnLeft ? 'end' : 'start'}
          className="fill-signal font-mono text-[11px] font-medium tracking-wide">
          TIGHTEST · {formatUsd(lowest.balance)}
        </text>
      </motion.g>
      <text x={0} y={H - 6} className="fill-neutral-400 font-mono text-[11px] tracking-wide">{shortDate(points[0].date).toUpperCase()}</text>
      <text x={W} y={H - 6} textAnchor="end" className="fill-neutral-400 font-mono text-[11px] tracking-wide">{shortDate(points.at(-1)!.date).toUpperCase()}</text>
    </svg>
  );
}
