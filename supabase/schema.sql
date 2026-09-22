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
  last_error text,
  attempt_count integer not null default 0,
  make_job_id text,
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
