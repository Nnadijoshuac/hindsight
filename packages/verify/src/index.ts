// @hindsight/verify: NEAR AI Cloud TEE attestation verification.
// Checks Intel TDX quotes (DCAP), nonce + signer binding, measured config (MRCONFIGID) and the
// RTMR3 event log, so user data is only sent to verified confidential hardware.
// Spec: https://docs.near.ai/cloud/verification/reference/quote-nonce-signer.md
import { createHash, randomBytes } from 'node:crypto';
import { getCollateralAndVerify } from '@phala/dcap-qvl';

export const NEAR_AI_BASE = 'https://cloud-api.near.ai/v1';

export interface NearReport {
  signing_address: string;
  signing_algo: 'ecdsa' | 'ed25519';
  intel_quote: string;
  request_nonce: string;
  event_log: unknown;
  info: { tcb_info: unknown };
  nvidia_payload?: string;
  tls_cert_fingerprint?: string;
}

export interface AttestationBundle {
  gateway_attestation: NearReport;
  model_attestations?: NearReport[];
}

export interface CheckResult {
  ok: boolean;
  tcbStatus?: string;
  signer: string;
  checks: Record<string, boolean>;
  error?: string;
}

const hexBytes = (v: string) => Buffer.from(v.replace(/^0x/i, ''), 'hex');
const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);
const hash = (alg: string, ...parts: (Buffer | string)[]) => {
  const h = createHash(alg);
  for (const p of parts) h.update(p);
  return h.digest();
};

export const newNonce = () => randomBytes(32).toString('hex');
export const sha256hex = (data: Buffer | string) => hash('sha256', data).toString('hex');

export function replayRtmr3(eventLog: unknown): Buffer {
  let rtmr3 = Buffer.alloc(48);
  for (const ev of parse(eventLog) as any[]) {
    if (ev.imr !== 3) continue;
    const t = Buffer.alloc(4);
    t.writeUInt32LE(ev.event_type);
    const digest = hash('sha384', t, ':', Buffer.from(ev.event, 'utf8'), ':', hexBytes(ev.event_payload ?? ''));
    if (ev.digest && !hexBytes(ev.digest).equals(digest)) throw new Error(`digest mismatch for event ${ev.event}`);
    rtmr3 = hash('sha384', rtmr3, digest);
  }
  return rtmr3;
}

/** Report-data layout for NEAR-operated reports without TLS binding: identity (zero-padded to 32) || nonce (32). */
export function expectedReportData(report: NearReport, nonceHex: string): Buffer {
  const identity = hexBytes(report.signing_address);
  if (({ ecdsa: 20, ed25519: 32 } as const)[report.signing_algo] !== identity.length) {
    throw new Error('unsupported signing identity');
  }
  const bound = report.tls_cert_fingerprint
    ? hash('sha256', identity, hexBytes(report.tls_cert_fingerprint))
    : Buffer.concat([identity, Buffer.alloc(32 - identity.length)]);
  return Buffer.concat([bound, hexBytes(nonceHex)]);
}

export function expectedMrConfigId(report: NearReport): Buffer {
  const appCompose: string = (parse(report.info.tcb_info) as any).app_compose;
  return Buffer.concat([Buffer.from([1]), hash('sha256', Buffer.from(appCompose, 'utf8')), Buffer.alloc(15)]);
}

export async function checkNearReport(
  report: NearReport,
  nonceHex: string,
  acceptedTcb: string[] = ['UpToDate'],
): Promise<CheckResult> {
  const checks: Record<string, boolean> = {};
  const signer = `${report.signing_algo}:${report.signing_address}`;
  try {
    const verified: any = await getCollateralAndVerify(hexBytes(report.intel_quote));
    checks.intelQuoteSignature = true;
    checks.tcbAccepted = acceptedTcb.includes(verified.status);
    if (verified.report.type !== 'td10') throw new Error('expected a TDX quote');
    const q = verified.report.data;
    checks.notDebugMode = (q.tdAttributes[0] & 1) === 0;
    checks.nonceAndSignerBound = Buffer.from(q.reportData).equals(expectedReportData(report, nonceHex));
    checks.nonceEchoed = report.request_nonce.toLowerCase() === nonceHex.toLowerCase();
    checks.configMeasured = Buffer.from(q.mrConfigId).equals(expectedMrConfigId(report));
    checks.eventLogMatchesRtmr3 = replayRtmr3(report.event_log).equals(Buffer.from(q.rtMr3));
    return { ok: Object.values(checks).every(Boolean), tcbStatus: verified.status, signer, checks };
  } catch (e) {
    return { ok: false, signer, checks, error: (e as Error).message };
  }
}

export async function fetchAttestation(model: string, nonceHex: string, apiKey?: string): Promise<AttestationBundle> {
  const url = new URL(`${NEAR_AI_BASE}/attestation/report`);
  url.search = new URLSearchParams({ model, provider: 'near', signing_algo: 'ecdsa', nonce: nonceHex }).toString();
  const headers: Record<string, string> = { Accept: 'application/json', 'x-no-aliasing': 'true' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`attestation ${res.status}: ${await res.text()}`);
  return (await res.json()) as AttestationBundle;
}

/** Fetch fresh evidence for a model and verify gateway + every model candidate. */
export async function verifyModel(model: string, apiKey?: string) {
  const nonce = newNonce();
  const bundle = await fetchAttestation(model, nonce, apiKey);
  const gateway = await checkNearReport(bundle.gateway_attestation, nonce);
  const candidates = bundle.model_attestations ?? [];
  const models = await Promise.all(candidates.map((c) => checkNearReport(c, nonce)));
  const ok = gateway.ok && models.length > 0 && models.every((m) => m.ok);
  return { model, nonce, ok, gateway, models, hasGpuEvidence: candidates.some((c) => !!c.nvidia_payload) };
}
