// Small date and statistics helpers shared by the model and the demo data.

export const DAY_MS = 86_400_000;

// ---- dates (ISO strings: "YYYY-MM-DD" for days, "YYYY-MM" for months) ----

export const monthKey = (date: string) => date.slice(0, 7);
export const dayOfMonth = (date: string) => Number(date.slice(8, 10));
export const monthIndex = (month: string) => Number(month.slice(5, 7)) - 1; // 0 = January

export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

export function addMonths(month: string, count: number): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1 + count, 1)).toISOString().slice(0, 7);
}

/** Sorted, de-duplicated list of the months that appear in `dates`. */
export const distinctMonths = (dates: string[]) => [...new Set(dates.map(monthKey))].sort();

// ---- statistics ----

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => sum(xs) / xs.length;

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdDev(xs: number[]): number {
  const mu = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - mu) ** 2)));
}

export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

// ---- formatting ----

/** Cents -> "$1,234.56" (or "-$1,234.56"). */
export function formatUsd(cents: number): string {
  const dollars = Math.abs(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? '-' : ''}$${dollars}`;
}

/** "GROCERY MART" -> "Grocery Mart". */
export const titleCase = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
