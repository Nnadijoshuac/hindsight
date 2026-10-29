'use client';
// The product as a user sees it on a laptop: a 1280×800 app screen (16:10) scaled to fit the page.
// Regions are separated by hairlines, never boxed inside boxes.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import type { Loadable } from '@/lib/api';
import { eventLabel } from '@/lib/events';
import { formatUsd, shortDate } from '@/lib/format';
import type { ForecastView, PrivacyView, QuoteView } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RunwayChart } from './RunwayChart';

const SCREEN = { width: 1280, height: 800 };
const UPCOMING_DAYS = 21;

/** Renders children at a fixed design size and scales them to the available width. */
function ScaledScreen({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / SCREEN.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ height: SCREEN.height * scale }} className="relative w-full overflow-hidden">
      <div style={{ width: SCREEN.width, height: SCREEN.height, transform: `scale(${scale})` }} className="origin-top-left">
        {children}
      </div>
    </div>
  );
}

export function AppWindow({ forecast, privacy, quote }: { forecast: ForecastView; privacy: Loadable<PrivacyView>; quote: Loadable<QuoteView> }) {
  const ref = useRef<HTMLDivElement>(null);
  // The screen leans back slightly and settles flat as it scrolls into view.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 35%'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [12, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1]);

  return (
    <div className="[perspective:2400px]">
      <motion.div ref={ref} id="forecast" style={{ rotateX, scale }} className="origin-top overflow-hidden rounded-xl bg-white shadow-floor">
        <ScaledScreen>
          <div className="flex h-full flex-col text-[14px] text-neutral-900">
            <TitleBar privacy={privacy} />
            <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
              <Sidebar privacy={privacy} />
              <Overview forecast={forecast} quote={quote} />
            </div>
          </div>
        </ScaledScreen>
      </motion.div>
    </div>
  );
}

function TitleBar({ privacy }: { privacy: Loadable<PrivacyView> }) {
  return (
    <div className="flex h-11 shrink-0 items-center border-b border-neutral-200 bg-neutral-50 px-4">
      <span className="flex gap-2">{['bg-neutral-300', 'bg-neutral-300', 'bg-neutral-300'].map((c, i) => <span key={i} className={cn('size-3 rounded-full', c)} />)}</span>
      <span className="mx-auto rounded-md bg-white px-24 py-1 text-[12px] text-neutral-500 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">hindsight.app/overview</span>
      <span className={cn('label-mono text-[10px]', privacy.data?.ok ? 'text-signal' : 'text-neutral-400')}>
        {privacy.data?.ok ? '● Private' : 'Checking'}
      </span>
    </div>
  );
}

const NAV = ['Overview', 'Transactions', 'Bills', 'Agent', 'Privacy'];
const ACCOUNTS = [['Bank (CSV export)', '24 mo'], ['NEAR wallet', 'live'], ['Base wallet', 'live']];

function Sidebar({ privacy }: { privacy: Loadable<PrivacyView> }) {
  const checks = privacy.data ? Object.values(privacy.data.models[0]?.checks ?? {}) : [];
  return (
    <aside className="flex flex-col border-r border-neutral-200 bg-neutral-50/60 px-3 py-5">
      <p className="mb-6 px-3 text-[15px] font-semibold tracking-[-0.02em]">Hindsight</p>
      <nav className="grid gap-0.5">
        {NAV.map((item, i) => (
          <span key={item} className={cn('rounded-md px-3 py-1.5', i === 0 ? 'bg-white font-medium shadow-[0_0_0_1px_rgb(0_0_0/0.06)]' : 'text-neutral-500')}>{item}</span>
        ))}
      </nav>
      <p className="label-mono mt-8 mb-2 px-3 text-[10px] text-neutral-400">Sources</p>
      {ACCOUNTS.map(([name, note]) => (
        <span key={name} className="flex justify-between px-3 py-1.5 text-neutral-600">{name}<span className="text-neutral-400">{note}</span></span>
      ))}
      <div className="mt-auto border-t border-neutral-200 px-3 pt-4">
        <p className="label-mono text-[10px] text-neutral-400">Confidential compute</p>
        <p className={cn('mt-1 font-medium', privacy.data?.ok ? 'text-signal' : 'text-neutral-500')}>
          {privacy.data ? `${checks.filter(Boolean).length + (privacy.data.hasGpuEvidence ? 1 : 0)}/${checks.length + (privacy.data.hasGpuEvidence ? 1 : 0)} checks passed` : 'Verifying…'}
        </p>
      </div>
    </aside>
  );
}

