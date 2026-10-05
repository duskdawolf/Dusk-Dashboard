-- Dusk Induskries v26 Alpha 7 COMPLETE
-- Safe to run even if you already ran the first Alpha 7 Next Stop SQL.
-- This script is additive/rerun-safe.
--
-- Adds:
--   1) Missing Alpha 6 scope: Chaos record-update + image attachment foundation
--   2) Ensures Alpha 7 Next Stop schema exists
--
-- Run this WHOLE file in Supabase SQL Editor.

begin;

-- ============================================================
-- FIRST ALPHA 7: ensure Next Stop fields/tables exist
-- ============================================================

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
      check (
        next_stop_asset_status in
          ('not_generated','generating','generated','stale','failed')
      );
  end if;
end $$;

create index if not exists events_route_visible_order_idx
  on public.events(route_visible, route_order);

create table if not exists public.event_generated_assets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  asset_type text not null default 'next_stop'
    check (asset_type in ('next_stop')),
  status text not null default 'generated'
    check (status in ('generated','superseded','failed')),
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

-- Public final posters
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

-- ============================================================
-- MISSING ALPHA 6: attachments + typed record actions
-- ============================================================

create table if not exists public.copilot_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid references public.copilot_threads(id) on delete cascade,
  con_prep_id uuid references public.con_preps(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  original_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  extracted_json jsonb not null default '{}'::jsonb,
  analysis_model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists copilot_attachments_user_idx
  on public.copilot_attachments(user_id, created_at desc);

create index if not exists copilot_attachments_prep_idx
  on public.copilot_attachments(con_prep_id, created_at desc);

alter table public.copilot_attachments enable row level security;

alter table public.copilot_actions
  add column if not exists event_id uuid references public.events(id) on delete set null,
  add column if not exists attachment_id uuid references public.copilot_attachments(id) on delete set null;

create index if not exists copilot_actions_event_idx
  on public.copilot_actions(event_id, status, created_at desc);

create index if not exists copilot_actions_attachment_idx
  on public.copilot_actions(attachment_id);

-- Private source screenshots / confirmations.
-- Server-side routes use the Supabase secret key, so no public Storage policy
-- is required or created for this bucket.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'copilot-attachments',
  'copilot-attachments',
  false,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
