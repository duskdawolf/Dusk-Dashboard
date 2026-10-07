-- Minimal Alpha v31.1 contracts for isolated directory migration tests.
-- Never execute this fixture against a real project.
create role anon; create role authenticated; create role service_role bypassrls;
create table profiles(id uuid primary key,role text);
create table events(id uuid primary key default gen_random_uuid(), title text not null,event_type text not null,start_at timestamptz,end_at timestamptz,location text,published boolean default false,owner_user_id uuid,description text);
create table media(id uuid primary key default gen_random_uuid(),url text,published boolean,kind text);
create table event_media(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),media_id uuid references media(id),featured boolean,sort_order integer default 0,created_at timestamptz default now());
create table convention_catalog(id uuid primary key default gen_random_uuid(),slug text,series_slug text,name text,website_url text,edition_year integer,starts_at timestamptz,ends_at timestamptz,start_date date,end_date date,timezone text,date_precision text,venue_name text,venue_address text,city text,region text,country text,registration_url text,age_policy text,source_url text);
create table con_preps(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),catalog_id uuid references convention_catalog(id),notes text);
create table hotel_stays(id uuid primary key default gen_random_uuid(),con_prep_id uuid references con_preps(id),confirmation_code text,hotel_name text);
create table prep_tasks(id uuid primary key default gen_random_uuid(),con_prep_id uuid references con_preps(id),title text);
create table cost_entries(id uuid primary key default gen_random_uuid(),con_prep_id uuid references con_preps(id),amount_cents int);
create table packing_items(id uuid primary key default gen_random_uuid(),con_prep_id uuid references con_preps(id),label text);
create table notifications(id uuid primary key default gen_random_uuid(),user_id uuid,severity text,category text,event_key text,dedupe_key text,title text,message text,target_url text,action_label text,dashboard_visible boolean,created_at timestamptz default now());
insert into profiles values('00000000-0000-4000-8000-000000000001','admin');
insert into convention_catalog(id,slug,series_slug,name,edition_year,start_date,end_date,timezone,date_precision,website_url,source_url) values('00000000-0000-4000-8000-000000000010','test-2027','test-con','Test Con 2027',2027,'2027-02-01','2027-02-03','America/New_York','date_only','https://testcon.org/2027','https://secondary.org/testcon');
insert into events(id,title,event_type,start_at,end_at,location,published,owner_user_id,description) values
('00000000-0000-4000-8000-000000000020','Legacy linked','convention','2027-02-01','2027-02-03','Personal location',true,'00000000-0000-4000-8000-000000000001','Public description'),
('00000000-0000-4000-8000-000000000021','Legacy manual','convention','2027-04-01','2027-04-04','Personal location',true,null,'Public description'),
('00000000-0000-4000-8000-000000000022','Other event','hosting','2027-04-01','2027-04-04','Local',false,null,'Public description');
insert into con_preps(id,event_id,catalog_id,notes) values('00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010','PRIVATE_NOTES_SENTINEL');
insert into hotel_stays(con_prep_id,confirmation_code,hotel_name) values('00000000-0000-4000-8000-000000000030','PRIVATE_CONFIRMATION_SENTINEL','Personal accommodation');
insert into prep_tasks(con_prep_id,title) values('00000000-0000-4000-8000-000000000030','PRIVATE_TASK_SENTINEL');
insert into cost_entries(con_prep_id,amount_cents) values('00000000-0000-4000-8000-000000000030',12345);
insert into packing_items(con_prep_id,label) values('00000000-0000-4000-8000-000000000030','PRIVATE_PACKING_SENTINEL');
insert into events(id,title,event_type,start_at,end_at,location,published) values('00000000-0000-4000-8000-000000000023','Known series new year','convention','2028-02-01','2028-02-03','Personal location',false);
insert into con_preps(event_id,catalog_id) values('00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000010');
