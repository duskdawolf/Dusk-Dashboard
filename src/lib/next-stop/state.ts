import { createSupabaseAdmin } from './supabase-admin';
import { getRouteContext } from './route-context';
import { buildSourceHash } from './hash';
import type { NextStopCopy, NextStopState, RawEvent } from './types';

export async function getNextStopState(eventId: string): Promise<NextStopState> {
  const route = await getRouteContext(eventId);
  const sourceHash = buildSourceHash(route);
  const currentRaw = route.current.raw as RawEvent;

  const storedSourceHash = typeof currentRaw.next_stop_source_hash === 'string'
    ? currentRaw.next_stop_source_hash : null;
  const storedStatus = typeof currentRaw.next_stop_asset_status === 'string'
    ? currentRaw.next_stop_asset_status : 'not_generated';
  const imageUrl = typeof currentRaw.next_stop_asset_url === 'string'
    ? currentRaw.next_stop_asset_url : null;
  const generatedAt = typeof currentRaw.next_stop_generated_at === 'string'
    ? currentRaw.next_stop_generated_at : null;
  const copy = currentRaw.next_stop_copy && typeof currentRaw.next_stop_copy === 'object'
    ? currentRaw.next_stop_copy as NextStopCopy : null;
  const stale = Boolean(imageUrl && storedSourceHash && storedSourceHash !== sourceHash);

  return {
    route,
    sourceHash,
    storedSourceHash,
    status: stale ? 'stale' : storedStatus as NextStopState['status'],
    stale,
    imageUrl,
    generatedAt,
    copy,
  };
}

export async function markNextStopStatus(eventId: string, status: NextStopState['status']) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from('events').update({ next_stop_asset_status: status }).eq('id', eventId);
  if (error) throw error;
}
