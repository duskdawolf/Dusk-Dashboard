-- Alpha v31.2. Prerequisites: existing Alpha v31.1 schema, convention_catalog,
-- event_media and media. Run as postgres in Supabase SQL editor. Transactional,
-- rerunnable, no production records deleted. Review legacy mappings afterward.
begin;

create table if not exists public.convention_series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  official_url text,
  maintainer_user_id uuid references public.profiles(id) on delete set null,
  logo_media_id uuid references public.media(id) on delete set null,
  ingest_url text,
  discovery_url text,
  discovery_format text not null default 'jsonld' check (discovery_format in ('jsonld','directory-json')),
  next_discovery_at timestamptz not null default now(),
  ingest_format text not null default 'jsonld' check (ingest_format in ('jsonld','directory-json')),
  auto_refresh boolean not null default false,
  next_refresh_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  retry_after timestamptz not null default '-infinity',
  failure_count integer not null default 0 check (failure_count between 0 and 3),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.convention_series_official_sources (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.convention_series(id) on delete restrict,
  url text not null,
  kind text not null check (kind in ('website','social')),
  verified_at timestamptz not null default now(),
  unique(series_id,url)
);
create table if not exists public.convention_editions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.convention_series(id) on delete restrict,
  edition_key text not null,
  name text not null,
  edition_year integer check (edition_year between 1900 and 2200),
  start_at timestamptz,
  end_at timestamptz,
  timezone text,
  date_precision text not null default 'date_only' check (date_precision in ('date_only','exact','unknown')),
  status text not null default 'scheduled' check (status in ('scheduled','postponed','cancelled')),
  venue_name text,
  venue_address text,
  location text,
  theme text,
  website_url text,
  registration_url text,
  registration_info text,
  schedule_url text,
  schedule_info text,
  policies_url text,
  policies_info text,
  social_url text,
  banner_media_id uuid references public.media(id) on delete set null,
  logo_media_id uuid references public.media(id) on delete set null,
  banner_url text,
  logo_url text,
  public_hotels boolean not null default false,
  verification_status text not null default 'needs_review' check (verification_status in ('needs_review','official')),
  verified_at timestamptz,
  facts_changed_at timestamptz,
  legacy_catalog_id uuid unique references public.convention_catalog(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (series_id, edition_key),
  check (end_at is null or start_at is null or end_at >= start_at),
  check (verification_status <> 'official' or (verified_at is not null and website_url is not null))
);
create table if not exists public.convention_edition_aliases (
  series_id uuid not null references public.convention_series(id) on delete restrict,
  source_key text not null,
  edition_id uuid not null references public.convention_editions(id) on delete restrict,
  primary key(series_id,source_key)
);
create index if not exists convention_editions_upcoming_idx on public.convention_editions(start_at) where verification_status = 'official';
create index if not exists convention_editions_series_idx on public.convention_editions(series_id);
create index if not exists convention_series_refresh_idx on public.convention_series(next_refresh_at) where auto_refresh;

