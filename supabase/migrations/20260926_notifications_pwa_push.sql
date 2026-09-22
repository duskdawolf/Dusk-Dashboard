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
