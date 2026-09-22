-- Dusk Industries v10
-- Media + Social Posts + Con Prep + Make integration fields.

-- EVENTS ------------------------------------------------------------
alter table public.events
  add column if not exists external_id text;

create unique index if not exists events_external_id_unique
  on public.events(external_id)
  where external_id is not null;

-- MEDIA -------------------------------------------------------------
alter table public.media
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists caption text;

insert into storage.buckets (id, name, public)
values ('public-media', 'public-media', true)
on conflict (id) do update set public = true;

-- POSTS -------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  title text not null,
  master_caption text not null,
  status text not null default 'draft'
    check (status in ('draft','approved','scheduled','published','failed')),
  scheduled_at timestamptz,
  approved_at timestamptz,
  automation_status text,
  make_job_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  sort_order integer not null default 0,
  unique(post_id, media_id)
);

create table if not exists public.post_platforms (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  platform text not null
    check (platform in ('telegram','twitter','instagram','snapchat')),
  platform_post_id text,
  platform_caption_override text,
  status text not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  post_url text,
  created_at timestamptz not null default now(),
  unique(post_id, platform)
);

create table if not exists public.post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_platform_id uuid not null references public.post_platforms(id) on delete cascade,
  captured_at timestamptz not null default now(),
  impressions bigint,
  reach bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  clicks bigint,
  video_views bigint,
  watch_time_seconds bigint,
  followers_gained bigint
);

-- CON PREP ----------------------------------------------------------
create table if not exists public.con_preps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  status text not null default 'planning'
    check (status in ('planning','ready','traveling','complete')),
  target_arrival_at timestamptz,
  leave_for_airport_at timestamptz,
  packing_deadline timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packing_items (
  id uuid primary key default gen_random_uuid(),
  con_prep_id uuid not null references public.con_preps(id) on delete cascade,
  category text not null,
  label text not null,
  quantity integer not null default 1,
  packed boolean not null default false,
  sort_order integer not null default 0,
  notes text
);

create table if not exists public.prep_tasks (
  id uuid primary key default gen_random_uuid(),
  con_prep_id uuid not null references public.con_preps(id) on delete cascade,
  title text not null,
  task_type text not null default 'prep',
  due_at timestamptz,
  duration_minutes integer,
  status text not null default 'todo'
    check (status in ('todo','scheduled','doing','done','skipped')),
  calendar_event_id text,
  clickup_task_id text,
  make_job_id text,
  notes text
);

create table if not exists public.travel_segments (
  id uuid primary key default gen_random_uuid(),
  con_prep_id uuid not null references public.con_preps(id) on delete cascade,
  kind text not null default 'flight'
    check (kind in ('flight','train','bus','car','rideshare','other')),
  provider text,
  confirmation_code text,
  origin text,
  destination text,
  depart_at timestamptz,
  arrive_at timestamptz,
  cost_cents integer,
  currency text not null default 'USD',
  calendar_event_id text,
  quickbooks_txn_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.hotel_stays (
  id uuid primary key default gen_random_uuid(),
  con_prep_id uuid not null references public.con_preps(id) on delete cascade,
  hotel_name text not null,
  address text,
  confirmation_code text,
  checkin_at timestamptz,
  checkout_at timestamptz,
  cost_cents integer,
  currency text not null default 'USD',
  calendar_event_id text,
  quickbooks_txn_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  window_type text not null default 'general'
    check (window_type in ('general','packing','printing','prep')),
  active boolean not null default true
);

create table if not exists public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  con_prep_id uuid references public.con_preps(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  category text not null,
  vendor text,
  description text,
  amount_cents integer not null,
  currency text not null default 'USD',
  incurred_at timestamptz not null default now(),
  quickbooks_txn_id text,
  source text not null default 'manual'
    check (source in ('manual','make','quickbooks','stripe')),
  created_at timestamptz not null default now()
);

-- Updated-at triggers
drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute procedure public.set_updated_at();

drop trigger if exists con_preps_set_updated_at on public.con_preps;
create trigger con_preps_set_updated_at
  before update on public.con_preps
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_platforms enable row level security;
alter table public.post_metrics enable row level security;
alter table public.con_preps enable row level security;
alter table public.packing_items enable row level security;
alter table public.prep_tasks enable row level security;
alter table public.travel_segments enable row level security;
alter table public.hotel_stays enable row level security;
alter table public.availability_windows enable row level security;
alter table public.cost_entries enable row level security;

-- Public posts are intentionally NOT readable yet.
-- Dashboard writes/read use the server-only Supabase secret after auth checks.
