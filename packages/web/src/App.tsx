// Hindsight landing page: private cashflow forecast, NEAR AI Cloud TEE proof, and on-chain agent limits.
import { useApi, type ForecastView, type PrivacyView, type QuoteView, type VaultView } from '@/lib/api';
import { Footer, Nav } from '@/components/site/Chrome';
import { Hero } from '@/components/site/Hero';
import { HistoryGrid } from '@/components/site/HistoryGrid';
import { Accuracy, Agent, Privacy, ProofStrip } from '@/components/site/Panels';

export default function App() {
  const forecast = useApi<ForecastView>('/api/forecast');
  const privacy = useApi<PrivacyView>('/api/privacy');
  const vault = useApi<VaultView>('/api/vault');
  const quote = useApi<QuoteView>('/api/quote');

  return (
    <>
      <Nav />
      <Hero forecast={forecast} privacy={privacy} />
      <ProofStrip forecast={forecast} privacy={privacy} vault={vault} quote={quote} />
      <HistoryGrid forecast={forecast.data} />
      <Accuracy forecast={forecast} />
      <Privacy privacy={privacy} />
      <Agent vault={vault} quote={quote} />
      <Footer />
    </>
  );
}
