-- Dusk Induskries v26 Alpha 9 — Deployment Timeline
-- Sub-events, suiting status, Next Stop visibility, reminders, simplified budgets.
-- Safe additive migration after Alpha 8.1.

begin;

alter table public.events
  add column if not exists suiting_mode text not null default 'not_suiting';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_suiting_mode_check'
  ) then
    alter table public.events
      add constraint events_suiting_mode_check
      check (suiting_mode in ('not_suiting','partialing','fullsuiting'));
  end if;
end $$;

create table if not exists public.deployment_sub_events (
  id uuid primary key default gen_random_uuid(),
  con_prep_id uuid not null references public.con_preps(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  room text,
  description text,
  attendance_status text not null default 'going'
    check (attendance_status in ('going','maybe','hosting','performing','not_going')),
  suiting_mode text not null default 'inherit'
    check (suiting_mode in ('inherit','not_suiting','partialing','fullsuiting')),
  show_in_find_dusk boolean not null default false,
  feature_on_next_stop boolean not null default false,
  next_stop_priority integer not null default 0,
  reminder_enabled boolean not null default true,
  reminder_minutes_before integer not null default 30
    check (reminder_minutes_before between 0 and 1440),
  source text not null default 'manual'
    check (source in ('manual','chaos','sched','imported')),
  source_url text,
  source_metadata jsonb not null default '{}'::jsonb,
  reminder_last_queued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deployment_sub_events_prep_time_idx
  on public.deployment_sub_events(con_prep_id, starts_at);

create index if not exists deployment_sub_events_reminder_idx
  on public.deployment_sub_events(reminder_enabled, starts_at)
  where reminder_enabled = true;

alter table public.deployment_sub_events enable row level security;

drop trigger if exists deployment_sub_events_set_updated_at
  on public.deployment_sub_events;

create trigger deployment_sub_events_set_updated_at
  before update on public.deployment_sub_events
  for each row execute function public.dusk_set_updated_at();

-- Alpha 9 budget semantics.
-- IMPORTANT: remove the old enum-like CHECK before migrating existing rows,
-- because the old constraint does not permit the new value 'budgeted'.
alter table public.cost_entries
  drop constraint if exists cost_entries_cost_status_check;

update public.cost_entries
set cost_status = case
  when cost_status in ('estimated','planned') then 'budgeted'
  when cost_status = 'reimbursed' then 'paid'
  else cost_status
end
where cost_status in ('estimated','planned','reimbursed');

alter table public.cost_entries
  add constraint cost_entries_cost_status_check
  check (cost_status in ('unbudgeted','budgeted','paid'));

alter table public.cost_entries
  alter column cost_status set default 'budgeted';

commit;
