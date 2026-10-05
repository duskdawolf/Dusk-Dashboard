export type BrandAssetKind = 'mascot_art' | 'logo' | 'style_ref';

export type BrandAsset = {
  id: string;
  user_id: string;
  label: string;
  asset_kind: BrandAssetKind;
  storage_path: string;
  mime_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UserBrandSettings = {
  user_id: string;
  primary_mascot_asset_id: string | null;
  secondary_mascot_asset_id: string | null;
  logo_asset_id: string | null;
  use_brand_assets_in_next_stop: boolean;
  composite_mascot: boolean;
  composite_logo: boolean;
  mascot_scale: number;
  logo_scale: number;
  mascot_placement: 'hero_left' | 'hero_right' | 'center_low';
  logo_placement: 'footer_right' | 'footer_left' | 'header_right' | 'off';
  updated_at?: string;
  created_at?: string;
};

export type BrandConfig = {
  settings: UserBrandSettings | null;
  assets: BrandAsset[];
  primaryMascot: BrandAsset | null;
  secondaryMascot: BrandAsset | null;
  logo: BrandAsset | null;
};
