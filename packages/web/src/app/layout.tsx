import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const sans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hindsight: private cashflow forecast',
  description:
    'Hindsight forecasts your cashflow from your own history, runs only on verified confidential hardware (NEAR AI Cloud TEE), and lets an AI agent move stablecoins via NEAR Intents within on-chain spending limits.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`}>
      <body className="min-h-full bg-white text-neutral-950">{children}</body>
    </html>
  );
}
