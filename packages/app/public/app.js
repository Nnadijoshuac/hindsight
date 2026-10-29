// Hindsight front end: fetches the four API views and renders them. No framework, no build step.

const $ = (id) => document.getElementById(id);
const USDC = 1_000_000; // 6 decimals

const usd = (cents) =>
  `${cents < 0 ? '-' : ''}$${Math.abs(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usdc = (base) => `$${(Number(base) / USDC).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

async function getJson(path) {
  const res = await fetch(path);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

// Readable names for the attestation checks returned by @hindsight/verify.
const CHECK_LABELS = {
  intelQuoteSignature: 'Intel TDX quote is signed by Intel',
  tcbAccepted: 'Hardware firmware is up to date',
  notDebugMode: 'Enclave is not in debug mode',
  nonceAndSignerBound: 'Our fresh nonce and the signing key are bound to the quote',
  nonceEchoed: 'The report answers our own nonce',
  configMeasured: 'Running configuration matches its measurement',
  eventLogMatchesRtmr3: 'Boot event log matches the hardware register',
};

// ---- forecast ----

function renderForecast(f) {
  const { lowest, rent, points } = f.runway;
  $('persona').textContent = f.persona;
  $('window-date').textContent = `As of ${shortDate(f.from)}`;
  $('headline').innerHTML = rent && !rent.covered
    ? `You'll be <span class="attention">${usd(-rent.balanceAfter)}</span> short for rent on ${shortDate(rent.date)}.`
    : `Rent on ${shortDate(rent?.date ?? lowest.date)} is covered.`;

  $('stat-low').innerHTML = `<span class="attention">${usd(lowest.balance)}</span><small>${shortDate(lowest.date)}</small>`;
  $('stat-rent').innerHTML = rent ? `${rent.covered ? 'Covered' : 'Short'}<small>${shortDate(rent.date)}</small>` : '–';
  $('stat-history').innerHTML = `36 months<small>${f.transactions.toLocaleString('en-US')} transactions</small>`;

  drawRunway(points, lowest);
  renderAccuracy(f.accuracy);
}

// Balance line inside the product window, with the tightest day marked in green.
function drawRunway(points, lowest) {
  const W = 800, H = 260, TOP = 16, BOTTOM = 28;
  const values = points.map((p) => p.balance);
  const min = Math.min(0, ...values), max = Math.max(...values);
  const x = (i) => (i / (points.length - 1)) * W;
  const y = (v) => TOP + (1 - (v - min) / (max - min)) * (H - TOP - BOTTOM);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
  const low = points.findIndex((p) => p.date === lowest.date); // JSON copies, so match by date
  const base = H - BOTTOM;
  const labelAnchor = low > points.length * 0.7 ? 'end' : 'start';

  $('runway-chart').innerHTML = `
    <line class="grid" x1="0" x2="${W}" y1="${base}" y2="${base}" />
    <path class="area" d="${line} L${W},${base} L0,${base} Z" />
    <path class="line" d="${line}" />
    <line class="marker" x1="${x(low)}" x2="${x(low)}" y1="${TOP}" y2="${base}" />
    <circle class="low" cx="${x(low)}" cy="${y(lowest.balance)}" r="5" />
    <text class="low-label" x="${x(low) + (labelAnchor === 'start' ? 10 : -10)}" y="${TOP + 10}" text-anchor="${labelAnchor}">TIGHTEST · ${usd(lowest.balance)}</text>
    <text x="0" y="${H - 6}">${shortDate(points[0].date).toUpperCase()}</text>
    <text x="${W}" y="${H - 6}" text-anchor="end">${shortDate(points.at(-1).date).toUpperCase()}</text>`;
}

function renderAccuracy(rows) {
  const first = rows[0], last = rows.at(-1);
  const worst = Math.max(...rows.map((r) => r.errorPct));
  $('accuracy-figure').innerHTML = `${first.errorPct}%<span class="to">→</span><span class="attention">${last.errorPct}%</span>`;
  $('accuracy').innerHTML = `<div class="bars">${rows
    .map((r) => `
      <div class="bar-row${r === last ? ' best' : ''}">
        <span class="mono muted">${r.trainMonths} months</span>
        <span class="track"><span class="fill" style="width:${(100 * r.errorPct) / worst}%"></span></span>
        <span class="value">${r.errorPct}%</span>
      </div>`)
    .join('')}</div>`;
  $('proof-error').textContent = `${last.errorPct}%`;
}

// ---- privacy ----

function renderPrivacy(p) {
  const model = p.models[0];
  const checks = Object.entries(model?.checks ?? {});
  if (p.hasGpuEvidence) checks.push(['gpu', true]);
  const passed = checks.filter(([, ok]) => ok).length;

  $('privacy-checks').innerHTML = checks
    .map(([key, ok]) => `<li><span>${key === 'gpu' ? 'NVIDIA GPU runs in confidential mode' : CHECK_LABELS[key] ?? key}</span>
      <span class="${ok ? 'ok' : 'fail'}">${ok ? 'PASS' : 'FAIL'}</span></li>`)
    .join('');

  const chip = $('privacy-status');
  chip.textContent = p.ok ? 'hardware verified' : 'verification failed';
  chip.classList.toggle('verified', p.ok);
  $('proof-checks').textContent = `${passed}/${checks.length}`;
  $('privacy-note').innerHTML = p.ok
    ? `<span class="attention">Verified just now</span> for ${p.model}, against a fresh nonce. If any check fails, Hindsight sends nothing.`
    : '<span class="attention">Verification failed, so no data was sent.</span>';
}

// ---- agent vault + intents ----

function renderVault(v) {
  const { policy } = v;
  const stats = [
    ['Daily cap', usdc(policy.daily_cap)],
    ['Auto-approve', usdc(policy.auto_limit)],
    ['Spent today', usdc(policy.spent_today)],
    ['Status', policy.frozen ? 'Frozen' : 'Active'],
  ];
  $('policy').innerHTML = stats.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join('');
  $('proof-cap').textContent = usdc(policy.daily_cap);
  $('vault-note').innerHTML =
    `Enforced by the NEAR contract <a href="https://testnet.nearblocks.io/address/${v.account}" target="_blank" rel="noopener"><u>${v.account}</u></a>, ` +
    'not by a prompt. Anything outside these rules waits for your approval.';

  $('requests').innerHTML = v.requests.length
    ? `<table>
        <tr><th>Payee</th><th>Amount</th><th>Memo</th><th>Outcome</th></tr>
        ${v.requests.map((r) => `
          <tr>
            <td>${r.payee}</td><td>${usdc(r.amount)}</td><td>${r.memo}</td>
            <td class="${r.status === 'Pending' ? 'held' : ''}">${r.status === 'Pending' ? `Held: ${r.reason}` : r.status}</td>
          </tr>`).join('')}
      </table>`
    : '<p class="mono muted">No payment requests yet</p>';
}

function renderQuote(q) {
  const mode = q.quoteRequest.confidentiality === 'basic' ? 'confidential' : 'public';
  const received = Number(q.quote.amountOutFormatted).toFixed(2);
  $('proof-quote').textContent = `${received} USDC`;
  $('quote').innerHTML =
    `To cover the dip, the agent would move <strong>250 USDC from Base to NEAR</strong>. ` +
    `You'd receive ${received} USDC in about ${q.quote.timeEstimate}s. <span class="muted">NEAR Intents ${mode} quote, dry run: nothing moved.</span>`;
}

// Each panel loads on its own, so one slow network call never blocks the rest.
const panels = [
  ['/api/forecast', renderForecast, 'headline'],
  ['/api/privacy', renderPrivacy, 'privacy-note'],
  ['/api/vault', renderVault, 'vault-note'],
  ['/api/quote', renderQuote, 'quote'],
];
for (const [path, render, fallbackId] of panels) {
  getJson(path).then(render).catch((err) => {
    $(fallbackId).innerHTML = `<span class="attention">Couldn't load: ${err.message}</span>`;
  });
}
