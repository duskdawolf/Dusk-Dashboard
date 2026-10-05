-- Seed current Dusk Industries content into Supabase.
-- Safe to re-run: events/products/socials upsert on stable keys.

insert into public.social_links (id, name, handle, url, sort_order, active)
values
  ('telegram', 'Telegram', '@duskdawolf', 'https://t.me/duskdawolf', 10, true),
  ('twitter', 'X / Twitter', '@duskdawolf', 'https://x.com/duskdawolf', 20, true),
  ('instagram', 'Instagram', '@duskdawolf', 'https://instagram.com/duskdawolf', 30, true),
  ('snapchat', 'Snapchat', '@duskdawolf', 'https://www.snapchat.com/add/duskdawolf', 40, true)
on conflict (id) do update set
  name = excluded.name,
  handle = excluded.handle,
  url = excluded.url,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.events
(slug, title, start_at, end_at, location, description, tag, event_type, quarter, state_code, latitude, longitude, published)
values
  ('anthro-new-england-2026', 'Anthro New England',
   '2026-01-15T09:00:00-05:00', null, 'Boston, MA',
   'Boston-area convention deployment.', 'Convention', 'convention', 'q1', 'MA', 42.3601, -71.0589, true),

  ('furrydelphia-2026', 'Furrydelphia',
   '2026-08-06T09:00:00-04:00', null, 'Philadelphia, PA',
   'Northeast operations and major social deployment.', 'Convention', 'convention', 'q3', 'PA', 39.9526, -75.1652, true),

  ('megaplex-2026', 'Megaplex',
   '2026-08-20T09:00:00-04:00', null, 'Orlando, FL',
   '18+ destination-con expansion into Orlando.', 'Convention', 'convention', 'q3', 'FL', 28.5383, -81.3792, true),

  ('kimball-farms-furmeet-2026', 'Kimball Farms Furmeet',
   '2026-09-19T10:00:00-04:00', null, 'Westford, MA',
   'Regional furry field deployment in Massachusetts.', 'Meetup', 'meetup', 'q3', 'MA', 42.5793, -71.4406, true),

  ('topsfield-fair-parade-2026', 'Topsfield Fair Parade',
   '2026-10-06T17:00:00-04:00', '2026-10-08T18:00:00-04:00', 'Topsfield, MA',
   'Furry parade deployment.', 'Public Event', 'public', 'q4', 'MA', 42.6376, -70.9495, true),

  ('topsfield-fair-furry-meetup-2026', 'Topsfield Fair Furry Meetup',
   '2026-10-10T12:00:00-04:00', '2026-10-10T16:00:00-04:00', 'Topsfield, MA',
   'Furry meetup operation at the fair.', 'Meetup', 'meetup', 'q4', 'MA', 42.6376, -70.9495, true),

  ('escobars-corn-maze-furmeet-2026', 'Escobar''s Corn Maze Furmeet',
   '2026-10-17T10:00:00-04:00', '2026-10-17T17:00:00-04:00', 'Portsmouth, RI',
   'Agricultural navigation initiative with full wolf deployment.', 'Fursuiting', 'meetup', 'q4', 'RI', 41.6023, -71.2503, true),

  ('furpocalypse-2026', 'FurPocalypse',
   '2026-10-29T09:00:00-04:00', null, 'Stamford, CT',
   'Convention operation featuring the official Dusk Donk Deployment.', 'Hosting', 'hosting', 'q4', 'CT', 41.0534, -73.5387, true),

  ('midwest-furfest-2026', 'Midwest FurFest',
   '2026-12-03T09:00:00-06:00', null, 'Rosemont, IL',
   'Large-scale Midwest expansion effort.', 'Convention', 'convention', 'q4', 'IL', 41.9953, -87.8834, true)
on conflict (slug) do update set
  title = excluded.title,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  location = excluded.location,
  description = excluded.description,
  tag = excluded.tag,
  event_type = excluded.event_type,
  quarter = excluded.quarter,
  state_code = excluded.state_code,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  published = excluded.published;

insert into public.products
(slug, name, description, image_url, price_label, sort_order, active)
values
  ('megaplex-26', 'Megaplex ''26', 'Dusk''s Megaplex 2026 sticker.', '/assets/sticker-megaplex.jpg', 'Coming soon', 10, true),
  ('recline', 'Recline', 'Signature lounging Dusk sticker.', '/assets/sticker-recline.jpg', 'Coming soon', 20, true),
  ('worth-it', 'Worth It', 'The extremely relatable Worth It design.', '/assets/sticker-worth-it.jpg', 'Coming soon', 30, true),
  ('eeepy', 'Eeepy', 'Sleepy wolf deployment.', '/assets/sticker-eeepy.png', 'Coming soon', 40, true),
  ('pwease', 'Pwease', 'Weaponized pleading.', '/assets/sticker-pwease.png', 'Coming soon', 50, true),
  ('dead-dusk', 'Dead Dusk', 'Operationally deceased.', '/assets/sticker-dead.png', 'Coming soon', 60, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  price_label = excluded.price_label,
  sort_order = excluded.sort_order,
  active = excluded.active;
