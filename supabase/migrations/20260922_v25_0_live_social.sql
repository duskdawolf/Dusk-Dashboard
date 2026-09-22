-- Dusk Industries v25.0
-- Live Social Publishing: provider receipt snapshots.

alter table public.post_platforms
  add column if not exists provider_account text,
  add column if not exists published_caption text,
  add column if not exists published_media jsonb not null default '[]'::jsonb,
  add column if not exists provider_response jsonb not null default '{}'::jsonb,
  add column if not exists last_provider_check timestamptz;

create index if not exists post_platforms_provider_status_idx
  on public.post_platforms(platform, status, scheduled_at);
