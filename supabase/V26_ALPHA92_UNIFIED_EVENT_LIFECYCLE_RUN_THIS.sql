-- Dusk Induskries v26 Alpha 9.2
-- Unified event lifecycle + Case Study Media.
-- Requires Alpha 9.1.

begin;

-- ---------------------------------------------------------------------------
-- Case-study metadata quality-of-life
-- ---------------------------------------------------------------------------

alter table public.case_studies
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists case_studies_set_updated_at
  on public.case_studies;

create trigger case_studies_set_updated_at
  before update on public.case_studies
  for each row execute function public.dusk_set_updated_at();

-- One case study per event keeps the lifecycle model unambiguous.
create unique index if not exists case_studies_event_id_unique
  on public.case_studies(event_id)
  where event_id is not null;

-- ---------------------------------------------------------------------------
-- Reusable media attachment layer.
--
-- `media` remains the single reusable asset library.
-- `event_media` says where/how an existing asset is used by a specific event.
-- ---------------------------------------------------------------------------

create table if not exists public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  caption_override text,
  sort_order integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, media_id)
);

create index if not exists event_media_event_sort_idx
  on public.event_media(event_id, sort_order, created_at);

create index if not exists event_media_media_idx
  on public.event_media(media_id);

alter table public.event_media enable row level security;

drop trigger if exists event_media_set_updated_at
  on public.event_media;

create trigger event_media_set_updated_at
  before update on public.event_media
  for each row execute function public.dusk_set_updated_at();

-- Preserve every historical association created by the old media.event_id model.
insert into public.event_media (
  event_id,
  media_id,
  caption_override,
  sort_order,
  featured
)
select
  m.event_id,
  m.id,
  null,
  m.sort_order,
  false
from public.media m
where m.event_id is not null
on conflict (event_id, media_id) do nothing;

-- Give each event with media one featured image if it does not already have one.
with first_media as (
  select distinct on (event_id)
    id,
    event_id
  from public.event_media
  order by event_id, sort_order asc, created_at asc
)
update public.event_media em
set featured = true
from first_media fm
where em.id = fm.id
  and not exists (
    select 1
    from public.event_media existing
    where existing.event_id = em.event_id
      and existing.featured = true
  );

-- If a case study doesn't yet have a hero image, inherit the first attached image.
update public.case_studies cs
set image_url = candidate.url,
    updated_at = now()
from (
  select distinct on (em.event_id)
    em.event_id,
    m.url
  from public.event_media em
  join public.media m on m.id = em.media_id
  where m.kind = 'image'
  order by em.event_id, em.featured desc, em.sort_order asc, em.created_at asc
) candidate
where cs.event_id = candidate.event_id
  and coalesce(btrim(cs.image_url), '') = '';

commit;
