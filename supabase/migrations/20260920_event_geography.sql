-- Adds dynamic geography and marker types to an existing Dusk Industries events table.
-- Safe to run after the original schema if you already created Supabase.

alter table public.events
  add column if not exists event_type text,
  add column if not exists state_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

update public.events
set event_type = coalesce(event_type, 'meetup')
where event_type is null;

alter table public.events
  alter column event_type set default 'meetup';

-- Add the constraint only if it does not already exist.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_event_type_check'
  ) then
    alter table public.events
      add constraint events_event_type_check
      check (event_type in ('convention','meetup','hosting','public'));
  end if;
end $$;
