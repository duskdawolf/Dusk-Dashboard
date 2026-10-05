-- Dusk Induskries v26 Alpha 8.1
-- Direct-editing support / updated_at tracking
-- Additive and safe to run after Alpha 8.

begin;

alter table public.packing_items
  add column if not exists updated_at timestamptz not null default now();

alter table public.prep_tasks
  add column if not exists updated_at timestamptz not null default now();

alter table public.hotel_stays
  add column if not exists updated_at timestamptz not null default now();

alter table public.travel_segments
  add column if not exists updated_at timestamptz not null default now();

alter table public.cost_entries
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.dusk_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'packing_items_set_updated_at'
  ) then
    create trigger packing_items_set_updated_at
      before update on public.packing_items
      for each row execute function public.dusk_set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'prep_tasks_set_updated_at'
  ) then
    create trigger prep_tasks_set_updated_at
      before update on public.prep_tasks
      for each row execute function public.dusk_set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'hotel_stays_set_updated_at'
  ) then
    create trigger hotel_stays_set_updated_at
      before update on public.hotel_stays
      for each row execute function public.dusk_set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'travel_segments_set_updated_at'
  ) then
    create trigger travel_segments_set_updated_at
      before update on public.travel_segments
      for each row execute function public.dusk_set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'cost_entries_set_updated_at'
  ) then
    create trigger cost_entries_set_updated_at
      before update on public.cost_entries
      for each row execute function public.dusk_set_updated_at();
  end if;
end $$;

commit;
