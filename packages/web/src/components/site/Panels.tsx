'use client';
// The three proof sections (accuracy, privacy, agent) and the live proof strip above them.
import CountUp from '@/components/CountUp';
import type { Loadable } from '@/lib/api';
import type { ForecastView, PrivacyView, QuoteView, VaultView } from '@/lib/types';
import { formatUsdc } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Container, Split } from './Section';

// Readable names for the attestation checks returned by @hindsight/verify.
const CHECK_LABELS: Record<string, string> = {
  intelQuoteSignature: 'Intel TDX quote is signed by Intel',
  tcbAccepted: 'Hardware firmware is up to date',
  notDebugMode: 'Enclave is not in debug mode',
  nonceAndSignerBound: 'Our fresh nonce and the signing key are bound to the quote',
  nonceEchoed: 'The report answers our own nonce',
  configMeasured: 'Running configuration matches its measurement',
  eventLogMatchesRtmr3: 'Boot event log matches the hardware register',
  gpu: 'NVIDIA GPU runs in confidential mode',
};

function privacyChecks(p?: PrivacyView): [string, boolean][] {
  if (!p) return [];
  const checks = Object.entries(p.models[0]?.checks ?? {});
  return p.hasGpuEvidence ? [...checks, ['gpu', true]] : checks;
}

const Failed = ({ error }: { error?: string }) => error ? <p className="text-signal">Couldn't load: {error}</p> : null;

export function ProofStrip({ forecast, privacy, vault, quote }: {
  forecast: Loadable<ForecastView>; privacy: Loadable<PrivacyView>; vault: Loadable<VaultView>; quote: Loadable<QuoteView>;
}) {
  const checks = privacyChecks(privacy.data);
  const items = [
    ['TEE checks passed', checks.length ? `${checks.filter(([, ok]) => ok).length}/${checks.length}` : '–'],
    ['Forecast error, 24 months', forecast.data ? `${forecast.data.accuracy.at(-1)!.errorPct}%` : '–'],
    ['Vault daily cap', vault.data ? formatUsdc(vault.data.policy.daily_cap) : '–'],
    ['Intents quote, 250 USDC', quote.data ? `${Number(quote.data.quote.amountOutFormatted).toFixed(2)} USDC` : '–'],
  ];
  return (
    <Container className="flex flex-wrap items-center gap-x-10 gap-y-3 py-10 text-sm text-muted-foreground">
      <span className="label-mono flex items-center gap-2 text-foreground"><span className="size-1.5 animate-pulse rounded-full bg-signal" />Live now</span>
      {items.map(([k, v]) => <span key={k}>{k} <b className="ml-1.5 font-medium text-foreground tabular-nums">{v}</b></span>)}
    </Container>
  );
}

