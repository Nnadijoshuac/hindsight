'use client';
// Hero: the one question freelancers actually ask, then the product answering it with real numbers.
import { Button } from '@/components/ui/button';
import type { Loadable } from '@/lib/api';
import type { ForecastView, PrivacyView, QuoteView } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AppWindow } from './AppWindow';
import { Container, Heading, Label } from './Section';

export function Hero({ forecast, privacy, quote }: { forecast: ForecastView; privacy: Loadable<PrivacyView>; quote: Loadable<QuoteView> }) {
  const verified = privacy.data?.ok;
  const status = privacy.error ? 'unverified' : verified === undefined ? 'checking…' : verified ? 'hardware verified' : 'verification failed';
  return (
    <header className="pt-16 md:pt-24">
      <Container>
        <div className="grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="mb-7 flex items-center gap-3">
              <Label>Confidential AI</Label>
              <span className={cn('label-mono rounded px-2 py-0.5', verified ? 'bg-signal-wash text-signal' : 'bg-muted text-muted-foreground')}>{status}</span>
            </div>
            <Heading as="h1" strong="Know if you'll make rent." soft="Before it becomes a problem."
              className="text-[clamp(38px,4.2vw,60px)] leading-[1.02] tracking-[-0.04em]" />
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="mb-7 text-[17px] leading-relaxed text-neutral-600">
              Hindsight forecasts your cashflow from your own history. The more you give it, the sharper it gets, and it only runs on hardware we can prove nobody can read.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild><a href="#forecast">See your forecast</a></Button>
              <Button size="lg" variant="outline" asChild><a href="#privacy">How privacy is proven</a></Button>
            </div>
          </div>
        </div>
      </Container>
      <Container className="mt-16 md:mt-20">
        <AppWindow forecast={forecast} privacy={privacy} quote={quote} />
      </Container>
    </header>
  );
}
