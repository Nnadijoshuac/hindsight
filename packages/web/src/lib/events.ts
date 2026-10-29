import { titleCase } from '@hindsight/forecast';

// Turns raw bank descriptions ("RENT LANDLORD LTD") into short display names ("Rent").
const NOISE = new Set(['LTD', 'SUBSCRIPTION', 'PLAN', 'UTILITY', 'LANDLORD', 'CLIENT']);

export function eventLabel(description: string): string {
  const words = description.split(/\s+/).filter((w) => !NOISE.has(w));
  return titleCase(words.join(' '));
}