function Overview({ forecast: f, quote }: { forecast: ForecastView; quote: Loadable<QuoteView> }) {
  const { lowest, rent, points } = f.runway;
  const upcoming = points.slice(0, UPCOMING_DAYS).flatMap((p) => p.events.map((name) => ({ date: p.date, name, amount: f.eventAmounts[name] ?? 0 })));
  const kpis: [string, ReactNode, string?][] = [
    ['Balance today', formatUsd(f.startBalance), shortDate(f.from)],
    ['Tightest day', <span key="low" className="text-signal">{formatUsd(lowest.balance)}</span>, shortDate(lowest.date)],
    ['Next rent', rent?.covered ? 'Covered' : 'Short', rent && shortDate(rent.date)],
    ['Forecast error', `${f.accuracy.at(-1)!.errorPct}%`, '24 months of history'],
  ];

  return (
    <main className="flex min-h-0 flex-col">
      <header className="flex items-end justify-between border-b border-neutral-200 px-8 pt-7 pb-6">
        <div>
          <p className="text-neutral-500">Good afternoon, Ada</p>
          <p className="mt-1 text-[26px] font-semibold tracking-[-0.025em]">
            {rent && !rent.covered ? <>You&apos;ll be <span className="text-signal">{formatUsd(-rent.balanceAfter)}</span> short for rent.</> : `Rent on ${shortDate(rent?.date ?? lowest.date)} is covered. ${formatUsd(lowest.balance)} is your tightest day.`}
          </p>
        </div>
        <span className="label-mono text-[10px] text-neutral-400">Next 45 days</span>
      </header>

      <dl className="grid grid-cols-4 border-b border-neutral-200">
        {kpis.map(([label, value, note], i) => (
          <div key={label} className={cn('px-8 py-5', i > 0 && 'border-l border-neutral-200')}>
            <dt className="label-mono text-[10px] text-neutral-400">{label}</dt>
            <dd className="mt-1.5 text-[22px] font-medium tracking-[-0.02em] tabular-nums">{value}</dd>
            {note && <dd className="text-[12px] text-neutral-500">{note}</dd>}
          </div>
        ))}
      </dl>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_280px]">
        <div className="px-8 pt-6 pb-4">
          <RunwayChart points={points} lowest={lowest} start={{ date: f.from, balance: f.startBalance }} eventAmounts={f.eventAmounts} />
        </div>
        <section className="flex min-h-0 flex-col border-l border-neutral-200">
          <p className="label-mono px-6 pt-6 pb-3 text-[10px] text-neutral-400">Upcoming · {UPCOMING_DAYS} days</p>
          <ul className="min-h-0 flex-1 overflow-hidden px-6">
            {upcoming.map((e) => (
              <li key={`${e.date}-${e.name}`} className="flex items-baseline justify-between border-b border-neutral-100 py-2.5">
                <span><span className="mr-3 font-mono text-[11px] text-neutral-400">{shortDate(e.date)}</span>{eventLabel(e.name)}</span>
                <span className="tabular-nums text-neutral-600">{e.amount > 0 ? '+' : '−'}{formatUsd(Math.abs(e.amount))}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="flex items-center gap-4 border-t border-neutral-200 bg-neutral-50/60 px-8 py-4">
        <span className="label-mono text-[10px] text-signal">Agent</span>
        <span className="text-neutral-700">
          Top up before {shortDate(lowest.date)}: move 250 USDC from Base to NEAR
          {quote.data && <span className="text-neutral-400"> · you receive {Number(quote.data.quote.amountOutFormatted).toFixed(2)} USDC in ~{quote.data.quote.timeEstimate}s</span>}
        </span>
        <span className="ml-auto text-neutral-500">Within your limits</span>
        <span className="rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white">Review</span>
      </footer>
    </main>
  );
}
