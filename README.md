# Dusk Industries™ — Next.js / Node.js rebuild

This is the first real application version of Dusk Industries rather than a static HTML mockup.

## Stack

- **Node.js**
- **Next.js App Router**
- **TypeScript**
- **Tailwind CSS**
- **PostgreSQL / Supabase-ready data layer**
- **Supabase Storage/Auth-ready**
- **Stripe-ready** for the future shop
- **Zod** validation for backend quote submissions

No Bootstrap. The site keeps its custom Dusk corporate-megacorp identity instead of inheriting a generic component look.

## Included

- Dusk Industries homepage with the **INDUSKRIES™** graffiti logo
- Dynamic event rendering through a repository layer
- Quarter-filtered animated pawprint map
- Telegram / X / Instagram / Snapchat links for **@duskdawolf**
- Case Studies in Chaos
- Donk Toss project identity/page
- Dusk Shop product catalog
- Dusk Sticker Factory quote form
- `/api/quotes` Node/Next backend route
- Dusk Dashboard UI prototype
- Supabase schema for events, socials, projects, case studies, media, products, quotes, orders, and settings
- Seed-data fallback so the app works before a Supabase project is connected

## Run locally

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Fill in the Supabase URL, anon key, and service-role key.
5. Restart the dev server.

Until those environment variables exist, the public site automatically uses `src/data/seed.ts`.

## Architecture

```text
Browser
  │
  ├─ Public Next.js pages
  │   ├─ Events
  │   ├─ Shop
  │   ├─ Case Studies
  │   ├─ Donk Toss
  │   └─ Sticker Factory
  │
  ├─ Dusk Dashboard
  │
  ▼
Next.js / Node.js
  ├─ Server Components
  ├─ Route Handlers
  ├─ Repository layer
  └─ Validation / business logic
  │
  ▼
Supabase / PostgreSQL
  ├─ events
  ├─ social_links
  ├─ projects
  ├─ case_studies
  ├─ media
  ├─ products
  ├─ product_variants
  ├─ print_quotes
  ├─ orders
  └─ site_settings
```

## Next production steps

1. Add Supabase Auth and make `/dashboard` Dusk-only.
2. Build real CRUD screens in the dashboard.
3. Move uploaded photos/video to Supabase Storage.
4. Make events, map points, shop products, and case studies fully database-managed.
5. Add secure artwork upload to a private quote-artwork bucket.
6. Add Stripe Checkout + webhook-backed order records.
7. Deploy on Vercel.

The whole point: **add an event once in the Dusk Dashboard, and the homepage, event list, map, and archives all update automatically.**
