import { createSupabaseAdmin } from './supabase-admin';
import type { GeneratedAsset, NextStopCopy, RouteContext } from './types';

export async function persistGeneratedAsset(route: RouteContext, asset: GeneratedAsset) {
  const supabase = createSupabaseAdmin();

  const { error: historyError } = await supabase.from('event_generated_assets').insert({
    event_id: route.current.id,
    owner_user_id: route.current.ownerUserId,
    asset_type: 'next_stop',
    status: 'generated',
    image_path: asset.imagePath,
    image_url: asset.imageUrl,
    copy_json: asset.copy,
    prompt_text: asset.prompt,
    source_hash: asset.sourceHash,
    image_model: asset.imageModel,
    image_size: asset.imageSize,
    metadata: { generator_version: 'v26-alpha7-next-stop-1' },
  });
  if (historyError) throw historyError;

  const { error: eventError } = await supabase.from('events').update({
    next_stop_asset_url: asset.imageUrl,
    next_stop_asset_status: 'generated',
    next_stop_generated_at: new Date().toISOString(),
    next_stop_copy: asset.copy,
    next_stop_source_hash: asset.sourceHash,
  }).eq('id', route.current.id);
  if (eventError) throw eventError;
}

export async function saveNextStopCopy(eventId: string, copy: NextStopCopy) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from('events').update({
    next_stop_copy: copy,
    next_stop_asset_status: 'stale',
  }).eq('id', eventId);
  if (error) throw error;
}
