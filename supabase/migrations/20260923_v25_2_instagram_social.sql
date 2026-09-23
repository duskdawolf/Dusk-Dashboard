-- Dusk Industries v25.2
-- Instagram live provider + optional canonical deployment-link captions.

alter table public.social_provider_connections
  drop constraint if exists social_provider_connections_platform_check;

alter table public.social_provider_connections
  add constraint social_provider_connections_platform_check
  check (platform in ('twitter', 'instagram'));

alter table public.posts
  add column if not exists include_deployment_link boolean not null default false;

create index if not exists social_provider_connections_instagram_idx
  on public.social_provider_connections(user_id, platform)
  where platform = 'instagram';
