-- Dusk Induskries — Alpha v31
-- Deployment Automation
--
-- Readiness:
--   Tasks   55%
--   Budget  35%
--   Packing 10%
--
-- Lifecycle:
--   Planning -> Packing -> Traveling -> Complete
--
-- This migration does NOT install the external HTTP cron.
-- Run ALPHA_V31_ENABLE_SUPABASE_CRON_AFTER_DEPLOY.sql after the app deploy.

begin;

alter table public.prep_tasks
  add column if not exists counts_toward_readiness boolean not null default true;

alter table public.con_preps
  add column if not exists task_readiness_score integer not null default 0,
  add column if not exists budget_readiness_score integer not null default 0,
  add column if not exists packing_readiness_score integer not null default 0,
  add column if not exists readiness_calculated_at timestamptz;

alter table public.con_preps
  drop constraint if exists con_preps_status_check;

update public.con_preps
set status = 'planning'
where status = 'ready';

alter table public.con_preps
  add constraint con_preps_status_check
  check (status in ('planning','packing','traveling','complete'));

create or replace function public.dusk_alpha31_task_readiness(p_con_prep_id uuid)
returns integer
language sql
stable
as $$
  with eligible as (
    select t.id, t.status
    from public.prep_tasks t
    where t.con_prep_id = p_con_prep_id
      and t.counts_toward_readiness = true
      and not exists (
        select 1
        from public.prep_tasks child
        where child.parent_task_id = t.id
      )
  ),
  totals as (
    select
      count(*)::numeric as total,
      count(*) filter (where status in ('done','skipped'))::numeric as finished
    from eligible
  )
  select case
    when total = 0 then 0
    else round((finished / total) * 100)::integer
  end
  from totals;
$$;

create or replace function public.dusk_alpha31_packing_readiness(p_con_prep_id uuid)
returns integer
language sql
stable
as $$
  with eligible as (
    select p.id, p.packed
    from public.packing_items p
    where p.con_prep_id = p_con_prep_id
      and p.required = true
      and not exists (
        select 1
        from public.packing_items child
        where child.parent_item_id = p.id
      )
  ),
  totals as (
    select
      count(*)::numeric as total,
      count(*) filter (where packed = true)::numeric as finished
    from eligible
  )
  select case
    when total = 0 then 0
    else round((finished / total) * 100)::integer
  end
  from totals;
$$;

create or replace function public.dusk_alpha31_budget_readiness(p_con_prep_id uuid)
returns integer
language sql
stable
as $$
  with totals as (
    select
      count(*)::numeric as total,
      count(*) filter (
        where cost_status in ('budgeted','paid')
      )::numeric as accounted_for
    from public.cost_entries
    where con_prep_id = p_con_prep_id
  )
  select case
    when total = 0 then 0
    else round((accounted_for / total) * 100)::integer
  end
  from totals;
$$;

create or replace function public.dusk_alpha31_expected_status(p_con_prep_id uuid)
returns text
language plpgsql
stable
as $$
declare
  v_departure timestamptz;
  v_end timestamptz;
  v_any_packed boolean;
begin
  select cp.departure_at, e.end_at
  into v_departure, v_end
  from public.con_preps cp
  join public.events e on e.id = cp.event_id
  where cp.id = p_con_prep_id;

  if v_end is not null and now() >= v_end then
    return 'complete';
  end if;

  if v_departure is not null and now() >= v_departure then
    return 'traveling';
  end if;

  select exists (
    select 1
    from public.packing_items p
    where p.con_prep_id = p_con_prep_id
      and p.packed = true
  )
  into v_any_packed;

  if v_any_packed then
    return 'packing';
  end if;

  return 'planning';
end;
$$;

