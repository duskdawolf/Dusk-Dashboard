\set ON_ERROR_STOP on
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end $$;
select pg_temp.assert_true((select count(*)=4 from events),'events preserved');
select pg_temp.assert_true((select count(*)=3 from convention_legacy_links),'legacy links preserved');
select pg_temp.assert_true((select count(*)=0 from public_convention_editions),'unreviewed imports not public/selectable');
update events set description='updated personal description' where title='Legacy manual';
do $$ begin
  begin insert into events(title,event_type) values('Bad convention','convention'); raise exception 'Expected missing edition rejection'; exception when check_violation then null; end;
  begin insert into events(title,event_type,convention_edition_id) select 'Bad unverified','convention',id from convention_editions limit 1; raise exception 'Expected unverified rejection'; exception when check_violation then null; end;
  begin update events set event_type='convention' where title='Other event'; raise exception 'Expected conversion rejection'; exception when check_violation then null; end;
end $$;
select id as series_id from convention_series where slug='test-con' \gset
select pg_temp.assert_true((select d.series_id=:'series_id' from events e join convention_editions d on d.id=e.convention_edition_id where e.title='Known series new year'),'different year retains known series');
select dusk_directory_apply(:'series_id','{"edition_key":"catalog:00000000-0000-4000-8000-000000000010","name":"Test Con 2027","edition_year":2027,"start_at":"2027-02-01T12:00:00Z","end_at":"2027-02-03T12:00:00Z","website_url":"https://testcon.org/2027","location":"Official city","theme":"Official theme","hotels":[{"source_key":"main","name":"Official Main","role":"main","source_url":"https://testcon.org/hotels"},{"source_key":"overflow","name":"Official Overflow","role":"overflow","source_url":"https://testcon.org/hotels"}]}','https://testcon.org/2027',true) as edition_id \gset
select pg_temp.assert_true((select count(*)=1 from public_convention_editions),'verified edition public');
select pg_temp.assert_true((select hotels='[]'::jsonb from public_convention_editions where id=:'edition_id'),'official hotels private by default');
select pg_temp.assert_true((select count(*)=2 from convention_edition_hotels),'multiple hotels');
update convention_editions set public_hotels=true where id=:'edition_id';
select pg_temp.assert_true((select jsonb_array_length(hotels)=2 from public_convention_editions where id=:'edition_id'),'hotel publication opt in');
insert into events(title,event_type,convention_edition_id) values('New valid convention','convention',:'edition_id');
insert into events(title,event_type) values('New manual other','meetup');
do $$ begin
  begin update events set convention_edition_id=(select id from convention_editions limit 1) where title='New manual other'; raise exception 'Expected noncon reference rejection'; exception when check_violation then null; end;
