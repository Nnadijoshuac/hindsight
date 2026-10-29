// Hindsight landing page: private cashflow forecast, NEAR AI Cloud TEE proof, and on-chain agent limits.
// The forecast is deterministic demo data, so it is computed at build time and prerendered.
import { Landing } from '@/components/site/Landing';
import { buildForecast } from '@/lib/server/forecast';

export default function Home() {
  return <Landing forecast={buildForecast()} />;
}
