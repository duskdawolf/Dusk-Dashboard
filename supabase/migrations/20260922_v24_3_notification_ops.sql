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
