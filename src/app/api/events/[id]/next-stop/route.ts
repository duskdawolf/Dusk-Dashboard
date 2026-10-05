import { NextRequest, NextResponse } from 'next/server';
import { requireDuskAdmin } from '@/lib/next-stop/auth';
import { generateNextStopCopy } from '@/lib/next-stop/copy';
import { generateNextStopAsset } from '@/lib/next-stop/generate';
import { persistGeneratedAsset, saveNextStopCopy } from '@/lib/next-stop/persist';
import { getNextStopState, markNextStopStatus } from '@/lib/next-stop/state';
import type { NextStopCopy } from '@/lib/next-stop/types';

function responseForError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  console.error('[next-stop]', error);
  return NextResponse.json({ error: message || 'Next Stop operation failed.' }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireDuskAdmin();
    const { id } = await context.params;
    return NextResponse.json(await getNextStopState(id));
  } catch (error) {
    return responseForError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireDuskAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as {
      action?: 'generate' | 'regenerate_image' | 'generate_copy' | 'mark_stale';
    };

    const action = body.action ?? 'generate';
    const state = await getNextStopState(id);

    if (action === 'mark_stale') {
      await markNextStopStatus(id, 'stale');
      return NextResponse.json({ ok: true, status: 'stale' });
    }

    if (action === 'generate_copy') {
      const copy = await generateNextStopCopy(state.route);
      await saveNextStopCopy(id, copy);
      return NextResponse.json({ ok: true, copy, status: 'stale' });
    }

    await markNextStopStatus(id, 'generating');
    try {
      const existingCopy = action === 'regenerate_image'
        ? state.copy as NextStopCopy | null
        : null;
      const asset = await generateNextStopAsset(state.route, existingCopy);
      await persistGeneratedAsset(state.route, asset);
      return NextResponse.json({
        ok: true,
        imageUrl: asset.imageUrl,
        copy: asset.copy,
        sourceHash: asset.sourceHash,
        status: 'generated',
      });
    } catch (error) {
      await markNextStopStatus(id, 'failed').catch(() => {});
      throw error;
    }
  } catch (error) {
    return responseForError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireDuskAdmin();
    const { id } = await context.params;
    const body = await request.json() as { copy?: NextStopCopy };
    if (!body.copy) return NextResponse.json({ error: 'copy is required' }, { status: 400 });
    await saveNextStopCopy(id, body.copy);
    return NextResponse.json({ ok: true, status: 'stale' });
  } catch (error) {
    return responseForError(error);
  }
}
