-- Dusk Induskries — Alpha v31.1
-- Security hardening for Alpha v31 automation/readiness functions.
--
-- Requires Alpha v31's main migration to have already run.
--
-- This intentionally does NOT change handle_new_user(), because that function
-- belongs to the Supabase Auth trigger path and should be hardened only with an
-- auth-specific migration/test.

begin;

-- Pin search_path on all public helper functions implicated by the linter.
alter function public.dusk_alpha31_task_readiness(uuid)
  set search_path = public;
alter function public.dusk_alpha31_packing_readiness(uuid)
  set search_path = public;
alter function public.dusk_alpha31_budget_readiness(uuid)
  set search_path = public;
alter function public.dusk_alpha31_expected_status(uuid)
  set search_path = public;
alter function public.dusk_alpha31_ensure_case_study(uuid)
  set search_path = public;
alter function public.dusk_alpha31_recalculate_deployment(uuid)
  set search_path = public;
alter function public.dusk_alpha31_child_recalculate_trigger()
  set search_path = public;
alter function public.dusk_alpha31_prep_recalculate_trigger()
  set search_path = public;
alter function public.dusk_alpha31_lifecycle_sweep()
  set search_path = public;

alter function public.dusk_set_updated_at()
  set search_path = public;
alter function public.dusk_sync_event_tags()
  set search_path = public;
alter function public.set_updated_at()
  set search_path = public;

-- Read-only readiness helpers do not require SECURITY DEFINER.
alter function public.dusk_alpha31_task_readiness(uuid)
  security invoker;
alter function public.dusk_alpha31_packing_readiness(uuid)
  security invoker;
alter function public.dusk_alpha31_budget_readiness(uuid)
  security invoker;
alter function public.dusk_alpha31_expected_status(uuid)
  security invoker;

-- None of these are public client RPCs.
-- Remove direct API execution from PUBLIC / anon / authenticated.
revoke execute on function public.dusk_alpha31_task_readiness(uuid)
  from public, anon, authenticated;
revoke execute on function public.dusk_alpha31_packing_readiness(uuid)
  from public, anon, authenticated;
revoke execute on function public.dusk_alpha31_budget_readiness(uuid)
  from public, anon, authenticated;
revoke execute on function public.dusk_alpha31_expected_status(uuid)
  from public, anon, authenticated;
revoke execute on function public.dusk_alpha31_ensure_case_study(uuid)
  from public, anon, authenticated;
revoke execute on function public.dusk_alpha31_recalculate_deployment(uuid)
  from public, anon, authenticated;
revoke execute on function public.dusk_alpha31_child_recalculate_trigger()
  from public, anon, authenticated;
revoke execute on function public.dusk_alpha31_prep_recalculate_trigger()
  from public, anon, authenticated;
revoke execute on function public.dusk_alpha31_lifecycle_sweep()
  from public, anon, authenticated;

revoke execute on function public.dusk_set_updated_at()
  from public, anon, authenticated;
revoke execute on function public.dusk_sync_event_tags()
  from public, anon, authenticated;
revoke execute on function public.set_updated_at()
  from public, anon, authenticated;

-- Server-side automation uses Supabase's service role.
grant execute on function public.dusk_alpha31_task_readiness(uuid)
  to service_role;
grant execute on function public.dusk_alpha31_packing_readiness(uuid)
  to service_role;
grant execute on function public.dusk_alpha31_budget_readiness(uuid)
  to service_role;
grant execute on function public.dusk_alpha31_expected_status(uuid)
  to service_role;
grant execute on function public.dusk_alpha31_ensure_case_study(uuid)
  to service_role;
grant execute on function public.dusk_alpha31_recalculate_deployment(uuid)
  to service_role;
grant execute on function public.dusk_alpha31_lifecycle_sweep()
  to service_role;

-- Trigger functions are invoked by PostgreSQL triggers rather than browser RPC.
-- Keep service_role access too for administrative/debugging paths.
grant execute on function public.dusk_alpha31_child_recalculate_trigger()
  to service_role;
grant execute on function public.dusk_alpha31_prep_recalculate_trigger()
  to service_role;
grant execute on function public.dusk_set_updated_at()
  to service_role;
grant execute on function public.dusk_sync_event_tags()
  to service_role;
grant execute on function public.set_updated_at()
  to service_role;

commit;
