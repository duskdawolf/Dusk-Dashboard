-- Dusk Industries Supabase schema
-- Run in Supabase SQL Editor after creating a project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'viewer' check (role in ('viewer','editor','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  description text,
  tag text not null default 'Event',
  quarter text not null check (quarter in ('q1','q2','q3','q4')),
  map_x numeric,
  map_y numeric,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_links (
  id text primary key,
  name text not null,
  handle text not null,
  url text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  summary text,
  status text not null default 'active',
  content jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  image_url text not null,
  status text not null,
  challenge text not null,
  solution text not null,
  outcome text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('image','video')),
  url text not null,
  alt_text text,
  event_id uuid references public.events(id) on delete set null,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  image_url text not null,
  price_label text,
  stripe_price_id text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text unique,
  price_cents integer,
  stock integer,
  active boolean not null default true
);

create table if not exists public.print_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  contact text not null,
  sticker_type text not null,
  quantity integer not null,
  size text not null,
  notes text,
  artwork_url text,
  status text not null default 'new' check (status in ('new','reviewing','quoted','approved','production','complete','declined')),
  quoted_cents integer,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text unique,
  customer_email text,
  status text not null default 'pending',
  total_cents integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Public read policies
alter table public.events enable row level security;
alter table public.social_links enable row level security;
alter table public.projects enable row level security;
alter table public.case_studies enable row level security;
alter table public.media enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.print_quotes enable row level security;
alter table public.orders enable row level security;
alter table public.site_settings enable row level security;

create policy "Public can read published events" on public.events for select using (published = true);
create policy "Public can read active socials" on public.social_links for select using (active = true);
create policy "Public can read published projects" on public.projects for select using (published = true);
create policy "Public can read published case studies" on public.case_studies for select using (published = true);
create policy "Public can read published media" on public.media for select using (published = true);
create policy "Public can read active products" on public.products for select using (active = true);
create policy "Public can read active variants" on public.product_variants for select using (active = true);

-- Public quote intake. Keep writes narrow; service-role can manage all.
create policy "Anyone can create a print quote" on public.print_quotes for insert with check (true);

-- Storage bucket suggestion:
-- Create a public bucket named `public-media` for published site assets.
-- Create a private bucket named `quote-artwork` for customer uploads.
