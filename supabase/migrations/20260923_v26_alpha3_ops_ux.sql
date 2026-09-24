-- Dusk Industries v26 Alpha 3
-- Move checkout sweep from packing into Tasks and clarify hotel charger packing.

begin;

update public.loadout_template_items
set label = 'Phone / fan / battery chargers'
where template_id = '40000000-0000-0000-0000-000000000005'
  and label = 'Room charging setup';

update public.packing_items
set label = 'Phone / fan / battery chargers'
where source = 'template:hotel'
  and label = 'Room charging setup';

delete from public.loadout_template_items
where template_id = '40000000-0000-0000-0000-000000000005'
  and label = 'Checkout sweep';

delete from public.packing_items
where source = 'template:hotel'
  and label = 'Checkout sweep';

insert into public.prep_tasks (
  con_prep_id,
  title,
  task_type,
  status,
  duration_minutes,
  sort_order,
  source,
  required
)
select
  cp.id,
  'Hotel checkout / room sweep',
  'hotel',
  'todo',
  20,
  95,
  'alpha3-suggested',
  true
from public.con_preps cp
where not exists (
  select 1
  from public.prep_tasks pt
  where pt.con_prep_id = cp.id
    and lower(pt.title) = lower('Hotel checkout / room sweep')
);

commit;
