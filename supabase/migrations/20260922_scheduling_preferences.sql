-- Dusk Industries v11
-- Scheduling defaults from Dusk:
-- Printing: Tuesday & Wednesday, 3 PM - 10 PM
-- Throughput: 25 stickers/hour
-- Airport arrival target: 90 minutes before flight

alter table public.prep_tasks
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists scheduled_end_at timestamptz;

alter table public.travel_segments
  add column if not exists airport_arrival_target_at timestamptz,
  add column if not exists leave_for_airport_at timestamptz,
  add column if not exists transit_minutes integer,
  add column if not exists extra_travel_buffer_minutes integer not null default 0;

create unique index if not exists availability_windows_unique_rule
  on public.availability_windows(name, weekday, window_type);

insert into public.availability_windows
(name, weekday, start_time, end_time, window_type, active)
values
  ('Sticker Printing', 2, '15:00:00', '22:00:00', 'printing', true),
  ('Sticker Printing', 3, '15:00:00', '22:00:00', 'printing', true)
on conflict (name, weekday, window_type) do update set
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  active = excluded.active;

insert into public.site_settings(key, value)
values
  ('scheduling', jsonb_build_object(
    'home_timezone', 'America/New_York',
    'airport_arrival_minutes', 90,
    'stickers_per_hour', 25,
    'printing_windows', jsonb_build_array(
      jsonb_build_object('weekday', 2, 'start', '15:00', 'end', '22:00'),
      jsonb_build_object('weekday', 3, 'start', '15:00', 'end', '22:00')
    )
  ))
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();
