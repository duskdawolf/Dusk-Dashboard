-- Dusk Induskries Alpha v30
-- AI-rendered Next Stop posters + per-event wording mode.
-- Requires the Alpha 9.x Next Stop/background columns.

begin;

alter table public.events
  add column if not exists next_stop_allow_ai_wording boolean not null default false,
  add column if not exists next_stop_final_prompt text,
  add column if not exists next_stop_text_payload jsonb,
  add column if not exists next_stop_validation_status text not null default 'not_run',
  add column if not exists next_stop_validation_json jsonb;

-- v30 records reusable backgrounds in the same generated-asset history table.
alter table public.event_generated_assets
  drop constraint if exists event_generated_assets_asset_type_check;

alter table public.event_generated_assets
  add constraint event_generated_assets_asset_type_check
  check (asset_type in ('next_stop', 'next_stop_background'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_next_stop_validation_status_check'
  ) then
    alter table public.events
      add constraint events_next_stop_validation_status_check
      check (
        next_stop_validation_status in (
          'not_run',
          'passed',
          'failed',
          'error'
        )
      );
  end if;
end $$;

-- Existing Sharp-composited posters should be rebuilt through the v30 AI renderer.
update public.events
set next_stop_asset_status = 'stale',
    next_stop_validation_status = 'not_run',
    next_stop_validation_json = null,
    updated_at = now()
where next_stop_asset_url is not null;

commit;
