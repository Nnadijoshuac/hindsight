// GET /api/vault: the agent spending policy, read live from the NEAR testnet contract.
import { connection } from 'next/server';
import { VAULT_ACCOUNT } from '@/lib/server/config';
import { viewCall } from '@/lib/server/near';

export async function GET() {
  await connection();
  const [policy, payees, requests] = await Promise.all([
    viewCall('testnet', VAULT_ACCOUNT, 'get_policy'),
    viewCall('testnet', VAULT_ACCOUNT, 'get_payees'),
    viewCall('testnet', VAULT_ACCOUNT, 'get_requests', { from: 0, limit: 20 }),
  ]);
  return Response.json({ account: VAULT_ACCOUNT, policy, payees, requests });
}
