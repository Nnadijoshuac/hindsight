// Display helpers. Money formatting is shared with the forecast package so it is defined once.
export { formatUsd } from '@hindsight/forecast';

const USDC_DECIMALS = 1_000_000;

/** USDC base units (6 decimals) -> "$100". */
export const formatUsdc = (base: string | number) =>
  `$${(Number(base) / USDC_DECIMALS).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** "2026-11-13" -> "Nov 13". */
export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "2026-11" -> "Nov 2026". */
export const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
