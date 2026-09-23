-- Dusk Industries v25.1
-- X OAuth 2.0 connection storage.

create table if not exists public.social_provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('twitter')),
  provider_user_id text,
  username text,
  display_name text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_type text not null default 'bearer',
  scope text,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, platform)
);

create index if not exists social_provider_connections_platform_idx
  on public.social_provider_connections(platform, user_id);

drop trigger if exists social_provider_connections_set_updated_at
  on public.social_provider_connections;

create trigger social_provider_connections_set_updated_at
  before update on public.social_provider_connections
  for each row execute procedure public.set_updated_at();

alter table public.social_provider_connections enable row level security;

-- Intentionally no client-side policies. OAuth secrets are server-side only.
