import { NextResponse } from 'next/server';
import { getApi } from '@/lib/chain';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const api = await getApi();
    const block = await api.query.system.number();
    const runtimeVersion = api.runtimeVersion;

    return NextResponse.json({
      ok: true,
      endpoint: process.env.CHAIN_WS_URL ?? 'wss://rpc.polkadot.io',
      block: Number(block.toString()),
      genesisHash: api.genesisHash.toHex(),
      chainId: String(runtimeVersion.specVersion.toString()),
      specVersion: Number(runtimeVersion.specVersion.toString()),
      metadataVersion: Number(runtimeVersion.transactionVersion.toString()),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 503 }
    );
  }
}
