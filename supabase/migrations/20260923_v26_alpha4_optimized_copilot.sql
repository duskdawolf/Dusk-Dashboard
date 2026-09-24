-- Dusk Industries v26.0 Alpha 4
-- Cost-optimized Chaos Copilot + Convention Ops task-template compatibility.
--
-- Chaos usage telemetry is stored in existing copilot_messages.metadata, so
-- this migration does not add a billing/usage table.

begin;

-- The Alpha 3 UI began loading suggested task templates. Guarantee these
-- tables exist for databases that only ran the earlier Alpha migrations.
create table if not exists public.prep_task_templates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  category text not null default 'general',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists prep_task_templates_global_slug_idx
  on public.prep_task_templates(slug)
  where owner_user_id is null;

create unique index if not exists prep_task_templates_owner_slug_idx
  on public.prep_task_templates(owner_user_id, slug)
  where owner_user_id is not null;

create table if not exists public.prep_task_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.prep_task_templates(id) on delete cascade,
  parent_template_task_id uuid references public.prep_task_template_items(id) on delete cascade,
  title text not null,
  task_type text not null default 'prep',
  relative_days_before_departure integer,
  duration_minutes integer,
  sort_order integer not null default 0,
  notes text
);

alter table public.prep_task_templates enable row level security;
alter table public.prep_task_template_items enable row level security;

drop trigger if exists prep_task_templates_set_updated_at on public.prep_task_templates;
create trigger prep_task_templates_set_updated_at
  before update on public.prep_task_templates
  for each row execute procedure public.set_updated_at();

insert into public.prep_task_templates
(id, owner_user_id, slug, name, description, category, active)
values
  ('47000000-0000-0000-0000-000000000001', null, 'hotel-stay', 'Hotel Stay Tasks', 'Booking, arrival, room, and checkout tasks.', 'hotel', true),
  ('47000000-0000-0000-0000-000000000002', null, 'fursuit-prep', 'Fursuit Prep Tasks', 'Pre-con cleaning, charging, inspection, and repair checks.', 'fursuit', true),
  ('47000000-0000-0000-0000-000000000003', null, 'donk-toss-ops', 'Donk Toss Ops', 'Production, equipment, prizes, signage, and panel-readiness tasks.', 'programming', true),
  ('47000000-0000-0000-0000-000000000004', null, 'social-prep', 'Convention Social Prep', 'Pre-con social copy/media preparation tasks.', 'social', true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  active = excluded.active;

delete from public.prep_task_template_items
where template_id in (
  '47000000-0000-0000-0000-000000000001',
  '47000000-0000-0000-0000-000000000002',
  '47000000-0000-0000-0000-000000000003',
  '47000000-0000-0000-0000-000000000004'
);

insert into public.prep_task_template_items
(id, template_id, parent_template_task_id, title, task_type, relative_days_before_departure, duration_minutes, sort_order)
values
  ('47100000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000001',null,'Hotel Stay','hotel',14,30,10),
  ('47100000-0000-0000-0000-000000000002','47000000-0000-0000-0000-000000000001','47100000-0000-0000-0000-000000000001','Confirm reservation and payment status','hotel',14,15,11),
  ('47100000-0000-0000-0000-000000000003','47000000-0000-0000-0000-000000000001','47100000-0000-0000-0000-000000000001','Check check-in / parking / incidental requirements','hotel',7,15,12),
  ('47100000-0000-0000-0000-000000000004','47000000-0000-0000-0000-000000000001','47100000-0000-0000-0000-000000000001','Hotel checkout sweep','hotel',0,20,13),

  ('47200000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000002',null,'Fursuit Prep','prep',3,60,10),
  ('47200000-0000-0000-0000-000000000002','47000000-0000-0000-0000-000000000002','47200000-0000-0000-0000-000000000001','Inspect seams, zipper, paws, and high-stress areas','prep',3,20,11),
  ('47200000-0000-0000-0000-000000000003','47000000-0000-0000-0000-000000000002','47200000-0000-0000-0000-000000000001','Clean / brush suit as needed','prep',2,30,12),
  ('47200000-0000-0000-0000-000000000004','47000000-0000-0000-0000-000000000002','47200000-0000-0000-0000-000000000001','Charge head fan and portable fans','prep',1,20,13),
  ('47200000-0000-0000-0000-000000000005','47000000-0000-0000-0000-000000000002','47200000-0000-0000-0000-000000000001','Verify repair supplies are stocked','prep',1,10,14),

  ('47300000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000003',null,'Donk Toss Ops','programming',7,90,10),
  ('47300000-0000-0000-0000-000000000002','47000000-0000-0000-0000-000000000003','47300000-0000-0000-0000-000000000001','Verify tournament kit and rules','programming',7,20,11),
  ('47300000-0000-0000-0000-000000000003','47000000-0000-0000-0000-000000000003','47300000-0000-0000-0000-000000000001','Print / verify signage','production',5,30,12),
  ('47300000-0000-0000-0000-000000000004','47000000-0000-0000-0000-000000000003','47300000-0000-0000-0000-000000000001','Count and prep prizes','programming',3,20,13),
  ('47300000-0000-0000-0000-000000000005','47000000-0000-0000-0000-000000000003','47300000-0000-0000-0000-000000000001','Print required stickers / giveaways','production',3,60,14),
  ('47300000-0000-0000-0000-000000000006','47000000-0000-0000-0000-000000000003','47300000-0000-0000-0000-000000000001','Final host notes / scoring sanity check','programming',1,20,15),

  ('47400000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000004',null,'Convention Social Prep','social',5,45,10),
  ('47400000-0000-0000-0000-000000000002','47000000-0000-0000-0000-000000000004','47400000-0000-0000-0000-000000000001','Choose pre-con media','social',5,15,11),
  ('47400000-0000-0000-0000-000000000003','47000000-0000-0000-0000-000000000004','47400000-0000-0000-0000-000000000001','Draft platform-specific teaser copy','social',4,20,12),
  ('47400000-0000-0000-0000-000000000004','47000000-0000-0000-0000-000000000004','47400000-0000-0000-0000-000000000001','Schedule / approve pre-con posts','social',2,15,13);

-- Keep actions in tasks, physical objects in packing.
delete from public.loadout_template_items
where template_id = '40000000-0000-0000-0000-000000000005'
  and label in ('Checkout sweep','Room charging setup');

insert into public.loadout_template_items
(id, template_id, parent_template_item_id, category, label, quantity, sort_order)
values
  ('45000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000005',null,'Hotel','Power strip / charging block',1,20),
  ('45000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000005',null,'Hotel','Charging cables',1,30),
  ('45000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000005',null,'Hotel','Toiletries',1,40)
on conflict (id) do update set
  category = excluded.category,
  label = excluded.label,
  quantity = excluded.quantity,
  sort_order = excluded.sort_order;

commit;
