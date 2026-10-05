import { randomUUID } from 'node:crypto';
import { createAlpha7SupabaseAdmin } from '@/lib/alpha7/supabase-admin';
import type { BrandAsset, BrandAssetKind, BrandConfig, UserBrandSettings } from './types';

const BUCKET = 'dusk-brand-assets';

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function listBrandAssets(userId: string): Promise<BrandAsset[]> {
  const supabase = createAlpha7SupabaseAdmin();
  const { data, error } = await supabase
    .from('brand_assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrandAsset[];
}

export async function getBrandSettings(userId: string): Promise<UserBrandSettings | null> {
  const supabase = createAlpha7SupabaseAdmin();
  const { data, error } = await supabase
    .from('user_brand_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data as UserBrandSettings),
    mascot_scale: numberOr((data as any).mascot_scale, 1),
    logo_scale: numberOr((data as any).logo_scale, 1),
  };
}

export async function getBrandConfig(userId: string): Promise<BrandConfig> {
  const [assets, settings] = await Promise.all([
    listBrandAssets(userId),
    getBrandSettings(userId),
  ]);
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return {
    settings,
    assets,
    primaryMascot: settings?.primary_mascot_asset_id ? byId.get(settings.primary_mascot_asset_id) ?? null : null,
    secondaryMascot: settings?.secondary_mascot_asset_id ? byId.get(settings.secondary_mascot_asset_id) ?? null : null,
    logo: settings?.logo_asset_id ? byId.get(settings.logo_asset_id) ?? null : null,
  };
}

export async function uploadBrandAsset(args: {
  userId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  assetKind: BrandAssetKind;
  label: string;
}) {
  const supabase = createAlpha7SupabaseAdmin();
  const ext = args.fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'img';
  const storagePath = `${args.userId}/${Date.now()}-${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, args.bytes, {
      contentType: args.mimeType,
      cacheControl: '31536000',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('brand_assets')
    .insert({
      user_id: args.userId,
      label: args.label,
      asset_kind: args.assetKind,
      storage_path: storagePath,
      mime_type: args.mimeType,
      metadata: { original_name: args.fileName },
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as BrandAsset;
}

export async function updateBrandSettings(userId: string, patch: Partial<UserBrandSettings>) {
  const supabase = createAlpha7SupabaseAdmin();
  const row = {
    user_id: userId,
    primary_mascot_asset_id: patch.primary_mascot_asset_id ?? null,
    secondary_mascot_asset_id: patch.secondary_mascot_asset_id ?? null,
    logo_asset_id: patch.logo_asset_id ?? null,
    use_brand_assets_in_next_stop: patch.use_brand_assets_in_next_stop ?? true,
    composite_mascot: patch.composite_mascot ?? true,
    composite_logo: patch.composite_logo ?? true,
    mascot_scale: patch.mascot_scale ?? 1,
    logo_scale: patch.logo_scale ?? 1,
    mascot_placement: patch.mascot_placement ?? 'hero_left',
    logo_placement: patch.logo_placement ?? 'footer_right',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('user_brand_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as UserBrandSettings;
}

export async function downloadBrandAssetBuffer(storagePath: string) {
  const supabase = createAlpha7SupabaseAdmin();
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
