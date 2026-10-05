-- Dusk Induskries v26 Alpha 9.1
-- Sub-event fix + reusable Media Library + structured deployment tags.

begin;

-- Structured deployment tags while preserving the legacy `tag` field.
alter table public.events
  add column if not exists tags text[] not null default '{}'::text[];

update public.events
set tags = (
  select coalesce(array_agg(distinct trimmed order by trimmed), '{}'::text[])
  from (
    select btrim(piece) as trimmed
    from regexp_split_to_table(coalesce(public.events.tag, ''), ',') piece
    where btrim(piece) <> ''
  ) parts
)
where cardinality(tags) = 0
  and coalesce(btrim(tag), '') <> '';

create or replace function public.dusk_sync_event_tags()
returns trigger
language plpgsql
as $$
declare
  cleaned text[];
begin
  if new.tags is null or cardinality(new.tags) = 0 then
    if coalesce(btrim(new.tag), '') <> '' then
      select coalesce(array_agg(distinct value order by value), '{}'::text[])
      into cleaned
      from (
        select btrim(piece) as value
        from regexp_split_to_table(new.tag, ',') piece
        where btrim(piece) <> ''
      ) s;
      new.tags := cleaned;
    else
      new.tags := '{}'::text[];
    end if;
  else
    select coalesce(array_agg(distinct value order by value), '{}'::text[])
    into cleaned
    from (
      select btrim(piece) as value
      from unnest(new.tags) piece
      where btrim(piece) <> ''
    ) s;
    new.tags := cleaned;
  end if;

  new.tag := coalesce(new.tags[1], nullif(btrim(new.tag), ''), 'Event');
  return new;
end;
$$;

drop trigger if exists events_sync_tags on public.events;

create trigger events_sync_tags
  before insert or update of tag, tags on public.events
  for each row execute function public.dusk_sync_event_tags();

-- The existing media table becomes the reusable global media library.
alter table public.media
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists favorite boolean not null default false,
  add column if not exists source text not null default 'upload',
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists media_set_updated_at on public.media;

create trigger media_set_updated_at
  before update on public.media
  for each row execute function public.dusk_set_updated_at();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'public-media',
  'public-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