create or replace function public.dusk_alpha31_ensure_case_study(p_con_prep_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_case_study_id uuid;
  v_slug text;
begin
  select e.*
  into v_event
  from public.con_preps cp
  join public.events e on e.id = cp.event_id
  where cp.id = p_con_prep_id;

  if v_event.id is null then
    return null;
  end if;

  select id
  into v_case_study_id
  from public.case_studies
  where event_id = v_event.id
  limit 1;

  if v_case_study_id is not null then
    return v_case_study_id;
  end if;

  v_slug := v_event.slug || '-case-study';

  insert into public.case_studies (
    event_id,
    slug,
    title,
    image_url,
    status,
    challenge,
    solution,
    outcome,
    published
  )
  values (
    v_event.id,
    v_slug,
    v_event.title,
    '',
    'Draft',
    '',
    '',
    '',
    false
  )
  on conflict (event_id) do nothing
  returning id into v_case_study_id;

  if v_case_study_id is null then
    select id into v_case_study_id
    from public.case_studies
    where event_id = v_event.id
    limit 1;
  end if;

  return v_case_study_id;
end;
$$;

create or replace function public.dusk_alpha31_recalculate_deployment(p_con_prep_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task integer;
  v_budget integer;
  v_packing integer;
  v_total integer;
  v_status text;
begin
  if p_con_prep_id is null then
    return;
  end if;

  v_task := public.dusk_alpha31_task_readiness(p_con_prep_id);
  v_budget := public.dusk_alpha31_budget_readiness(p_con_prep_id);
  v_packing := public.dusk_alpha31_packing_readiness(p_con_prep_id);

  v_total := round(
      (v_task * 0.55)
    + (v_budget * 0.35)
    + (v_packing * 0.10)
  )::integer;

  v_status := public.dusk_alpha31_expected_status(p_con_prep_id);

  update public.con_preps
  set
    task_readiness_score = v_task,
    budget_readiness_score = v_budget,
    packing_readiness_score = v_packing,
    readiness_score = greatest(0, least(100, v_total)),
    status = v_status,
    readiness_calculated_at = now(),
    updated_at = now()
  where id = p_con_prep_id;

  if v_status = 'complete' then
    perform public.dusk_alpha31_ensure_case_study(p_con_prep_id);
  end if;
end;
$$;

create or replace function public.dusk_alpha31_child_recalculate_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old uuid;
  v_new uuid;
begin
  if tg_op <> 'INSERT' then
    v_old := old.con_prep_id;
  end if;

  if tg_op <> 'DELETE' then
    v_new := new.con_prep_id;
  end if;

  if v_old is not null then
    perform public.dusk_alpha31_recalculate_deployment(v_old);
  end if;

  if v_new is not null and v_new is distinct from v_old then
    perform public.dusk_alpha31_recalculate_deployment(v_new);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.dusk_alpha31_prep_recalculate_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dusk_alpha31_recalculate_deployment(new.id);
  return new;
end;
$$;

drop trigger if exists alpha31_packing_recalculate on public.packing_items;
create trigger alpha31_packing_recalculate
after insert or update or delete on public.packing_items
for each row execute function public.dusk_alpha31_child_recalculate_trigger();

drop trigger if exists alpha31_tasks_recalculate on public.prep_tasks;
create trigger alpha31_tasks_recalculate
after insert or update or delete on public.prep_tasks
for each row execute function public.dusk_alpha31_child_recalculate_trigger();

drop trigger if exists alpha31_costs_recalculate on public.cost_entries;
create trigger alpha31_costs_recalculate
after insert or update or delete on public.cost_entries
for each row execute function public.dusk_alpha31_child_recalculate_trigger();

drop trigger if exists alpha31_prep_timing_recalculate on public.con_preps;
create trigger alpha31_prep_timing_recalculate
after update of departure_at on public.con_preps
for each row
when (old.departure_at is distinct from new.departure_at)
execute function public.dusk_alpha31_prep_recalculate_trigger();

create or replace function public.dusk_alpha31_lifecycle_sweep()
returns table (
  deployment_id uuid,
  event_id uuid,
  old_status text,
  new_status text,
  readiness integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  row_record record;
  previous_status text;
begin
  for row_record in
    select cp.id, cp.event_id, cp.status
    from public.con_preps cp
  loop
    previous_status := row_record.status;

    perform public.dusk_alpha31_recalculate_deployment(row_record.id);

    return query
    select
      cp.id,
      cp.event_id,
      previous_status,
      cp.status,
      cp.readiness_score
    from public.con_preps cp
    where cp.id = row_record.id;
  end loop;
end;
$$;

-- Initial backfill.
do $$
declare
  r record;
begin
  for r in select id from public.con_preps loop
    perform public.dusk_alpha31_recalculate_deployment(r.id);
  end loop;
end $$;

commit;
