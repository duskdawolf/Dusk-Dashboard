-- Dusk Industries v26 Alpha
-- Convention Operations + Chaos Copilot™ foundation.
--
-- New v26 tables are user-scoped where appropriate so they can survive the
-- future multi-profile Beta without a destructive redesign.


-- Future multi-profile Beta groundwork. Alpha behavior remains single-operator.
alter table public.events
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null;
alter table public.media
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null;
alter table public.posts
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null;
alter table public.cost_entries
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null;

create index if not exists events_owner_idx on public.events(owner_user_id);
create index if not exists media_owner_idx on public.media(owner_user_id);
create index if not exists posts_owner_idx on public.posts(owner_user_id);

-- ------------------------------------------------------------------
-- Convention catalog
-- ------------------------------------------------------------------

create table if not exists public.convention_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  series_slug text,
  name text not null,
  abbreviation text,
  edition_year integer,
  start_date date,
  end_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'America/New_York',
  date_precision text not null default 'date_only'
    check (date_precision in ('date_only','exact')),
  city text,
  region text,
  country text not null default 'US',
  venue_name text,
  venue_address text,
  website_url text,
  registration_url text,
  hotel_url text,
  main_hotel_name text,
  main_hotel_address text,
  age_policy text,
  attendance_rank integer,
  verification_status text not null default 'manual'
    check (verification_status in ('official','wikifur','manual','tentative','historical')),
  source_priority integer not null default 30,
  source_url text,
  wikifur_url text,
  wikifur_rank integer,
  latest_attendance integer,
  latest_attendance_year integer,
  wikifur_location_text text,
  data_authority text not null default 'wikifur'
    check (data_authority in ('official','wikifur','manual')),
  verified_at timestamptz,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists convention_catalog_dates_idx
  on public.convention_catalog(start_date, end_date);

-- Compatibility for early v26 Alpha drafts.
alter table public.convention_catalog
  add column if not exists attendance_rank integer,
  add column if not exists source_priority integer not null default 30;

alter table public.convention_catalog
  drop constraint if exists convention_catalog_verification_status_check;

alter table public.convention_catalog
  add constraint convention_catalog_verification_status_check
  check (verification_status in ('official','wikifur','manual','tentative','historical'));

-- ------------------------------------------------------------------
-- Deployment ownership / catalog linkage
-- ------------------------------------------------------------------

alter table public.con_preps
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists catalog_id uuid references public.convention_catalog(id) on delete set null,
  add column if not exists readiness_score integer not null default 0
    check (readiness_score between 0 and 100),
  add column if not exists ai_summary text;

create index if not exists con_preps_owner_idx
  on public.con_preps(owner_user_id);

-- ------------------------------------------------------------------
-- Nested checklists and tasks
-- ------------------------------------------------------------------

alter table public.packing_items
  add column if not exists parent_item_id uuid references public.packing_items(id) on delete cascade,
  add column if not exists source text not null default 'manual',
  add column if not exists required boolean not null default true;

alter table public.prep_tasks
  add column if not exists parent_task_id uuid references public.prep_tasks(id) on delete cascade,
  add column if not exists sort_order integer not null default 0,
  add column if not exists source text not null default 'manual',
  add column if not exists required boolean not null default true;

create index if not exists packing_items_parent_idx
  on public.packing_items(parent_item_id);

create index if not exists prep_tasks_parent_idx
  on public.prep_tasks(parent_task_id);

-- ------------------------------------------------------------------
-- Reusable deployment loadouts
-- ------------------------------------------------------------------

create table if not exists public.loadout_templates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  category text not null default 'general',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists loadout_templates_global_slug_idx
  on public.loadout_templates(slug)
  where owner_user_id is null;

create unique index if not exists loadout_templates_owner_slug_idx
  on public.loadout_templates(owner_user_id, slug)
  where owner_user_id is not null;

