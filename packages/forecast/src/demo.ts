// The demo panel: Ada plus seven other simulated freelancers, 36 months each, ending Oct 2026.
import { demoPersona } from './data.ts';

export const DEMO_START = '2023-11-01';
export const DEMO_MONTHS = 36;
export const DEMO_SEEDS = [7, 1, 2, 3, 4, 5, 6, 8];
export const DEMO_START_BALANCE = 145_000; // $1,450.00

export const demoAda = () => demoPersona(DEMO_MONTHS, DEMO_START, DEMO_SEEDS[0]);
export const demoPanel = () => DEMO_SEEDS.map((seed) => demoPersona(DEMO_MONTHS, DEMO_START, seed));
