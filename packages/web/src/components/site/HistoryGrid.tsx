'use client';
// "Your history becomes foresight": every day of Ada's real history is a dot, laid out like a
// contribution graph (weeks across, weekdays down). Months fill in from left to right, and at each
// milestone the measured forecast error appears, so the claim is shown, not told.
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import type { ForecastView } from '@/lib/types';
import { monthLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Container, Heading, Label } from './Section';

const CELL = 10; // viewBox units between dot centres; the SVG scales to the container width
const LABEL_SPACE = 44;
const MONTH_STEP_MS = 90;
const DAY_MS = 86_400_000;

interface Dot { week: number; weekday: number; monthIndex: number; count: number }

/** Place each day of history on a week x weekday grid, remembering which month it belongs to. */
function layoutDays(activity: ForecastView['activity']) {
  if (!activity.length) return { dots: [] as Dot[], weeks: 0, monthEndWeek: [] as number[] };
  const start = Date.parse(`${activity[0].month}-01T00:00:00Z`);
  const startWeekday = new Date(start).getUTCDay();
  const dots: Dot[] = [];
  const monthEndWeek: number[] = [];

  activity.forEach(({ month, counts }, monthIndex) => {
    const [y, m] = month.split('-').map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = 0; d < days; d++) {
      const offset = (Date.UTC(y, m - 1, d + 1) - start) / DAY_MS + startWeekday;
      dots.push({ week: Math.floor(offset / 7), weekday: offset % 7, monthIndex, count: counts[d] });
    }
    monthEndWeek.push(dots[dots.length - 1].week);
  });
  return { dots, weeks: dots[dots.length - 1].week + 1, monthEndWeek };
}

export function HistoryGrid({ forecast }: { forecast?: ForecastView }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const activity = forecast?.activity ?? [];
  const { dots, weeks, monthEndWeek } = useMemo(() => layoutDays(activity), [activity]);
  const busiest = Math.max(1, ...dots.map((d) => d.count));
  const [revealed, setRevealed] = useState(0); // months shown so far

  useEffect(() => {
    if (!inView || !activity.length) return;
    const timer = setInterval(() => setRevealed((n) => (n >= activity.length ? (clearInterval(timer), n) : n + 1)), MONTH_STEP_MS);
    return () => clearInterval(timer);
  }, [inView, activity.length]);

  const milestones = forecast?.accuracy ?? [];
  const current = [...milestones].reverse().find((ms) => ms.trainMonths <= revealed);
  const best = milestones.at(-1);
  const isBest = (months: number) => months === best?.trainMonths;

  return (
    <section className="border-t border-border py-28 md:py-36">
      <Container>
        <div className="mb-20 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Label className="mb-6">How it learns</Label>
            <Heading strong="Your history becomes foresight." soft="Every day you add makes the next forecast sharper." className="text-3xl leading-[1.08] md:text-[48px]" />
          </div>
          <dl className="grid grid-cols-2 gap-8 self-end lg:col-span-4 lg:col-start-9">
            <div>
              <dt className="label-mono text-muted-foreground">Months of history</dt>
              <dd className="mt-2 text-5xl font-semibold tracking-[-0.05em] tabular-nums">{revealed}</dd>
            </div>
            <div>
              <dt className="label-mono text-muted-foreground">Forecast error</dt>
              <dd className={cn('mt-2 text-5xl font-semibold tracking-[-0.05em] tabular-nums transition-colors duration-500', current && isBest(current.trainMonths) && 'text-signal')}>
                {current ? `${current.errorPct}%` : '–'}
              </dd>
            </div>
          </dl>
        </div>

        <div ref={ref}>
          <svg viewBox={`0 0 ${weeks * CELL} ${7 * CELL + LABEL_SPACE}`} className="w-full" role="img"
            aria-label="Three years of daily transaction history, revealed month by month">
            {dots.map((d, i) => (
              <motion.circle key={i} cx={d.week * CELL + CELL / 2} cy={d.weekday * CELL + CELL / 2}
                r={d.count ? 1.4 + (2.6 * d.count) / busiest : 1}
                className={d.count ? 'fill-neutral-900' : 'fill-neutral-200'}
                initial={{ opacity: 0 }}
                animate={{ opacity: d.monthIndex < revealed ? (d.count ? 0.3 + (0.7 * d.count) / busiest : 1) : 0 }}
                transition={{ duration: 0.35 }} />
            ))}
            {milestones.filter((ms) => ms.trainMonths <= revealed).map((ms) => {
              const x = (monthEndWeek[ms.trainMonths - 1] + 1) * CELL;
              return (
                <motion.g key={ms.trainMonths} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <line x1={x} x2={x} y1={0} y2={7 * CELL + 8} className={isBest(ms.trainMonths) ? 'stroke-signal' : 'stroke-neutral-300'} strokeWidth={0.6} />
                  <text x={x} y={7 * CELL + 30} textAnchor="middle"
                    className={cn('font-mono text-[13px] tracking-wide', isBest(ms.trainMonths) ? 'fill-signal' : 'fill-neutral-500')}>
                    {ms.trainMonths}M · {ms.errorPct}%
                  </text>
                </motion.g>
              );
            })}
          </svg>
        </div>
        {activity.length > 0 && (
          <p className="label-mono mt-8 text-muted-foreground">
            {monthLabel(activity[0].month)} → {monthLabel(activity.at(-1)!.month)} · one dot per day · darker = busier
          </p>
        )}
      </Container>
    </section>
  );
}
