// Read-only NEAR RPC helper for viewing contract state (no keys, no signing).
// FastNEAR's free public RPC (recommended in the hackathon FAQ) answers much faster than the defaults.
const RPC = { testnet: 'https://test.rpc.fastnear.com', mainnet: 'https://free.rpc.fastnear.com' } as const;

export async function viewCall<T>(network: keyof typeof RPC, accountId: string, method: string, args: object = {}): Promise<T> {
  const res = await fetch(RPC[network], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'hindsight',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: accountId,
        method_name: method,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      },
    }),
  });
  const body = await res.json();
  if (body.error || body.result?.error) throw new Error(`view ${method}: ${JSON.stringify(body.error ?? body.result.error)}`);
  return JSON.parse(Buffer.from(body.result.result).toString('utf8')) as T;
}
