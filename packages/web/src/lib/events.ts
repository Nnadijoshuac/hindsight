// Turns raw bank descriptions ("RENT LANDLORD LTD") into short display names ("Rent").
const NOISE = new Set(['LTD', 'SUBSCRIPTION', 'PLAN', 'UTILITY', 'LANDLORD', 'CLIENT']);

export function eventLabel(description: string): string {
  const words = description.split(/\s+/).filter((w) => !NOISE.has(w));
  return words.map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');
}
