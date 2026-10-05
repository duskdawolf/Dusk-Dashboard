-- Dusk Induskries v26 Alpha 7.1
-- Brand Reference Assets for Next Stop
-- Safe additive migration for projects already running Alpha 7.

begin;

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  asset_kind text not null check (asset_kind in ('mascot_art','logo','style_ref')),
  storage_path text not null,
  mime_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists brand_assets_user_idx
  on public.brand_assets(user_id, asset_kind, created_at desc);

alter table public.brand_assets enable row level security;

create table if not exists public.user_brand_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  primary_mascot_asset_id uuid references public.brand_assets(id) on delete set null,
  secondary_mascot_asset_id uuid references public.brand_assets(id) on delete set null,
  logo_asset_id uuid references public.brand_assets(id) on delete set null,
  use_brand_assets_in_next_stop boolean not null default true,
  composite_mascot boolean not null default true,
  composite_logo boolean not null default true,
  mascot_scale numeric not null default 1.0,
  logo_scale numeric not null default 1.0,
  mascot_placement text not null default 'hero_left'
    check (mascot_placement in ('hero_left','hero_right','center_low')),
  logo_placement text not null default 'footer_right'
    check (logo_placement in ('footer_right','footer_left','header_right','off')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_brand_settings enable row level security;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'dusk-brand-assets',
  'dusk-brand-assets',
  false,
  12582912,
  array['image/png','image/webp','image/jpeg']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
