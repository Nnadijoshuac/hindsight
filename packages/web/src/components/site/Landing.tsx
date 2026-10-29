'use client';
// Client shell for the landing page. The forecast arrives prerendered from the server;
// privacy, vault and quote are live and load in the browser.
import { useApi } from '@/lib/api';
import type { ForecastView, InsightView, PrivacyView, QuoteView, VaultView } from '@/lib/types';
import { Footer, Nav } from './Chrome';
import { Hero } from './Hero';
import { HistoryGrid } from './HistoryGrid';
import { Accuracy, Agent, Privacy, ProofStrip } from './Panels';

export function Landing({ forecast }: { forecast: ForecastView }) {
  const privacy = useApi<PrivacyView>('/api/privacy');
  const vault = useApi<VaultView>('/api/vault');
  const quote = useApi<QuoteView>('/api/quote');
  const insight = useApi<InsightView>('/api/insight');
  const loaded = { data: forecast };

  return (
    <>
      <Nav />
      <Hero forecast={forecast} privacy={privacy} quote={quote} />
      <ProofStrip forecast={loaded} privacy={privacy} vault={vault} quote={quote} />
      <HistoryGrid forecast={forecast} />
      <Accuracy forecast={loaded} />
      <Privacy privacy={privacy} insight={insight} />
      <Agent vault={vault} quote={quote} />
      <Footer />
    </>
  );
}
