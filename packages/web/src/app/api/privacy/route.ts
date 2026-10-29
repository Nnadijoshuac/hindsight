// GET /api/privacy: fresh NEAR AI Cloud TEE attestation, verified on every request (new nonce each time).
import { connection } from 'next/server';
import { verifyModel } from '@hindsight/verify';
import { PRIVATE_MODEL } from '@/lib/server/config';

export async function GET() {
  await connection(); // always live: a cached attestation would defeat the nonce
  return Response.json(await verifyModel(PRIVATE_MODEL, process.env.NEAR_AI_CLOUD_API_KEY));
}
