// Hero: the one question freelancers actually ask, then the product answering it with real numbers.
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Button } from '@/components/ui/button';
import type { ForecastView, Loadable, PrivacyView } from '@/lib/api';
import { formatUsd, shortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Container, Heading, Label } from './Section';
import { RunwayChart } from './RunwayChart';

export function Hero({ forecast, privacy }: { forecast: Loadable<ForecastView>; privacy: Loadable<PrivacyView> }) {
  const verified = privacy.data?.ok;
  return (
    <header className="pt-20 md:pt-28">
      <Container>
        <div className="grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="mb-8 flex items-center gap-3">
              <Label>Confidential AI</Label>
              <span className={cn('label-mono rounded px-2 py-0.5', verified ? 'bg-signal-wash text-signal' : 'bg-muted text-muted-foreground')}>
                {privacy.error ? 'unverified' : verified === undefined ? 'checking…' : verified ? 'hardware verified' : 'verification failed'}
              </span>
            </div>
            <Heading as="h1" strong="Know if you'll make rent." soft="Before it becomes a problem." className="text-[clamp(48px,6.4vw,96px)] leading-[0.98] tracking-[-0.045em]" />
          </div>
          <div className="lg:col-span-4">
            <p className="mb-8 text-lg text-neutral-600">
              Hindsight forecasts your cashflow from your own history. The more you give it, the sharper it gets, and it only runs on hardware we can prove nobody can read.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild><a href="#forecast">See your forecast</a></Button>
              <Button size="lg" variant="outline" asChild><a href="#privacy">How privacy is proven</a></Button>
            </div>
          </div>
        </div>
      </Container>
      <ProductWindow forecast={forecast} />
    </header>
  );
}

function ProductWindow({ forecast }: { forecast: Loadable<ForecastView> }) {
  const ref = useRef<HTMLDivElement>(null);
  // The window leans back slightly and settles flat as it scrolls into view.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 30%'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);

  const f = forecast.data;
  const rent = f?.runway.rent;
  const low = f?.runway.lowest;

  return (
    <Container className="mt-20 [perspective:2400px]" >
      <motion.div ref={ref} id="forecast" style={{ rotateX, scale }} className="origin-top rounded-2xl bg-white shadow-floor">
        <div className="flex items-center gap-4 border-b border-border px-5 py-3.5 text-sm text-neutral-600">
          <span className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-neutral-200" />)}</span>
          <span>{f?.persona ?? 'Forecast'}</span>
          <span className="label-mono ml-auto text-muted-foreground">{f ? `As of ${shortDate(f.from)}` : ''}</span>
        </div>

        <div className="grid gap-12 bg-[radial-gradient(circle,#e3e3e6_1px,transparent_1.3px)] bg-[length:18px_18px] p-8 md:p-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Label className="mb-3">Next 45 days</Label>
            <p className="mb-10 text-4xl font-semibold leading-[1.05] tracking-[-0.035em] md:text-5xl">
              {forecast.error ? "Couldn't load your forecast." : !f ? 'Reading your history…'
                : rent && !rent.covered ? <>You'll be <span className="text-signal">{formatUsd(-rent.balanceAfter)}</span> short for rent.</>
                : `Rent on ${shortDate(rent?.date ?? low!.date)} is covered.`}
            </p>
            <dl className="grid gap-6">
              <Stat label="Tightest day" value={low && <span className="text-signal">{formatUsd(low.balance)}</span>} note={low && shortDate(low.date)} />
              <Stat label="Next rent" value={rent && (rent.covered ? 'Covered' : 'Short')} note={rent && shortDate(rent.date)} />
              <Stat label="History" value="36 months" note={f && `${f.transactions.toLocaleString('en-US')} transactions`} />
            </dl>
          </div>
          <div className="flex items-center lg:col-span-8">{f && <RunwayChart points={f.runway.points} lowest={f.runway.lowest} />}</div>
        </div>
      </motion.div>
    </Container>
  );
}

function Stat({ label, value, note }: { label: string; value?: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div>
      <dt className="label-mono text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-medium tracking-[-0.02em] tabular-nums">
        {value ?? '–'} {note && <span className="ml-2 text-sm font-normal tracking-normal text-muted-foreground">{note}</span>}
      </dd>
    </div>
  );
}