create table if not exists public.loadout_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.loadout_templates(id) on delete cascade,
  parent_template_item_id uuid references public.loadout_template_items(id) on delete cascade,
  category text not null default 'General',
  label text not null,
  quantity integer not null default 1,
  sort_order integer not null default 0,
  notes text
);

-- ------------------------------------------------------------------
-- Operator preferences
-- ------------------------------------------------------------------

create table if not exists public.operator_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  timezone text not null default 'America/New_York',
  airport_arrival_minutes integer not null default 90,
  safety_buffer_minutes integer not null default 15,
  sticker_rate_per_hour integer not null default 50,
  work_schedule jsonb not null default '{}'::jsonb,
  printing_windows jsonb not null default '[]'::jsonb,
  default_loadouts jsonb not null default '["con-core","fullsuit"]'::jsonb,
  ai_preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Chaos Copilot™
-- ------------------------------------------------------------------

create table if not exists public.copilot_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  context_type text not null default 'global'
    check (context_type in ('global','deployment','social')),
  con_prep_id uuid references public.con_preps(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  post_id uuid references public.posts(id) on delete cascade,
  title text not null default 'Chaos Copilot',
  summary text,
  openai_metadata jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists copilot_threads_user_idx
  on public.copilot_threads(user_id, created_at desc);

create table if not exists public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.copilot_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists copilot_messages_thread_idx
  on public.copilot_messages(thread_id, created_at);

create table if not exists public.copilot_actions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.copilot_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  con_prep_id uuid references public.con_preps(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  action_type text not null,
  title text not null,
  explanation text,
  payload jsonb not null default '{}'::jsonb,
  risk_level text not null default 'normal'
    check (risk_level in ('normal','sensitive')),
  status text not null default 'proposed'
    check (status in ('proposed','approved','rejected','executing','completed','failed')),
  requires_reauth boolean not null default false,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  executed_at timestamptz
);

create index if not exists copilot_actions_thread_idx
  on public.copilot_actions(thread_id, status, created_at);

-- Short-lived step-up grants for sensitive Chaos actions. The raw grant is
-- never stored; only a SHA-256 hash is kept.
create table if not exists public.security_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null,
  token_hash text not null unique,
  method text not null default 'password',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists security_grants_user_idx
  on public.security_grants(user_id, expires_at desc);

-- ------------------------------------------------------------------
-- RLS: Alpha accesses these only through authenticated server routes.
-- The user_id/owner_user_id columns are already present for the future Beta.
-- ------------------------------------------------------------------

alter table public.convention_catalog enable row level security;
alter table public.loadout_templates enable row level security;
alter table public.loadout_template_items enable row level security;
alter table public.operator_preferences enable row level security;
alter table public.copilot_threads enable row level security;
alter table public.copilot_messages enable row level security;
alter table public.copilot_actions enable row level security;
alter table public.security_grants enable row level security;

-- ------------------------------------------------------------------
-- Convention catalog population
-- ------------------------------------------------------------------
-- The large attendance-ranked WikiFur catalog lives in
-- src/data/wikifur-conventions.ts and is loaded by the authenticated server
-- sync on first Convention Ops use. Keeping the snapshot out of this SQL avoids
-- duplicating a large source dataset and lets official convention records take
-- precedence without destructive migrations.

-- ------------------------------------------------------------------
-- Seed global loadout templates. Fixed IDs make this migration rerunnable.
-- ------------------------------------------------------------------

insert into public.loadout_templates
(id, owner_user_id, slug, name, description, category, active)
values
  ('40000000-0000-0000-0000-000000000001', null, 'con-core', 'Convention Core', 'Baseline items for any convention deployment.', 'core', true),
  ('40000000-0000-0000-0000-000000000002', null, 'fullsuit', 'Dusk Fullsuit', 'Fursuit, cooling, care, and repair loadout.', 'fursuit', true),
  ('40000000-0000-0000-0000-000000000003', null, 'pup-gear', 'Pup / Nightlife Gear', 'Harness, collar, muzzle, and nightlife essentials.', 'gear', true),
  ('40000000-0000-0000-0000-000000000004', null, 'donk-toss', 'Donk Toss Kit', 'Tournament kit with expandable component checklist.', 'programming', true),
  ('40000000-0000-0000-0000-000000000005', null, 'hotel', 'Hotel Stay', 'Hotel-room essentials and checkout sanity.', 'travel', true),
  ('40000000-0000-0000-0000-000000000006', null, 'road-trip', 'Road Trip', 'Drive/carpool essentials.', 'travel', true)
on conflict do nothing;

delete from public.loadout_template_items
where template_id in (
  '40000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000004',
  '40000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000006'
);

insert into public.loadout_template_items
(id, template_id, parent_template_item_id, category, label, quantity, sort_order)
values
  ('41000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',null,'Documents','ID / wallet / travel documents',1,10),
  ('41000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001',null,'Electronics','Phone charger',1,20),
  ('41000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001',null,'Electronics','Battery pack',1,30),
  ('41000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001',null,'Merch','Stickers / giveaways',1,40),

  ('42000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',null,'Fursuit','Head',1,10),
  ('42000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002',null,'Fursuit','Bodysuit',1,20),
  ('42000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002',null,'Fursuit','Hand paws',1,30),
  ('42000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000002',null,'Fursuit','Foot paws',1,40),
  ('42000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000002',null,'Fursuit','Tail',1,50),
  ('42000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000002',null,'Cooling','Head cooling fan',1,60),
  ('42000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000002',null,'Cooling','Portable fans',2,70),
  ('42000000-0000-0000-0000-000000000008','40000000-0000-0000-0000-000000000002',null,'Care','Brush / comb',1,80),
  ('42000000-0000-0000-0000-000000000009','40000000-0000-0000-0000-000000000002',null,'Care','Fursuit repair kit',1,90),

  ('43000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003',null,'Gear','Harness',1,10),
  ('43000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003',null,'Gear','Collar',1,20),
  ('43000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003',null,'Gear','Muzzle',1,30),

  ('44000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000004',null,'Programming','Donk Toss Kit',1,10),
  ('44000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','44000000-0000-0000-0000-000000000001','Donk Toss','Official tournament kit',1,11),
  ('44000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000004','44000000-0000-0000-0000-000000000001','Donk Toss','Rules / host notes',1,12),
  ('44000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000004','44000000-0000-0000-0000-000000000001','Donk Toss','Signage',1,13),
  ('44000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000004','44000000-0000-0000-0000-000000000001','Donk Toss','Prizes',1,14),
  ('44000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000004','44000000-0000-0000-0000-000000000001','Donk Toss','Stickers',1,15),
  ('44000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000004','44000000-0000-0000-0000-000000000001','Donk Toss','Tape / setup supplies',1,16),

  ('45000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000005',null,'Hotel','Reservation confirmation',1,10),
  ('45000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000005',null,'Hotel','Room charging setup',1,20),
  ('45000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000005',null,'Hotel','Checkout sweep',1,30),

  ('46000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000006',null,'Road Trip','Route / stops checked',1,10),
  ('46000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000006',null,'Road Trip','Gas budget',1,20),
  ('46000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000006',null,'Road Trip','Tolls budget',1,30);

-- Updated-at triggers.
drop trigger if exists convention_catalog_set_updated_at on public.convention_catalog;
create trigger convention_catalog_set_updated_at
  before update on public.convention_catalog
  for each row execute procedure public.set_updated_at();

drop trigger if exists loadout_templates_set_updated_at on public.loadout_templates;
create trigger loadout_templates_set_updated_at
  before update on public.loadout_templates
  for each row execute procedure public.set_updated_at();

drop trigger if exists copilot_threads_set_updated_at on public.copilot_threads;
create trigger copilot_threads_set_updated_at
  before update on public.copilot_threads
  for each row execute procedure public.set_updated_at();
