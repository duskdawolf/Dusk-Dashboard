-- Dusk Industries Supabase schema
-- Run this in the Supabase SQL Editor.
-- Designed to be safe on a fresh project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'viewer'
    check (role in ('viewer','editor','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  description text,
  tag text not null default 'Event',
  event_type text not null default 'meetup'
    check (event_type in ('convention','meetup','hosting','public')),
  quarter text not null
    check (quarter in ('q1','q2','q3','q4')),
  state_code text,
  latitude double precision,
  longitude double precision,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_links (
  id text primary key,
  name text not null,
  handle text not null,
  url text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  summary text,
  status text not null default 'active',
  content jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  image_url text not null,
  status text not null,
  challenge text not null,
  solution text not null,
  outcome text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('image','video')),
  url text not null,
  alt_text text,
  event_id uuid references public.events(id) on delete set null,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  image_url text not null,
  price_label text,
  stripe_price_id text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text unique,
  price_cents integer,
  stock integer,
  active boolean not null default true
);

create table if not exists public.print_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  contact text not null,
  sticker_type text not null,
  quantity integer not null,
  size text not null,
  notes text,
  artwork_url text,
  status text not null default 'new'
    check (status in ('new','reviewing','quoted','approved','production','complete','declined')),
  quoted_cents integer,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text unique,
  customer_email text,
  status text not null default 'pending',
  total_cents integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Automatically create a profile for every Supabase Auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    'viewer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep events.updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;

create trigger events_set_updated_at
  before update on public.events
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.social_links enable row level security;
alter table public.projects enable row level security;
alter table public.case_studies enable row level security;
alter table public.media enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.print_quotes enable row level security;
alter table public.orders enable row level security;
alter table public.site_settings enable row level security;

-- Re-runnable public policies.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events"
  on public.events for select
  to anon, authenticated
  using (published = true);

drop policy if exists "Public can read active socials" on public.social_links;
create policy "Public can read active socials"
  on public.social_links for select
  to anon, authenticated
  using (active = true);

drop policy if exists "Public can read published projects" on public.projects;
create policy "Public can read published projects"
  on public.projects for select
  to anon, authenticated
  using (published = true);

drop policy if exists "Public can read published case studies" on public.case_studies;
create policy "Public can read published case studies"
  on public.case_studies for select
  to anon, authenticated
  using (published = true);

drop policy if exists "Public can read published media" on public.media;
create policy "Public can read published media"
  on public.media for select
  to anon, authenticated
  using (published = true);

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products for select
  to anon, authenticated
  using (active = true);

drop policy if exists "Public can read active variants" on public.product_variants;
create policy "Public can read active variants"
  on public.product_variants for select
  to anon, authenticated
  using (active = true);

-- Dashboard writes go through server-only secret credentials after
-- application-level auth/authorization checks. No client-side admin
-- write policies are required.

-- Public storage plan:
--   public-media  -> published site photos / videos / product art
-- Private storage plan:
--   quote-artwork -> customer files uploaded with print quote requests


-- v10 operations modules --------------------------------------------
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
  provider_account text,
  published_caption text,
  published_media jsonb not null default '[]'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  last_provider_check timestamptz,
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
    check (platform in ('telegram','twitter','instagram','bluesky','snapchat')),
  platform_post_id text,
  platform_caption_override text,
  status text not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  post_url text,
  last_error text,
  attempt_count integer not null default 0,
  make_job_id text,
  provider_account text,
  published_caption text,
  published_media jsonb not null default '[]'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  last_provider_check timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
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


-- v11 scheduling defaults ------------------------------------------
-- Dusk Industries v11
-- Scheduling defaults from Dusk:
-- Printing: Tuesday & Wednesday, 3 PM - 10 PM
-- Throughput: 25 stickers/hour
-- Airport arrival target: 90 minutes before flight

alter table public.prep_tasks
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists scheduled_end_at timestamptz;

alter table public.travel_segments
  add column if not exists airport_arrival_target_at timestamptz,
  add column if not exists leave_for_airport_at timestamptz,
  add column if not exists transit_minutes integer,
  add column if not exists extra_travel_buffer_minutes integer not null default 0;

create unique index if not exists availability_windows_unique_rule
  on public.availability_windows(name, weekday, window_type);

insert into public.availability_windows
(name, weekday, start_time, end_time, window_type, active)
values
  ('Sticker Printing', 2, '15:00:00', '22:00:00', 'printing', true),
  ('Sticker Printing', 3, '15:00:00', '22:00:00', 'printing', true)
on conflict (name, weekday, window_type) do update set
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  active = excluded.active;

insert into public.site_settings(key, value)
values
  ('scheduling', jsonb_build_object(
    'home_timezone', 'America/New_York',
    'airport_arrival_minutes', 90,
    'stickers_per_hour', 25,
    'printing_windows', jsonb_build_array(
      jsonb_build_object('weekday', 2, 'start', '15:00', 'end', '22:00'),
      jsonb_build_object('weekday', 3, 'start', '15:00', 'end', '22:00')
    )
  ))
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();


-- v12 work schedule / prep scheduler -------------------------------
-- Dusk Industries v12
-- Work schedule, faster sticker throughput, and standard travel buffer.

create table if not exists public.weekly_work_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists weekly_work_blocks_unique_rule
  on public.weekly_work_blocks(name, weekday);

-- M-F 6:00 AM - 2:30 PM
insert into public.weekly_work_blocks
(name, weekday, start_time, end_time, active)
values
  ('Whole Foods', 1, '06:00:00', '14:30:00', true),
  ('Whole Foods', 2, '06:00:00', '14:30:00', true),
  ('Whole Foods', 3, '06:00:00', '14:30:00', true),
  ('Whole Foods', 4, '06:00:00', '14:30:00', true),
  ('Whole Foods', 5, '06:00:00', '14:30:00', true),
  ('Whole Foods', 0, '11:30:00', '20:00:00', true)
on conflict (name, weekday) do update set
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  active = excluded.active;

-- Saturday intentionally has no work block.

insert into public.site_settings(key, value)
values
  ('scheduling', jsonb_build_object(
    'home_timezone', 'America/New_York',
    'airport_arrival_minutes', 90,
    'extra_travel_buffer_minutes', 15,
    'stickers_per_hour', 50,
    'general_prep_rule', 'any_time_outside_work',
    'printing_windows', jsonb_build_array(
      jsonb_build_object('weekday', 2, 'start', '15:00', 'end', '22:00'),
      jsonb_build_object('weekday', 3, 'start', '15:00', 'end', '22:00')
    )
  ))
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

alter table public.weekly_work_blocks enable row level security;


-- v13 travel / registration / costs -------------------------------
-- Dusk Industries v13
-- Travel model: flight or car; car can be self-drive, carpool driver, or carpool passenger.
-- Adds con registration/badge tracking, projected/actual costs, and prep deadline tied to departure.

alter table public.con_preps
  add column if not exists prep_deadline_at timestamptz;

alter table public.prep_tasks
  add column if not exists relative_days_before_departure integer;

alter table public.travel_segments
  add column if not exists direction text
    check (direction in ('outbound','return','local','other')),
  add column if not exists car_mode text
    check (car_mode in ('self_drive','carpool_driver','carpool_passenger')),
  add column if not exists pickup_notes text;

-- Keep the existing kind column for backwards compatibility, but the Dashboard
-- now treats "flight" and "car" as the two primary intercity travel types.

create table if not exists public.con_registrations (
  id uuid primary key default gen_random_uuid(),
  con_prep_id uuid not null unique references public.con_preps(id) on delete cascade,
  badge_name text not null default 'Con badge',
  status text not null default 'needed'
    check (status in ('needed','ordered','paid','confirmed')),
  cost_cents integer,
  confirmation_code text,
  quickbooks_txn_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cost_entries
  add column if not exists external_key text,
  add column if not exists cost_status text not null default 'planned'
    check (cost_status in ('estimated','planned','paid','reimbursed'));

create unique index if not exists cost_entries_external_key_unique
  on public.cost_entries(external_key);

drop trigger if exists con_registrations_set_updated_at on public.con_registrations;
create trigger con_registrations_set_updated_at
  before update on public.con_registrations
  for each row execute procedure public.set_updated_at();

alter table public.con_registrations enable row level security;


-- v14 schedule overrides / real FurPoc drive ----------------------
-- Dusk Industries v14
-- One-off schedule overrides and real FurPocalypse 2026 drive details.

create table if not exists public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  block_type text not null default 'work'
    check (block_type in ('work','unavailable','available')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.schedule_overrides enable row level security;

alter table public.con_preps
  add column if not exists departure_at timestamptz,
  add column if not exists prep_complete_by timestamptz;

-- This one-off inventory shift replaces the normal Thursday work pattern
-- for purposes of con-prep scheduling.
insert into public.schedule_overrides (
  title,
  starts_at,
  ends_at,
  block_type,
  notes
)
select
  'Whole Foods inventory shift',
  '2026-10-29T13:00:00-04:00',
  '2026-10-29T22:00:00-04:00',
  'work',
  'Inventory 1 PM-10 PM. FurPoc drive begins directly from work at 10 PM.'
where not exists (
  select 1
  from public.schedule_overrides
  where title = 'Whole Foods inventory shift'
    and starts_at = '2026-10-29T13:00:00-04:00'
);

-- Update the existing FurPocalypse prep record if present.
update public.con_preps cp
set
  departure_at = '2026-10-29T22:00:00-04:00',
  prep_complete_by = '2026-10-29T13:00:00-04:00',
  prep_deadline_at = '2026-10-29T13:00:00-04:00',
  notes = concat_ws(
    E'\n',
    nullif(cp.notes, ''),
    'Inventory shift Thursday 1-10 PM. Dusk leaves directly from Whole Foods Market Swampscott at 10 PM, so packing/prep must be complete before the 1 PM shift.'
  )
from public.events e
where cp.event_id = e.id
  and e.slug = 'furpocalypse-2026';

-- Update real hotel name/status in cost ledger.
update public.hotel_stays hs
set
  hotel_name = 'Hilton Stamford',
  address = coalesce(hs.address, 'Stamford, CT')
from public.con_preps cp
join public.events e on e.id = cp.event_id
where hs.con_prep_id = cp.id
  and e.slug = 'furpocalypse-2026';

update public.cost_entries ce
set
  vendor = 'Hilton Stamford',
  description = 'Four-night main con hotel stay',
  cost_status = 'planned'
from public.events e
where ce.event_id = e.id
  and e.slug = 'furpocalypse-2026'
  and ce.external_key = 'furpoc-2026-hotel';

-- Outbound: 4-hour self-drive directly from work.
update public.travel_segments ts
set
  kind = 'car',
  direction = 'outbound',
  car_mode = 'self_drive',
  origin = 'Whole Foods Market Swampscott',
  destination = 'Hilton Stamford',
  depart_at = '2026-10-29T22:00:00-04:00',
  arrive_at = '2026-10-30T02:00:00-04:00',
  transit_minutes = 240,
  pickup_notes = 'Leave directly after inventory shift.'
from public.con_preps cp
join public.events e on e.id = cp.event_id
where ts.con_prep_id = cp.id
  and e.slug = 'furpocalypse-2026'
  and ts.direction = 'outbound'
  and ts.kind = 'car';

-- Return: same 4-hour estimate, leaving at hotel checkout.
update public.travel_segments ts
set
  kind = 'car',
  direction = 'return',
  car_mode = 'self_drive',
  origin = 'Hilton Stamford',
  destination = 'Swampscott, MA',
  depart_at = '2026-11-02T11:00:00-05:00',
  arrive_at = '2026-11-02T15:00:00-05:00',
  transit_minutes = 240
from public.con_preps cp
join public.events e on e.id = cp.event_id
where ts.con_prep_id = cp.id
  and e.slug = 'furpocalypse-2026'
  and ts.direction = 'return'
  and ts.kind = 'car';


-- v15 notifications / PWA push -----------------------------------
-- Dusk Industries v15
-- Notification Center + PWA web push + Make/Telegram delivery queue.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  severity text not null default 'info'
    check (severity in ('info','action','reminder','urgent')),
  category text not null default 'system'
    check (category in (
      'events','con_prep','sticker_factory','orders','shipping',
      'social','finance','system'
    )),
  title text not null,
  message text not null,
  target_url text,
  event_id uuid references public.events(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null
    check (channel in ('web_push','telegram','email')),
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed','skipped')),
  provider_message_id text,
  error_message text,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(notification_id, channel)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  web_push_enabled boolean not null default true,
  telegram_enabled boolean not null default true,
  email_enabled boolean not null default false,
  info_push boolean not null default false,
  action_push boolean not null default true,
  reminder_push boolean not null default true,
  urgent_push boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_start time,
  quiet_end time,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute procedure public.set_updated_at();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute procedure public.set_updated_at();

alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own notification prefs" on public.notification_preferences;
create policy "Users can read own notification prefs"
  on public.notification_preferences for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
create policy "Users can read own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);


-- v18 event incident reports --------------------------------------
-- Dusk Industries v18
-- Event-linked Case Studies in Chaos / incident reports.

alter table public.case_studies
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists case_studies_event_id_idx
  on public.case_studies(event_id);

-- Link existing case studies to events by matching their stable slug.
update public.case_studies cs
set event_id = e.id
from public.events e
where cs.event_id is null
  and cs.slug = e.slug;


-- v24.2 Social Ops queue ------------------------------------------
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


-- v24.3 Notification Ops ------------------------------------------
-- Dusk Industries v24.3
-- Notification Ops: granular topic preferences, dedupe, deep links, quiet-hour controls.

alter table public.notifications
  add column if not exists event_key text not null default 'system.generic',
  add column if not exists dedupe_key text,
  add column if not exists action_label text,
  add column if not exists dashboard_visible boolean not null default true;

alter table public.notifications
  drop constraint if exists notifications_category_check;

alter table public.notifications
  add constraint notifications_category_check
  check (category in (
    'events','con_prep','sticker_factory','orders','shipping',
    'social','finance','media','integrations','system'
  ));

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at, created_at desc);

create index if not exists notifications_dedupe_idx
  on public.notifications(user_id, dedupe_key, created_at desc);

alter table public.notification_preferences
  add column if not exists quiet_urgent_bypass boolean not null default true,
  add column if not exists badge_count_enabled boolean not null default true;

create table if not exists public.notification_topic_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  dashboard_enabled boolean not null default true,
  web_push_enabled boolean not null default false,
  telegram_enabled boolean not null default false,
  email_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_key)
);

drop trigger if exists notification_topic_preferences_set_updated_at
  on public.notification_topic_preferences;

create trigger notification_topic_preferences_set_updated_at
  before update on public.notification_topic_preferences
  for each row execute procedure public.set_updated_at();

alter table public.notification_topic_preferences enable row level security;

drop policy if exists "Users can read own notification topic prefs"
  on public.notification_topic_preferences;

create policy "Users can read own notification topic prefs"
  on public.notification_topic_preferences for select
  to authenticated
  using (auth.uid() = user_id);


-- v25.0 Live Social Publishing ------------------------------------
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


-- v25.1 X OAuth connection storage ---------------------------------
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


-- v25.2 Instagram + deployment links -------------------------------
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


-- v25.3 Bluesky provider -------------------------------------------
-- Dusk Industries v25.3
-- Live Bluesky publishing.

alter table public.post_platforms
  drop constraint if exists post_platforms_platform_check;

alter table public.post_platforms
  add constraint post_platforms_platform_check
  check (platform in ('telegram','twitter','instagram','bluesky','snapchat'));


-- v26 Alpha Convention Operations + Chaos Copilot -----------------
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
  ('45000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000005',null,'Hotel','Phone / fan / battery chargers',1,20),

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


-- v26.0 Alpha 3 Convention Ops UX ---------------------------------
-- Dusk Industries v26.0 Alpha 3
-- Convention Ops UX / nested checklist reliability / suggested task sets.
-- Safe to run after the v26 Alpha migration.

begin;

-- Repair/guarantee the nested checklist columns used by the Alpha UI.
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

-- Suggested task sets. Separate from packing loadouts on purpose:
-- things you DO belong here; things you PACK stay in loadouts.
create table if not exists public.prep_task_templates (
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

create unique index if not exists prep_task_templates_global_slug_idx
  on public.prep_task_templates(slug)
  where owner_user_id is null;

create unique index if not exists prep_task_templates_owner_slug_idx
  on public.prep_task_templates(owner_user_id, slug)
  where owner_user_id is not null;

create table if not exists public.prep_task_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.prep_task_templates(id) on delete cascade,
  parent_template_task_id uuid references public.prep_task_template_items(id) on delete cascade,
  title text not null,
  task_type text not null default 'prep',
  relative_days_before_departure integer,
  duration_minutes integer,
  sort_order integer not null default 0,
  notes text
);

alter table public.prep_task_templates enable row level security;
alter table public.prep_task_template_items enable row level security;

drop trigger if exists prep_task_templates_set_updated_at on public.prep_task_templates;
create trigger prep_task_templates_set_updated_at
  before update on public.prep_task_templates
  for each row execute procedure public.set_updated_at();

insert into public.prep_task_templates
(id, owner_user_id, slug, name, description, category, active)
values
  ('47000000-0000-0000-0000-000000000001', null, 'hotel-stay', 'Hotel Stay Tasks', 'Booking, arrival, room, and checkout tasks.', 'hotel', true),
  ('47000000-0000-0000-0000-000000000002', null, 'fursuit-prep', 'Fursuit Prep Tasks', 'Pre-con cleaning, charging, inspection, and repair checks.', 'fursuit', true),
  ('47000000-0000-0000-0000-000000000003', null, 'donk-toss-ops', 'Donk Toss Ops', 'Production, equipment, prizes, signage, and panel-readiness tasks.', 'programming', true),
  ('47000000-0000-0000-0000-000000000004', null, 'social-prep', 'Convention Social Prep', 'Pre-con social copy/media preparation tasks.', 'social', true)
on conflict do nothing;

delete from public.prep_task_template_items
where template_id in (
  '47000000-0000-0000-0000-000000000001',
  '47000000-0000-0000-0000-000000000002',
  '47000000-0000-0000-0000-000000000003',
  '47000000-0000-0000-0000-000000000004'
);

insert into public.prep_task_template_items
(id, template_id, parent_template_task_id, title, task_type, relative_days_before_departure, duration_minutes, sort_order)
values
  ('47100000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000001',null,'Hotel Stay','hotel',14,30,10),
  ('47100000-0000-0000-0000-000000000002','47000000-0000-0000-0000-000000000001','47100000-0000-0000-0000-000000000001','Confirm reservation and payment status','hotel',14,15,11),
  ('47100000-0000-0000-0000-000000000003','47000000-0000-0000-0000-000000000001','47100000-0000-0000-0000-000000000001','Check check-in / parking / incidental requirements','hotel',7,15,12),
  ('47100000-0000-0000-0000-000000000004','47000000-0000-0000-0000-000000000001','47100000-0000-0000-0000-000000000001','Hotel checkout sweep','hotel',0,20,13),

  ('47200000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000002',null,'Fursuit Prep','prep',3,60,10),
  ('47200000-0000-0000-0000-000000000002','47000000-0000-0000-0000-000000000002','47200000-0000-0000-0000-000000000001','Inspect seams, zipper, paws, and high-stress areas','prep',3,20,11),
  ('47200000-0000-0000-0000-000000000003','47000000-0000-0000-0000-000000000002','47200000-0000-0000-0000-000000000001','Clean / brush suit as needed','prep',2,30,12),
  ('47200000-0000-0000-0000-000000000004','47000000-0000-0000-0000-000000000002','47200000-0000-0000-0000-000000000001','Charge head fan and portable fans','prep',1,20,13),
  ('47200000-0000-0000-0000-000000000005','47000000-0000-0000-0000-000000000002','47200000-0000-0000-0000-000000000001','Verify repair supplies are stocked','prep',1,10,14),

  ('47300000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000003',null,'Donk Toss Ops','programming',7,90,10),
  ('47300000-0000-0000-0000-000000000002','47000000-0000-0000-0000-000000000003','47300000-0000-0000-0000-000000000001','Verify tournament kit and rules','programming',7,20,11),
  ('47300000-0000-0000-0000-000000000003','47000000-0000-0000-0000-000000000003','47300000-0000-0000-0000-000000000001','Print / verify signage','production',5,30,12),
  ('47300000-0000-0000-0000-000000000004','47000000-0000-0000-0000-000000000003','47300000-0000-0000-0000-000000000001','Count and prep prizes','programming',3,20,13),
  ('47300000-0000-0000-0000-000000000005','47000000-0000-0000-0000-000000000003','47300000-0000-0000-0000-000000000001','Print required stickers / giveaways','production',3,60,14),
  ('47300000-0000-0000-0000-000000000006','47000000-0000-0000-0000-000000000003','47300000-0000-0000-0000-000000000001','Final host notes / scoring sanity check','programming',1,20,15),

  ('47400000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000004',null,'Convention Social Prep','social',5,45,10),
  ('47400000-0000-0000-0000-000000000002','47000000-0000-0000-0000-000000000004','47400000-0000-0000-0000-000000000001','Choose pre-con media','social',5,15,11),
  ('47400000-0000-0000-0000-000000000003','47000000-0000-0000-0000-000000000004','47400000-0000-0000-0000-000000000001','Draft platform-specific teaser copy','social',4,20,12),
  ('47400000-0000-0000-0000-000000000004','47000000-0000-0000-0000-000000000004','47400000-0000-0000-0000-000000000001','Schedule / approve pre-con posts','social',2,15,13);

-- Correct the hotel packing template: "checkout sweep" is an action/task,
-- not something to pack. Keep physical charging gear in the loadout.
delete from public.loadout_template_items
where template_id = '40000000-0000-0000-0000-000000000005'
  and label in ('Checkout sweep','Room charging setup');

insert into public.loadout_template_items
(id, template_id, parent_template_item_id, category, label, quantity, sort_order)
values
  ('45000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000005',null,'Hotel','Power strip / charging block',1,20),
  ('45000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000005',null,'Hotel','Charging cables',1,30),
  ('45000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000005',null,'Hotel','Toiletries',1,40)
on conflict (id) do update set
  category = excluded.category,
  label = excluded.label,
  quantity = excluded.quantity,
  sort_order = excluded.sort_order;

commit;


-- v26 Alpha 5 Social Review / ownership ----------------------------
-- Dusk Industries v26.0 Alpha 5\n-- Social Review workflow + future multi-profile ownership groundwork.\n\nbegin;\n\nalter table public.posts\n  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null;\n\ncreate index if not exists posts_owner_user_idx\n  on public.posts(owner_user_id, created_at desc);\n\ncommit;\n