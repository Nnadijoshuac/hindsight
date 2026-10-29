// Site navigation and footer.
import { Button } from '@/components/ui/button';
import { Container } from './Section';

const REPO = 'https://github.com/Nnadijoshuac/hindsight';

export function Nav() {
  return (
    <nav className="sticky top-0 z-20 border-b border-transparent bg-white/80 backdrop-blur-md">
      <Container className="flex h-18 items-center gap-10">
        <a href="#" className="text-lg font-semibold tracking-[-0.02em]">Hindsight</a>
        <div className="mr-auto hidden gap-8 text-[15px] text-neutral-600 md:flex">
          {['Accuracy', 'Privacy', 'Agent'].map((s) => <a key={s} href={`#${s.toLowerCase()}`} className="hover:text-foreground">{s}</a>)}
          <a href={REPO} target="_blank" rel="noopener" className="hover:text-foreground">GitHub</a>
        </div>
        <Button className="ml-auto md:ml-0" asChild><a href="#forecast">See your forecast</a></Button>
      </Container>
    </nav>
  );
}

const FOOTER_LINKS: [string, [string, string][]][] = [
  ['Product', [['Forecast', '#forecast'], ['Accuracy', '#accuracy'], ['Privacy proof', '#privacy'], ['Agent limits', '#agent']]],
  ['Build', [['Source code', REPO], ['AGENTS.md', `${REPO}/blob/main/AGENTS.md`], ['Feasibility report', `${REPO}/blob/main/docs/FEASIBILITY.md`], ['MIT license', `${REPO}/blob/main/LICENSE`]]],
  ['Built on', [['NEAR AI Cloud', 'https://near.ai'], ['NEAR Intents', 'https://near-intents.org'], ['NEAR Protocol', 'https://near.org'], ['NEAR HACKATHON', 'https://nearhackathon.com']]],
];

export function Footer() {
  return (
    <footer className="border-t border-border pt-20">
      <Container>
        <div className="grid gap-12 pb-20 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="mb-4 text-lg font-semibold tracking-[-0.02em]">Hindsight</p>
            <p className="max-w-[36ch] text-muted-foreground">Foresight from your own hindsight. A private cashflow forecaster that gets sharper with your history and proves where your data goes.</p>
          </div>
          {FOOTER_LINKS.map(([title, links]) => (
            <div key={title} className="md:col-span-2">
              <p className="label-mono mb-5 text-muted-foreground">{title}</p>
              <ul className="grid gap-3 text-[15px]">
                {links.map(([label, href]) => (
                  <li key={label}><a href={href} className="text-neutral-600 hover:text-foreground" {...(href.startsWith('http') && { target: '_blank', rel: 'noopener' })}>{label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
      {/* The wordmark, set large and cropped by the page edge: a quiet signature to close on. */}
      <div className="overflow-hidden">
        <Container>
          <p aria-hidden className="select-none text-[clamp(96px,19vw,300px)] font-semibold leading-[0.78] tracking-[-0.06em] text-neutral-100">Hindsight</p>
        </Container>
      </div>
      <Container className="flex flex-wrap justify-between gap-4 border-t border-border py-6 text-sm text-muted-foreground">
        <span>Demo data is simulated. Testnet contract, dry-run quotes: no real funds move.</span>
        <span className="label-mono">NEAR HACKATHON · Nov 2026</span>
      </Container>
    </footer>
  );
}
