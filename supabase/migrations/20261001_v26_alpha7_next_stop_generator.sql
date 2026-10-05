-- Dusk Induskries v26 Alpha 7
-- Next Stop Generator
-- Run this whole file in Supabase SQL Editor.

begin;

alter table public.events
  add column if not exists route_visible boolean not null default true,
  add column if not exists route_order integer,
  add column if not exists event_theme text,
  add column if not exists find_me_notes text,
  add column if not exists appearance_mode text,
  add column if not exists next_stop_asset_url text,
  add column if not exists next_stop_asset_status text not null default 'not_generated',
  add column if not exists next_stop_generated_at timestamptz,
  add column if not exists next_stop_copy jsonb,
  add column if not exists next_stop_source_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_next_stop_asset_status_check'
  ) then
    alter table public.events
      add constraint events_next_stop_asset_status_check
      check (next_stop_asset_status in (
        'not_generated','generating','generated','stale','failed'
      ));
  end if;
end $$;

create index if not exists events_route_visible_order_idx
  on public.events(route_visible, route_order);

create table if not exists public.event_generated_assets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  asset_type text not null default 'next_stop' check (asset_type in ('next_stop')),
  status text not null default 'generated' check (status in ('generated','superseded','failed')),
  image_path text,
  image_url text,
  copy_json jsonb not null default '{}'::jsonb,
  prompt_text text,
  source_hash text,
  image_model text,
  image_size text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists event_generated_assets_event_idx
  on public.event_generated_assets(event_id, created_at desc);

alter table public.event_generated_assets enable row level security;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'next-stop-assets',
  'next-stop-assets',
  true,
  12582912,
  array['image/webp','image/png']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