end $$;
create temp table before_plan as select to_jsonb(e)-'convention_edition_id' as record from events e where title='Legacy linked';
create temp table before_children as select (select jsonb_agg(h) from hotel_stays h) as hotels,(select jsonb_agg(t) from prep_tasks t) as tasks,(select jsonb_agg(p) from packing_items p) as packing,(select jsonb_agg(c) from cost_entries c) as costs;
select dusk_directory_apply(:'series_id','{"edition_key":"catalog:00000000-0000-4000-8000-000000000010","name":"Test Con 2027","website_url":"https://testcon.org/2027","start_at":"2027-02-02T12:00:00Z","hotels":[]}','https://testcon.org/2027');
select pg_temp.assert_true((select count(*)=0 from convention_edition_hotels),'official hotel removal');
select pg_temp.assert_true((select record=(select to_jsonb(e)-'convention_edition_id' from events e where title='Legacy linked') from before_plan),'refresh preserves event plans');
select pg_temp.assert_true((select hotels=(select jsonb_agg(h) from hotel_stays h) and tasks=(select jsonb_agg(t) from prep_tasks t) and packing=(select jsonb_agg(p) from packing_items p) and costs=(select jsonb_agg(c) from cost_entries c) from before_children),'refresh preserves reservations tasks packing budgets');
select pg_temp.assert_true((select theme='Official theme' from convention_editions where id=:'edition_id'),'partial metadata retains other sourced facts');
create temp table notice_count as select count(*) n from notifications;
select dusk_directory_apply(:'series_id','{"edition_key":"catalog:00000000-0000-4000-8000-000000000010","name":"Test Con 2027","website_url":"https://testcon.org/2027","start_at":"2027-02-02T12:00:00Z","hotels":[]}','https://testcon.org/2027');
select pg_temp.assert_true((select count(*)=(select n from notice_count) from notifications),'no-op refresh does not spam');
select pg_temp.assert_true((select count(*)>0 from notifications),'material change dashboard notification');
select pg_temp.assert_true((select count(*)=1 from convention_editions where edition_key='catalog:00000000-0000-4000-8000-000000000010'),'idempotent refresh');
insert into media(id,url,published,kind) values('00000000-0000-4000-8000-000000000040','https://assets.org/private.jpg',false,'image'),('00000000-0000-4000-8000-000000000041','https://assets.org/public.jpg',true,'image');
insert into event_media(event_id,media_id,featured) values('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000040',true),('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000041',true);
select pg_temp.assert_true((select count(*)=0 from public_deployment_featured_media),'private image and private parent never public');
update event_media set media_id='00000000-0000-4000-8000-000000000041' where event_id='00000000-0000-4000-8000-000000000020';
select pg_temp.assert_true((select count(*)=1 from public_deployment_featured_media),'public featured media available');
update convention_editions set banner_media_id='00000000-0000-4000-8000-000000000040' where id=:'edition_id';
select pg_temp.assert_true((select banner_url is null from public_convention_editions where id=:'edition_id'),'private directory banner excluded');
select pg_temp.assert_true(not has_table_privilege('anon','convention_editions','SELECT'),'raw directory protected');
select pg_temp.assert_true(not has_table_privilege('authenticated','convention_directory_candidates','SELECT'),'candidate proposals protected');
select pg_temp.assert_true(not has_function_privilege('anon','dusk_directory_apply(uuid,jsonb,text,boolean,uuid)','EXECUTE'),'anonymous writes denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','dusk_directory_claim(uuid,boolean)','EXECUTE'),'browser lease writes denied');
set role anon;
select count(*) from public_convention_editions;
select count(*) from public_deployment_featured_media;
reset role;
select pg_temp.assert_true((select jsonb_agg(e)::text not like '%PRIVATE_%' from public_convention_editions e),'public projection has no planning sentinels');
update convention_series set auto_refresh=true,ingest_url='https://testcon.org/editions' where id=:'series_id';
select pg_temp.assert_true(dusk_directory_claim(:'series_id',true) is not null,'initial lease');
select pg_temp.assert_true(dusk_directory_claim(:'series_id',true) is null,'concurrent refresh bounded');
select pg_temp.assert_true((select count(*)=0 from information_schema.columns where table_name='public_convention_editions' and column_name in ('confirmation_code','notes','budget','cost_cents','owner_user_id','ingest_url')),'public columns explicit');

insert into convention_directory_candidates(id,series_id,edition_key,source_url,authority,reason,proposed_facts) values('00000000-0000-4000-8000-000000000099',:'series_id','https://testcon.org/official-2027','https://testcon.org/official-2027','official','Identity review','{}');
select dusk_directory_apply(:'series_id','{"edition_key":"catalog:00000000-0000-4000-8000-000000000010","name":"Test Con 2027","website_url":"https://testcon.org/2027"}','https://testcon.org/2027',true,'00000000-0000-4000-8000-000000000099');
select pg_temp.assert_true((select edition_id=:'edition_id' from convention_edition_aliases where source_key='https://testcon.org/official-2027'),'review records stable source alias');
select pg_temp.assert_true((select status='resolved' from convention_directory_candidates where id='00000000-0000-4000-8000-000000000099'),'candidate review resolved atomically');

select pg_temp.assert_true(not has_table_privilege('anon','public_convention_editions','INSERT'),'public directory is read only');
