-- Dusk Industries v24.2
-- Social Ops publishing queue reliability fields.

alter table public.post_platforms
  add column if not exists last_error text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists make_job_id text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists post_platforms_social_queue_idx
  on public.post_platforms(status, scheduled_at);

drop trigger if exists post_platforms_set_updated_at on public.post_platforms;
create trigger post_platforms_set_updated_at
  before update on public.post_platforms
  for each row execute procedure public.set_updated_at();
