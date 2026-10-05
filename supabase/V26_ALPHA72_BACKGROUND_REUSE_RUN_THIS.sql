-- Dusk Induskries v26 Alpha 7.2
-- Reusable Next Stop backgrounds + richer find-Dusk support

begin;

alter table public.events
  add column if not exists next_stop_background_asset_url text,
  add column if not exists next_stop_background_asset_path text,
  add column if not exists next_stop_background_asset_status text not null default 'not_generated',
  add column if not exists next_stop_background_generated_at timestamptz,
  add column if not exists next_stop_background_prompt text,
  add column if not exists next_stop_background_image_model text;

-- Keep statuses constrained if the constraint does not already exist.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_next_stop_background_status_check'
  ) then
    alter table public.events
      add constraint events_next_stop_background_status_check
      check (next_stop_background_asset_status in ('not_generated','generating','generated','stale','failed'));
  end if;
end $$;

commit;
