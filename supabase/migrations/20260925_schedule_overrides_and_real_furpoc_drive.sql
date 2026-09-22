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
