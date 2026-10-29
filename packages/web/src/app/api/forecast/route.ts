// GET /api/forecast: Ada's deterministic demo forecast. No runtime data, so Next.js prerenders it.
import { buildForecast } from '@/lib/server/forecast';

export async function GET() {
  return Response.json(buildForecast());
}