create table if not exists public.convention_edition_hotels (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.convention_editions(id) on delete cascade,
  source_key text not null,
  name text not null,
  role text not null check (role in ('main','overflow','secondary','staff','other')),
  address text,
  booking_url text,
  booking_opens_at timestamptz,
  booking_closes_at timestamptz,
  block_info text,
  source_url text not null,
  verified_at timestamptz not null,
  unique (edition_id, source_key)
);
create table if not exists public.convention_edition_sources (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.convention_editions(id) on delete cascade,
  field_name text not null,
  url text not null,
  authority text not null check (authority in ('official','legacy')),
  confidence text not null default 'unreviewed' check (confidence in ('unreviewed','verified')),
  verified_at timestamptz,
  unique (edition_id, field_name, url)
);
create table if not exists public.convention_directory_runs (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.convention_series(id) on delete set null,
  edition_id uuid references public.convention_editions(id) on delete set null,
  source_url text,
  outcome text not null check (outcome in ('verified','failed','reviewed')),
  message text,
  -- Audit snapshots only; core relationships above are normalized.
  before_facts jsonb,
  after_facts jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.convention_directory_candidates (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.convention_series(id) on delete restrict,
  edition_key text not null,
  source_url text not null,
  authority text not null check (authority in ('secondary','official')),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  -- Unapplied proposals, not directory records. Only the normalized edition tables
  -- are selectable or public; approval validates the proposal before promotion.
  proposed_facts jsonb not null,
  discovered_at timestamptz not null default now(),
  unique(series_id,edition_key,source_url)
);
create index if not exists convention_directory_candidates_pending_idx on public.convention_directory_candidates(series_id) where status='pending';

create index if not exists convention_directory_runs_series_idx on public.convention_directory_runs(series_id, created_at desc);

alter table public.events add column if not exists convention_edition_id uuid references public.convention_editions(id) on delete restrict;
create index if not exists events_convention_edition_idx on public.events(convention_edition_id);
-- Exact grandfathered links only. New records cannot use these exceptions.
create table if not exists public.convention_legacy_links (
  event_id uuid primary key references public.events(id) on delete cascade,
  edition_id uuid not null references public.convention_editions(id) on delete restrict,
  review_note text not null default 'Imported facts require official-source review'
);

insert into public.convention_series(slug,name,official_url)
select distinct on (coalesce(nullif(series_slug,''),slug))
  coalesce(nullif(series_slug,''),slug), name, website_url
from public.convention_catalog c
where not exists (select 1 from public.convention_editions d where d.legacy_catalog_id=c.id)
order by coalesce(nullif(series_slug,''),slug), edition_year desc nulls last
on conflict (slug) do nothing;
insert into public.convention_editions(series_id,edition_key,name,edition_year,start_at,end_at,timezone,date_precision,
  venue_name,venue_address,location,website_url,registration_url,policies_info,legacy_catalog_id)
select s.id,'catalog:'||c.id,c.name,c.edition_year,coalesce(c.starts_at,c.start_date::timestamp at time zone c.timezone),
  coalesce(c.ends_at,c.end_date::timestamp at time zone c.timezone),c.timezone,c.date_precision,c.venue_name,c.venue_address,
  concat_ws(', ',c.city,c.region,c.country),c.website_url,c.registration_url,c.age_policy,c.id
from public.convention_catalog c join public.convention_series s on s.slug=coalesce(nullif(c.series_slug,''),c.slug)
on conflict do nothing;
insert into public.convention_edition_sources(edition_id,field_name,url,authority)
select d.id,'legacy_import',c.source_url,'legacy' from public.convention_editions d
join public.convention_catalog c on c.id=d.legacy_catalog_id where c.source_url is not null
on conflict do nothing;

-- Catalog linkage is used only when the year agrees. Ambiguous manual records get
-- isolated review entries instead of guessing identity or merging occurrences.
update public.events e set convention_edition_id=d.id
from public.con_preps p join public.convention_editions d on d.legacy_catalog_id=p.catalog_id
where p.event_id=e.id and e.event_type='convention' and e.convention_edition_id is null
  and d.edition_year=extract(year from e.start_at);
-- A known catalog link establishes Series identity even when the year differs;
-- retain manual occurrence facts as a separate unverified edition in that series.
insert into public.convention_editions(series_id,edition_key,name,edition_year,start_at,end_at,location)
select d.series_id,'legacy-event:'||e.id,e.title,extract(year from e.start_at)::integer,e.start_at,e.end_at,e.location
from public.events e join public.con_preps p on p.event_id=e.id
join public.convention_editions d on d.legacy_catalog_id=p.catalog_id
where e.event_type='convention' and e.convention_edition_id is null on conflict do nothing;
update public.events e set convention_edition_id=d.id from public.convention_editions d
where d.edition_key='legacy-event:'||e.id and e.event_type='convention' and e.convention_edition_id is null;
insert into public.convention_series(slug,name)
select 'legacy-event-'||id,title from public.events where event_type='convention' and convention_edition_id is null
on conflict do nothing;
insert into public.convention_editions(series_id,edition_key,name,edition_year,start_at,end_at,location)
select s.id,'legacy-event:'||e.id,e.title,extract(year from e.start_at)::integer,e.start_at,e.end_at,e.location
from public.events e join public.convention_series s on s.slug='legacy-event-'||e.id
where e.event_type='convention' and e.convention_edition_id is null on conflict do nothing;
update public.events e set convention_edition_id=d.id from public.convention_editions d
where d.edition_key='legacy-event:'||e.id and e.event_type='convention' and e.convention_edition_id is null;
insert into public.convention_legacy_links(event_id,edition_id)
select e.id,e.convention_edition_id from public.events e join public.convention_editions d on d.id=e.convention_edition_id
where e.event_type='convention' and d.verification_status='needs_review' on conflict do nothing;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='events_noncon_has_no_edition') then
    alter table public.events add constraint events_noncon_has_no_edition check (event_type='convention' or convention_edition_id is null);
  end if;