export function Accuracy({ forecast }: { forecast: Loadable<ForecastView> }) {
  const rows = forecast.data?.accuracy ?? [];
  const first = rows[0], last = rows.at(-1);
  const worst = Math.max(1, ...rows.map((r) => r.errorPct));
  return (
    <Split id="accuracy" index="01 · Accuracy" strong="It gets sharper" soft="the longer you use it."
      note="3-month cashflow forecast error by months of history. Identical held-out periods, averaged over 8 simulated freelancers. No cherry-picking.">
      <Failed error={forecast.error} />
      {first && last && (
        <>
          <p className="mb-10 text-[clamp(48px,6vw,88px)] font-semibold leading-none tracking-[-0.05em] tabular-nums">
            {first.errorPct}%<span className="mx-3 font-normal text-neutral-300">→</span>
            <CountUp from={first.errorPct} to={last.errorPct} decimals={1} duration={1.6} suffix="%" className="text-signal" />
          </p>
          <div className="grid gap-4">
            {rows.map((r) => (
              <div key={r.trainMonths} className="grid grid-cols-[100px_1fr_64px] items-center gap-4 tabular-nums">
                <span className="label-mono text-muted-foreground">{r.trainMonths} months</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <span className={cn('block h-full rounded-full', r === last ? 'bg-signal' : 'bg-neutral-300')} style={{ width: `${(100 * r.errorPct) / worst}%` }} />
                </span>
                <span className={cn('text-right', r === last && 'font-medium text-signal')}>{r.errorPct}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Split>
  );
}

export function Privacy({ privacy }: { privacy: Loadable<PrivacyView> }) {
  const p = privacy.data;
  const note = privacy.error ? <Failed error={privacy.error} />
    : !p ? 'Fetching a fresh attestation from NEAR AI Cloud…'
    : p.ok ? <><span className="text-signal">Verified just now</span> for {p.model}, against a fresh nonce. If any check fails, Hindsight sends nothing.</>
    : <span className="text-signal">Verification failed, so no data was sent.</span>;
  return (
    <Split id="privacy" index="02 · Privacy" strong="Your data only goes to hardware" soft="we can verify." note={note}>
      <ul className="border-t border-foreground">
        {privacyChecks(p).map(([key, ok]) => (
          <li key={key} className="flex justify-between gap-6 border-b border-border py-4">
            <span>{CHECK_LABELS[key] ?? key}</span>
            <span className={cn('label-mono', ok ? 'text-foreground' : 'text-signal')}>{ok ? 'Pass' : 'Fail'}</span>
          </li>
        ))}
      </ul>
    </Split>
  );
}

export function Agent({ vault, quote }: { vault: Loadable<VaultView>; quote: Loadable<QuoteView> }) {
  const v = vault.data;
  const q = quote.data;
  const note = v
    ? <>Enforced by the NEAR contract <a className="underline decoration-neutral-300 underline-offset-4 hover:decoration-foreground" href={`https://testnet.nearblocks.io/address/${v.account}`} target="_blank" rel="noopener">{v.account}</a>, not by a prompt. Anything outside these rules waits for your approval.</>
    : vault.error ? <Failed error={vault.error} /> : 'Reading the spending policy from NEAR testnet…';
  const stats = v ? [
    ['Daily cap', formatUsdc(v.policy.daily_cap)],
    ['Auto-approve', formatUsdc(v.policy.auto_limit)],
    ['Spent today', formatUsdc(v.policy.spent_today)],
    ['Status', v.policy.frozen ? 'Frozen' : 'Active'],
  ] : [];
  return (
    <Split id="agent" index="03 · Agent" strong="The agent can pay," soft="within your limits." note={note}>
      <dl className="mb-10 grid grid-cols-2 border-t border-foreground md:grid-cols-4">
        {stats.map(([k, val]) => (
          <div key={k} className="pt-4 pb-4">
            <dt className="label-mono text-muted-foreground">{k}</dt>
            <dd className="mt-1.5 text-3xl font-medium tracking-[-0.03em] tabular-nums">{val}</dd>
          </div>
        ))}
      </dl>
      {q && (
        <p className="mb-8 max-w-[56ch] text-lg leading-relaxed">
          To cover the dip, the agent would move <strong>250 USDC from Base to NEAR</strong>. You'd receive {Number(q.quote.amountOutFormatted).toFixed(2)} USDC in about {q.quote.timeEstimate}s.{' '}
          <span className="text-muted-foreground">NEAR Intents {q.quoteRequest.confidentiality === 'basic' ? 'confidential' : 'public'} quote, dry run: nothing moved.</span>
        </p>
      )}
      {v && (v.requests.length ? (
        <table className="w-full text-left">
          <thead><tr className="label-mono text-muted-foreground">{['Payee', 'Amount', 'Memo', 'Outcome'].map((h) => <th key={h} className="border-b border-foreground py-2.5 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {v.requests.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="py-3.5">{r.payee}</td><td className="tabular-nums">{formatUsdc(r.amount)}</td><td>{r.memo}</td>
                <td className={cn(r.status === 'Pending' && 'font-medium text-signal')}>{r.status === 'Pending' ? `Held: ${r.reason}` : r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="label-mono text-muted-foreground">No payment requests yet</p>)}
    </Split>
  );
}
