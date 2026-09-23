-- Dusk Industries v25.3
-- Live Bluesky publishing.

alter table public.post_platforms
  drop constraint if exists post_platforms_platform_check;

alter table public.post_platforms
  add constraint post_platforms_platform_check
  check (platform in ('telegram','twitter','instagram','bluesky','snapchat'));
