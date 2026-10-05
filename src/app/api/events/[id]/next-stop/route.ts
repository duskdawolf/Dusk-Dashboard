import { NextRequest, NextResponse } from 'next/server';
import { requireAlpha7Admin, alpha7ErrorResponse } from '@/lib/alpha7/auth';
import { generateNextStopCopy } from '@/lib/next-stop/copy';
import { generateNextStopAsset } from '@/lib/next-stop/generate';
import { persistNextStop, saveNextStopCopy } from '@/lib/next-stop/persist';
import { getNextStopState, setNextStopStatus } from '@/lib/next-stop/state';
import type { NextStopCopy } from '@/lib/next-stop/types';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAlpha7Admin();
    const { id } = await context.params;
    return NextResponse.json(await getNextStopState(id));
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = body.action ?? 'generate';
    const state = await getNextStopState(id);

    if (action === 'generate_copy') {
      const copy = await generateNextStopCopy(state.route);
      await saveNextStopCopy(id, copy);
      return NextResponse.json({ ok: true, copy, status: 'stale' });
    }

    await setNextStopStatus(id, 'generating');
    try {
      const asset = await generateNextStopAsset(
        state.route,
        action === 'regenerate_image' ? (state.copy as NextStopCopy | null) : null,
        user.id,
      );
      await persistNextStop(state.route, asset);
      return NextResponse.json({ ok: true, ...asset, status: 'generated' });
    } catch (error) {
      await setNextStopStatus(id, 'failed').catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
