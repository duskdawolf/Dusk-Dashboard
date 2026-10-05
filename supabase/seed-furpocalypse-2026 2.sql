-- FurPocalypse 2026 real trip seed
-- Assumption: "returning 11 AM Monday" means the return drive begins at
-- hotel checkout at 11:00 AM Monday, November 2, 2026.
-- No drive duration is guessed; add it in the Dashboard later.

do $$
declare
  v_event_id uuid;
  v_prep_id uuid;
begin
  select id into v_event_id
  from public.events
  where slug = 'furpocalypse-2026';

  if v_event_id is null then
    raise exception 'FurPocalypse event not found. Run the normal event seed first.';
  end if;

  insert into public.con_preps (
    event_id,
    status,
    prep_deadline_at,
    notes
  )
  values (
    v_event_id,
    'planning',
    '2026-10-29T13:00:00-04:00',
    'Inventory shift Thursday 1-10 PM. Self-drive deployment leaves directly from Whole Foods Market Swampscott at 10 PM, so con prep must be complete before work at 1 PM.'
  )
  on conflict (event_id) do update set
    prep_deadline_at = excluded.prep_deadline_at,
    notes = excluded.notes
  returning id into v_prep_id;

  if v_prep_id is null then
    select id into v_prep_id
    from public.con_preps
    where event_id = v_event_id;
  end if;

  -- Badge / registration
  insert into public.con_registrations (
    con_prep_id,
    badge_name,
    status,
    cost_cents
  )
  values (
    v_prep_id,
    'FurPocalypse con badge',
    'needed',
    10000
  )
  on conflict (con_prep_id) do update set
    badge_name = excluded.badge_name,
    cost_cents = excluded.cost_cents;

  -- Main con hotel: four nights, Thu -> Mon.
  if not exists (
    select 1
    from public.hotel_stays
    where con_prep_id = v_prep_id
      and hotel_name = 'Hilton Stamford'
      and checkin_at = '2026-10-29T16:00:00-04:00'
  ) then
    insert into public.hotel_stays (
      con_prep_id,
      hotel_name,
      checkin_at,
      checkout_at,
      cost_cents,
      currency
    )
    values (
      v_prep_id,
      'Hilton Stamford',
      '2026-10-29T16:00:00-04:00',
      '2026-11-02T11:00:00-05:00',
      90000,
      'USD'
    );
  end if;

  -- Outbound self-drive. Arrival time intentionally left null until drive
  -- duration / destination details are entered.
  if not exists (
    select 1
    from public.travel_segments
    where con_prep_id = v_prep_id
      and direction = 'outbound'
      and kind = 'car'
  ) then
    insert into public.travel_segments (
      con_prep_id,
      kind,
      direction,
      car_mode,
      origin,
      destination,
      depart_at,
      cost_cents,
      currency
    )
    values (
      v_prep_id,
      'car',
      'outbound',
      'self_drive',
      'Whole Foods Market Swampscott',
      'Hilton Stamford',
      '2026-10-29T22:00:00-04:00',
      null,
      'USD'
    );
  end if;

  -- Return self-drive begins at hotel checkout.
  if not exists (
    select 1
    from public.travel_segments
    where con_prep_id = v_prep_id
      and direction = 'return'
      and kind = 'car'
  ) then
    insert into public.travel_segments (
      con_prep_id,
      kind,
      direction,
      car_mode,
      origin,
      destination,
      depart_at,
      cost_cents,
      currency
    )
    values (
      v_prep_id,
      'car',
      'return',
      'self_drive',
      'Hilton Stamford',
      'Swampscott, MA',
      '2026-11-02T11:00:00-05:00',
      null,
      'USD'
    );
  end if;

  -- Projected cost ledger.
  insert into public.cost_entries (
    con_prep_id, event_id, category, vendor, description,
    amount_cents, currency, source, external_key, cost_status
  )
  values
    (
      v_prep_id, v_event_id, 'registration', 'FurPocalypse',
      'Con badge', 10000, 'USD', 'manual',
      'furpoc-2026-badge', 'planned'
    ),
    (
      v_prep_id, v_event_id, 'lodging', 'Hilton Stamford',
      'Four-night main hotel stay', 90000, 'USD', 'manual',
      'furpoc-2026-hotel', 'planned'
    ),
    (
      v_prep_id, v_event_id, 'transportation', 'Gas',
      'Estimated round-trip gas', 8000, 'USD', 'manual',
      'furpoc-2026-gas', 'estimated'
    ),
    (
      v_prep_id, v_event_id, 'transportation', 'Tolls',
      'Estimated round-trip tolls', 2000, 'USD', 'manual',
      'furpoc-2026-tolls', 'estimated'
    )
  on conflict (external_key) do update set
    amount_cents = excluded.amount_cents,
    description = excluded.description,
    cost_status = excluded.cost_status;

  -- Default prep tasks tied to the actual departure, not the public event start.
  -- Insert only if a task with the same title does not already exist.
  if not exists (
    select 1 from public.prep_tasks
    where con_prep_id = v_prep_id and title = 'Purchase / confirm FurPocalypse badge'
  ) then
    insert into public.prep_tasks (
      con_prep_id, title, task_type, due_at, duration_minutes,
      status, relative_days_before_departure
    )
    values (
      v_prep_id,
      'Purchase / confirm FurPocalypse badge',
      'registration',
      '2026-10-15T19:00:00-04:00',
      20,
      'todo',
      14
    );
  end if;

end $$;


-- v14 real-trip refinements -----------------------------------------

insert into public.schedule_overrides (
  title, starts_at, ends_at, block_type, notes
)
select
  'Whole Foods inventory shift',
  '2026-10-29T13:00:00-04:00',
  '2026-10-29T22:00:00-04:00',
  'work',
  'Inventory 1 PM-10 PM. Leave directly for FurPoc after inventory.'
where not exists (
  select 1
  from public.schedule_overrides
  where title = 'Whole Foods inventory shift'
    and starts_at = '2026-10-29T13:00:00-04:00'
);

update public.con_preps cp
set
  departure_at = '2026-10-29T22:00:00-04:00',
  prep_complete_by = '2026-10-29T13:00:00-04:00',
  prep_deadline_at = '2026-10-29T13:00:00-04:00'
from public.events e
where cp.event_id = e.id
  and e.slug = 'furpocalypse-2026';

update public.travel_segments ts
set
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

update public.travel_segments ts
set
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
