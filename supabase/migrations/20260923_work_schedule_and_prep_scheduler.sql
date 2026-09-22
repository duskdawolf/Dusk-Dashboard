-- Dusk Industries v12
-- Work schedule, faster sticker throughput, and standard travel buffer.

create table if not exists public.weekly_work_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists weekly_work_blocks_unique_rule
  on public.weekly_work_blocks(name, weekday);

-- M-F 6:00 AM - 2:30 PM
insert into public.weekly_work_blocks
(name, weekday, start_time, end_time, active)
values
  ('Whole Foods', 1, '06:00:00', '14:30:00', true),
  ('Whole Foods', 2, '06:00:00', '14:30:00', true),
  ('Whole Foods', 3, '06:00:00', '14:30:00', true),
  ('Whole Foods', 4, '06:00:00', '14:30:00', true),
  ('Whole Foods', 5, '06:00:00', '14:30:00', true),
  ('Whole Foods', 0, '11:30:00', '20:00:00', true)
on conflict (name, weekday) do update set
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  active = excluded.active;

-- Saturday intentionally has no work block.

insert into public.site_settings(key, value)
values
  ('scheduling', jsonb_build_object(
    'home_timezone', 'America/New_York',
    'airport_arrival_minutes', 90,
    'extra_travel_buffer_minutes', 15,
    'stickers_per_hour', 50,
    'general_prep_rule', 'any_time_outside_work',
    'printing_windows', jsonb_build_array(
      jsonb_build_object('weekday', 2, 'start', '15:00', 'end', '22:00'),
      jsonb_build_object('weekday', 3, 'start', '15:00', 'end', '22:00')
    )
  ))
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

alter table public.weekly_work_blocks enable row level security;
