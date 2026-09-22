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
  on public.cost_entries(external_key)
  where external_key is not null;

drop trigger if exists con_registrations_set_updated_at on public.con_registrations;
create trigger con_registrations_set_updated_at
  before update on public.con_registrations
  for each row execute procedure public.set_updated_at();

alter table public.con_registrations enable row level security;