end $$;
create or replace function public.dusk_directory_enforce_deployment() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.event_type='convention' then
    if new.convention_edition_id is null then raise exception 'Convention requires an official Convention Edition' using errcode='23514'; end if;
    if not exists (select 1 from convention_editions where id=new.convention_edition_id and verification_status='official') then
      if tg_op='UPDATE' and old.event_type='convention' and old.convention_edition_id=new.convention_edition_id
        and exists(select 1 from convention_legacy_links where event_id=new.id and edition_id=new.convention_edition_id) then
        return new;
      end if;
      raise exception 'Select a verified official Convention Edition from the directory' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists dusk_directory_deployment_guard on public.events;
create trigger dusk_directory_deployment_guard before insert or update on public.events
for each row execute function public.dusk_directory_enforce_deployment();

-- RLS: maintenance and review records are server-only, never planning reads.
do $$ declare t text; begin
  foreach t in array array['convention_series','convention_series_official_sources','convention_editions','convention_edition_hotels','convention_edition_sources','convention_directory_runs','convention_legacy_links','convention_directory_candidates','convention_edition_aliases'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

-- Deliberate public projection: no refresh configuration, audit payloads or plans.
create or replace view public.public_convention_editions with (security_barrier=true) as
select e.id,e.series_id,e.edition_key,e.name,e.edition_year,e.start_at,e.end_at,e.timezone,e.date_precision,e.status,
  e.venue_name,e.venue_address,e.location,e.theme,e.website_url,e.registration_url,e.registration_info,
  e.schedule_url,e.schedule_info,e.policies_url,e.policies_info,e.social_url,e.verified_at,e.facts_changed_at,
  s.name as series_name,
  concat_ws(' ',e.name,s.name,e.edition_year,e.location) as search_text,
  coalesce(b.url,e.banner_url) as banner_url,coalesce(l.url,e.logo_url) as logo_url,sl.url as series_logo_url,
  case when e.public_hotels then coalesce((select jsonb_agg(jsonb_build_object('source_key',h.source_key,'name',h.name,'role',h.role,'address',h.address,'booking_url',h.booking_url,
    'booking_opens_at',h.booking_opens_at,'booking_closes_at',h.booking_closes_at,'block_info',h.block_info,'source_url',h.source_url,'verified_at',h.verified_at)
    order by h.role,h.name) from public.convention_edition_hotels h where h.edition_id=e.id),'[]'::jsonb) else '[]'::jsonb end as hotels,
  coalesce((select jsonb_agg(jsonb_build_object('field_name',x.field_name,'url',x.url,'verified_at',x.verified_at,'confidence',x.confidence))
    from public.convention_edition_sources x where x.edition_id=e.id and x.authority='official' and (e.public_hotels or x.field_name !~* 'hotel|lodging')),'[]'::jsonb) as sources
from public.convention_editions e join public.convention_series s on s.id=e.series_id
left join public.media b on b.id=e.banner_media_id and b.published and b.kind='image'
left join public.media l on l.id=e.logo_media_id and l.published and l.kind='image'
left join public.media sl on sl.id=s.logo_media_id and sl.published and sl.kind='image'
where e.verification_status='official';
create or replace view public.public_deployment_featured_media with (security_barrier=true) as
select distinct on (em.event_id) em.event_id,m.url
from public.event_media em join public.events e on e.id=em.event_id and e.published
join public.media m on m.id=em.media_id and m.published and m.kind='image'
where em.featured order by em.event_id,em.sort_order,em.created_at,em.id;
revoke all on public.public_convention_editions,public.public_deployment_featured_media from public,anon,authenticated;
grant select on public.public_convention_editions,public.public_deployment_featured_media to anon,authenticated,service_role;

-- Atomic lease bounds concurrency and on-demand cost, even across app instances.
create or replace function public.dusk_directory_claim(p_series uuid,p_force boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare token uuid:=gen_random_uuid(); begin
  update convention_series set lease_token=token,lease_until=now()+interval '5 minutes',last_attempt_at=now()
  where id=p_series and auto_refresh and ingest_url is not null
    and (lease_until is null or lease_until<now())
    and (last_attempt_at is null or last_attempt_at<now()-interval '10 minutes')
    and (p_force or retry_after<=now())
    and (p_force or next_refresh_at<=now() or next_discovery_at<=now());
  if found then return token; end if; return null;
end $$;

create unique index if not exists convention_notification_dedupe_idx on public.notifications(user_id,dedupe_key)
  where event_key like 'convention.%' and dedupe_key is not null;
create or replace function public.dusk_directory_notify(p_series uuid,p_edition uuid,p_kind text,p_message text,p_fingerprint text) returns void
language plpgsql security definer set search_path=public as $$
begin
  insert into notifications(user_id,severity,category,event_key,dedupe_key,title,message,target_url,action_label,dashboard_visible)
  select distinct recipient,'action','events','convention.'||p_kind,
    'convention:'||p_series||':'||coalesce(p_edition::text,'series')||':'||p_kind||':'||md5(p_fingerprint),
    case when p_kind='changed' then 'Official convention information changed' else 'Convention directory review required' end,
    p_message,case when exists(select 1 from profiles where id=recipient and role='admin') or recipient=(select maintainer_user_id from convention_series where id=p_series) then '/dashboard/convention-directory' else '/dashboard/con-prep' end,'Review convention',true
  from (
    select id as recipient from profiles where role='admin'
    union select maintainer_user_id from convention_series where id=p_series
    union select owner_user_id from events where convention_edition_id=p_edition and owner_user_id is not null
  ) recipients where recipient is not null on conflict do nothing;
end $$;
revoke all on function public.dusk_directory_notify(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.dusk_directory_notify(uuid,uuid,text,text,text) to service_role;

-- One transaction for facts, sources, hotel set, and history. This function has
-- no event/planning write path. Media references remain curator-owned on refresh.
create or replace function public.dusk_directory_apply(p_series uuid,p_facts jsonb,p_source text,p_manual boolean default false,p_candidate uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare d uuid; before_row jsonb; after_row jsonb; before_hotels jsonb; after_hotels jsonb; material_before jsonb; material_after jsonb; h jsonb; x jsonb; ts timestamptz:=now(); begin
  perform 1 from convention_series where id=p_series for update;
  if not found then raise exception 'Unknown Convention Series'; end if;
  select id,to_jsonb(e) into d,before_row from convention_editions e
    where series_id=p_series and edition_key=p_facts->>'edition_key' for update;
  select coalesce(jsonb_agg(to_jsonb(hotel_row)-array['verified_at','id'] order by hotel_row.source_key),'[]') into before_hotels
    from convention_edition_hotels hotel_row where edition_id=d;
  -- Preserve facts absent from a partial metadata source. Explicit null clears a
  -- corrected fact. Never inherit fields from a different edition.
  p_facts:=coalesce(before_row,'{}')||p_facts;
  insert into convention_editions(series_id,edition_key,name,edition_year,start_at,end_at,timezone,date_precision,status,
    venue_name,venue_address,location,theme,website_url,registration_url,registration_info,schedule_url,schedule_info,
    policies_url,policies_info,social_url,banner_url,logo_url,verification_status,verified_at,facts_changed_at)
  values(p_series,p_facts->>'edition_key',p_facts->>'name',(p_facts->>'edition_year')::integer,(p_facts->>'start_at')::timestamptz,
    (p_facts->>'end_at')::timestamptz,p_facts->>'timezone',coalesce(p_facts->>'date_precision','unknown'),coalesce(p_facts->>'status','scheduled'),
    p_facts->>'venue_name',p_facts->>'venue_address',p_facts->>'location',p_facts->>'theme',p_facts->>'website_url',
    p_facts->>'registration_url',p_facts->>'registration_info',p_facts->>'schedule_url',p_facts->>'schedule_info',
    p_facts->>'policies_url',p_facts->>'policies_info',p_facts->>'social_url',p_facts->>'banner_url',p_facts->>'logo_url','official',ts,ts)
  on conflict(series_id,edition_key) do update set
    name=excluded.name,edition_year=excluded.edition_year,start_at=excluded.start_at,end_at=excluded.end_at,timezone=excluded.timezone,
    date_precision=excluded.date_precision,status=excluded.status,venue_name=excluded.venue_name,venue_address=excluded.venue_address,
    location=excluded.location,theme=excluded.theme,website_url=excluded.website_url,registration_url=excluded.registration_url,
    registration_info=excluded.registration_info,schedule_url=excluded.schedule_url,schedule_info=excluded.schedule_info,
    policies_url=excluded.policies_url,policies_info=excluded.policies_info,social_url=excluded.social_url,banner_url=excluded.banner_url,
    logo_url=excluded.logo_url,verification_status='official',verified_at=ts
  returning id into d;
  -- Omitted optional facts mean unknown, never copied from a different edition.
  -- Hotel replacement is explicit; JSON-LD sources that omit hotels retain them.
  if p_facts ? 'hotels' then
    delete from convention_edition_hotels where edition_id=d and source_key not in
      (select value->>'source_key' from jsonb_array_elements(p_facts->'hotels'));
    for h in select value from jsonb_array_elements(p_facts->'hotels') loop
      insert into convention_edition_hotels(edition_id,source_key,name,role,address,booking_url,booking_opens_at,booking_closes_at,block_info,source_url,verified_at)
      values(d,h->>'source_key',h->>'name',h->>'role',h->>'address',h->>'booking_url',(h->>'booking_opens_at')::timestamptz,
        (h->>'booking_closes_at')::timestamptz,h->>'block_info',h->>'source_url',ts)
      on conflict(edition_id,source_key) do update set name=excluded.name,role=excluded.role,address=excluded.address,booking_url=excluded.booking_url,
        booking_opens_at=excluded.booking_opens_at,booking_closes_at=excluded.booking_closes_at,block_info=excluded.block_info,source_url=excluded.source_url,verified_at=ts;
    end loop;
  end if;
  -- Keep each source's own timestamp; a partial check cannot reverify unrelated facts.
  insert into convention_edition_sources(edition_id,field_name,url,authority,confidence,verified_at) values(d,'edition',p_source,'official','verified',ts)
    on conflict(edition_id,field_name,url) do update set verified_at=ts,confidence='verified';
  for x in select value from jsonb_array_elements(coalesce(p_facts->'sources','[]')) loop
    insert into convention_edition_sources(edition_id,field_name,url,authority,confidence,verified_at)
      values(d,x->>'field_name',x->>'url','official','verified',ts) on conflict(edition_id,field_name,url) do update set verified_at=ts,confidence='verified';
  end loop;
  select to_jsonb(e) into after_row from convention_editions e where id=d;
  select coalesce(jsonb_agg(to_jsonb(hotel_row)-array['verified_at','id'] order by hotel_row.source_key),'[]') into after_hotels from convention_edition_hotels hotel_row where edition_id=d;
  if before_hotels is distinct from after_hotels or (before_row - array['verified_at','facts_changed_at']) is distinct from (after_row - array['verified_at','facts_changed_at']) then
    update convention_editions set facts_changed_at=ts where id=d;
  end if;
  insert into convention_directory_runs(series_id,edition_id,source_url,outcome,before_facts,after_facts)
    values(p_series,d,p_source,case when p_manual then 'reviewed' else 'verified' end,jsonb_build_object('edition',before_row,'hotels',before_hotels),
      jsonb_build_object('edition',after_row,'sources',p_facts->'sources','hotels',after_hotels));
  select jsonb_object_agg(key,value) into material_before from jsonb_each(coalesce(before_row,'{}')) where key in
    ('start_at','end_at','status','venue_name','venue_address','location','registration_url','registration_info','schedule_url','policies_url','policies_info');
  select jsonb_object_agg(key,value) into material_after from jsonb_each(after_row) where key in
    ('start_at','end_at','status','venue_name','venue_address','location','registration_url','registration_info','schedule_url','policies_url','policies_info');
  if before_row is not null and (material_before is distinct from material_after or before_hotels is distinct from after_hotels) then
    perform dusk_directory_notify(p_series,d,'changed', 'Official dates, venue, registration, schedule, policies or hotels changed for '||(p_facts->>'name')||'. Review your personal plans; they were not modified.',
      coalesce(material_after::text,'')||after_hotels::text||ts::text);
  end if;
  if p_candidate is not null then
    if not p_manual then raise exception 'Candidate approval requires administrator review'; end if;
    if not exists(select 1 from convention_directory_candidates where id=p_candidate and series_id=p_series and status='pending') then raise exception 'Candidate is not pending in this series'; end if;
    insert into convention_edition_aliases(series_id,source_key,edition_id)
      select p_series,edition_key,d from convention_directory_candidates where id=p_candidate
      on conflict(series_id,source_key) do update set edition_id=excluded.edition_id;
    update convention_directory_candidates set status='resolved' where id=p_candidate;
  end if;
  return d;
end $$;
revoke all on function public.dusk_directory_claim(uuid,boolean),public.dusk_directory_apply(uuid,jsonb,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.dusk_directory_claim(uuid,boolean),public.dusk_directory_apply(uuid,jsonb,text,boolean,uuid) to service_role;
notify pgrst,'reload schema';
commit;
