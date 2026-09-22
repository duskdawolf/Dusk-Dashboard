# Dusk Industries™ v24.4.2 — Reauthentication + Global Version Footer

Final v24 infrastructure release before v25 Social Publishing.

## Account Security

New authenticated route:

```text
/dashboard/account
```

Both email and password changes now use:

```text
supabase.auth.reauthenticate()
        ↓
branded OTP email
        ↓
user enters nonce
        ↓
supabase.auth.updateUser(..., nonce)
```

Branded template:

```text
supabase/email-templates/reauthentication.html
```

## Footer

The root layout now adds a footer to every page:

```text
Copyright 2026 Dusk Induskries.                     v24.4.2
```

No SQL migration is required.

Upgrade instructions:

```text
UPGRADE_FROM_V24_4_1.md
```

---

# Dusk Industries™ v24.4.1 — Cross-Browser Auth + Branded Emails

v24.4.1 replaces recovery-email PKCE dependence with a TokenHash confirmation
route so a password reset can be requested in one browser/device and completed
in another.

New route:

```text
/auth/confirm
```

It verifies Supabase `token_hash` + auth type server-side and establishes the
SSR session before redirecting to `/reset-password` or `/dashboard`.

Included branded Supabase Auth templates:

```text
supabase/email-templates/recovery.html
supabase/email-templates/magic-link.html
supabase/email-templates/confirm-signup.html
supabase/email-templates/invite.html
supabase/email-templates/change-email.html
```

Notification Ops Resend emails now use the same Dusk Industries spray-paint
logo and website visual system.

Important: the Recovery template must be pasted into Supabase Auth manually;
deploying application code cannot modify the hosted project's email template.

Setup:

```text
AUTH_EMAIL_TEMPLATES.md
UPGRADE_FROM_V24_4.md
```

No SQL migration is required.

---

# Dusk Industries™ v24.4 — Resend Email

v24.4 intentionally changes only email routing.

- Supabase Auth recovery/magic-link mail is configured to use Resend Custom SMTP.
- Notification Ops Email delivery now sends directly through the Resend API.
- Telegram remains on the Make delivery queue.
- Notification delivery history records the Resend message ID or error.
- No SQL migration is required.
- No Resend API key is committed to the repository.

Setup:

```text
RESEND_SETUP.md
```

Upgrade from v24.3:

```text
UPGRADE_FROM_V24_3.md
```

---

# Dusk Industries™ v24.3 — Notification Ops + PWA Push

v24.3 finishes the internal notification system before v25.0 connects live
Social Ops publishing providers.

## Notification Center

`/dashboard/notifications` now has two operating modes:

```text
Notification Inbox
Routing Preferences
```

The Inbox includes:
- unread/read state
- unread-only filtering
- category filters
- severity
- notification topic
- delivery status per channel
- delivery errors
- deep-link action buttons
- mark-all-read
- test notification
- dedupe-aware notification creation

## Exhaustive routing preferences

There are **76 individually configurable notification types** across:

```text
Events
Con Prep
Sticker Factory
Orders
Shipping
Social Ops
Finance
Media
Integrations
System
```

Every topic independently supports:

```text
Dashboard Inbox
Web Push / PWA
Telegram
Email
```

Global switches sit above the per-topic matrix.

Quick presets:

```text
Recommended
Critical only
Absolutely everything
Dashboard only
```

## Quiet hours

Quiet hours suppress external notification delivery while leaving Dashboard
notifications available.

Urgent alerts can optionally bypass quiet hours.

Default timezone remains:

```text
America/New_York
```

## PWA / iPhone push

The existing PWA/Web Push foundation is now treated as a first-class device
notification system.

The Notification Center displays:
- installed/standalone state
- browser push support
- permission state
- active subscription state
- enable/disable controls

The site header now shows a notification bell with unread count whenever an
authorized Dashboard user is signed in.

## Central notification router

New internal helper:

```text
src/lib/notifications.ts
```

Subsystems generate a normalized topic event; the router applies:
- user preference
- global channel state
- quiet hours
- urgent override
- deduplication
- Dashboard visibility
- Web Push
- Telegram queue
- Email queue

Subsystems no longer need to understand individual delivery channels.

## Systems wired in v24.3

Notification events are already emitted by:
- Events creation/update
- Media uploads/unassigned media
- Social Ops approval
- Social Ops scheduling
- Social retry
- Social publish success
- Social publish failure

An hourly notification sweep also evaluates:
- event tomorrow
- event today
- event starting soon
- prep tasks due in 24h
- prep tasks due soon
- overdue prep
- sticker print block soon
- departure in ~2 hours
- departure in ~30 minutes
- leave now
- hotel check-in
- hotel checkout
- scheduled social post due soon

## Make

New sweep endpoint:

```text
POST /api/integrations/make/notification-sweep
```

Existing queued delivery endpoint now supports:

```text
GET /api/integrations/make/notifications?channel=telegram
GET /api/integrations/make/notifications?channel=email
```

Queued Telegram/email failures get one automatic 15-minute retry.

External Make scenarios can create preference-aware notifications through:

```text
POST /api/integrations/make/create-notification
```

See:

```text
make/NOTIFICATIONS.md
```

## SQL

From v24.2 run:

```text
supabase/migrations/20260922_v24_3_notification_ops.sql
```

From v22 run, in order:

```text
supabase/migrations/20260922_v24_2_social_ops.sql
supabase/migrations/20260922_v24_3_notification_ops.sql
```

See `UPGRADE_FROM_V24_2.md` or `UPGRADE_FROM_V22.md`.

---

# Dusk Industries™ v24.2 — Social Ops Command Center

v24.2 builds the full pre-publishing Social Ops layer. Live external provider
publishing remains the v25.0 boundary.

## Social Command Center

`/dashboard/posts` now includes:

- event-linked post composer
- event-media picker
- ordered carousel/media sequence
- master caption
- Telegram / X / Instagram / Snapchat destination toggles
- per-platform caption overrides
- cross-platform previews
- Draft / Approved / Scheduled / Published / Failed operations board
- explicit approval and scheduling workflow
- published-post metrics summaries
- provider post links
- failure messages
- retry controls

## Publishing safety

Only **Scheduled** platform jobs whose scheduled time has arrived are returned
by the protected Make queue.

Draft and Approved posts cannot publish.

## New Make infrastructure

```text
GET  /api/integrations/make/social-jobs
POST /api/integrations/make/social-jobs
POST /api/integrations/make/social-metrics
```

See `make/SOCIAL_OPS.md`.

## Cross-module Social Ops links

Social Ops can now be entered from:
- Dashboard Events
- Dashboard Case Studies
- Dashboard Media → Create post

Published event-linked posts continue to populate that event's Incident Report
or Tactical Deployment Plan automatically.

## Upgrade from v22

Read:

```text
UPGRADE_FROM_V22.md
```

There is one new SQL migration:

```text
supabase/migrations/20260922_v24_2_social_ops.sql
```

---

# Dusk Industries™ v24.1.1 — Canonical Event Documents

Every event now has one canonical public page at:

```text
/chaos/<event-slug>
```

The document type changes automatically by event status:

- **Past / completed event → INCIDENT REPORT**
- **Future / upcoming event → TACTICAL DEPLOYMENT PLAN**

The document type is featured prominently at the top of the individual page.

Future plans also use planning-oriented language:
- Mission Objective
- Deployment Strategy
- Projected Outcome
- Deployment Pending

Past reports retain:
- The Assignment
- The Extremely Professional Response
- Damage Report
- Chaos Substantiated

Canonical event-document links are now exposed from:
- the Pawprint Expansion Map
- every card on `/chaos`
- homepage Upcoming Deployments
- Dashboard Events
- Dashboard Case Studies
- Dashboard Media preview

No SQL migration is required.

---

# Dusk Industries™ v24.1 — Media Ops + Sticker Pricing

## Header
The old gradient pawprint + text lockup has been replaced by the full
**Dusk IndusKries spray-paint logo** using `/public/assets/logo-graffiti.png`.

## Sticker Factory live pricing
New interactive calculator:

```text
Base:             $7 per 25 stickers
Clear laminate:   included
Holographic:      +20% print cost
Standard process: included
Rush processing:  +25% production subtotal
Standard shipping $5
Rush shipping:    $20
```

The calculator supports 25–1,000 stickers in 25-sticker increments and shows:
- print base
- laminate surcharge
- rush-processing surcharge
- shipping
- total
- delivered per-sticker cost

## Event-first Media Ops
`/dashboard/media` now works by event rather than as one giant media pile.

You can:
- choose an event
- upload directly into that event
- see its current public lead image
- drag/drop evidence cards to reorder them
- click **Make cover** on an image
- edit titles/captions inline
- hide/publish individual media
- reassign orphaned media to events
- preview the public incident report

The evidence order uses the existing `media.sort_order` field, so no new schema
column is needed.

The first sorted image becomes the automatic event cover when a formal Case
Study does not specify its own cover URL.

## SQL
**No SQL migration is required for v24.1.**

---

# Dusk Industries™ v24.0 — Content Ops Baseline

v24 becomes the baseline for the current revision cycle. Future refinement builds
use `v24.x` until Social Ops begins.

## Dynamic Case Studies in Chaos
`/chaos` no longer renders only the manually authored case-study rows.

It now renders **every published event in Supabase** automatically:
- completed events appear under Documented Incidents
- future events appear under Chaos Pending
- formal case-study copy is layered in when it exists
- the first associated public image becomes a fallback cover
- event media counts are displayed
- every card links to `/chaos/<event-slug>`

Adding an event to the Events dashboard therefore adds it to both the map and the
Chaos archive without hand-editing the page.

## Case Studies editor
New Dashboard route:

```text
/dashboard/case-studies
```

Choose any event and edit:
- report title
- cover image
- corporate status
- The Assignment
- The Extremely Professional Response
- Damage Report
- publish state

If no cover URL is supplied, the first public event image is used. If no event
image exists, the Dusk Industries graffiti logo is used.

## Auth cleanup
The primary dashboard login is now email/password.

`/login` includes:
- Sign in
- Set / reset password
- Magic link fallback

Password recovery uses:

```text
/auth/recovery
/reset-password
```

Supabase URL Configuration should allow:

```text
https://duskdawolf.com/auth/recovery
https://duskdawolf.com/auth/callback
```

No Google OAuth provider is required.

## Database
v24.0 adds no new database columns. If the current cumulative schema and the
v18 event→case-study migration are already installed, **no SQL is required**.

---

# Dusk Industries™ v22 — Map TypeScript Build Fix

Fixes the `d3-geo` TypeScript mismatch introduced by the Northeast zoom refactor.
The US state features are explicitly cast to GeoJSON-compatible objects when passed
to `geoPath`, while preserving the FIPS `id` used for Northeast filtering.

No SQL migration is required.

---

# Dusk Industries™ v21 — Northeast Zoom Fix

- Northeast mode now fits the map to actual Northeast state geometry.
- Alaska/Hawaii/the rest of the country are no longer rendered in the zoomed view.
- Event pawprints remain clickable with the deployment preview + incident report link.
- Also moves `themeColor` from metadata to the Next.js `viewport` export, removing the repeated Vercel build warnings.

No SQL migration is required.

---

# Dusk Industries™ v20 — TypeScript Build Fix

Fixes the incident-report analytics reducer typing so Vercel/TypeScript correctly
infers both `reach` and `engagements` as required numeric accumulator fields.

No database migration is required for v20.

---

# Dusk Industries™ v19 — Supabase Seed Fix

v19 fixes the FurPocalypse cost seed error:

`there is no unique or exclusion constraint matching the ON CONFLICT specification`

The old cumulative schema created a partial unique index on `cost_entries.external_key`,
but the seed used `ON CONFLICT (external_key)`. PostgreSQL cannot infer that partial
index without the predicate.

The current schema now uses a normal unique index. PostgreSQL still permits multiple
NULL values, so this preserves the intended behavior while making the upsert valid.

For an already-initialized database, run:

```text
supabase/migrations/20260928_fix_cost_external_key_conflict.sql
```

Then rerun:

```text
supabase/seed-furpocalypse-2026.sql
```

---

# Dusk Industries™ v18 — Interactive Chaos Map + Incident Reports

## Map changes
- Future travel trajectory is now **Dusk blue / TOSS aqua** (`#61e8ff`).
- The old separate Northeast inset is gone.
- Clicking the Northeast cluster now **zooms the same map into the Northeast**.
- `Zoom back out` returns to the national view.
- Individual event paws are clickable in the zoomed view.
- Selected events show a deployment preview.
- Preview CTA: **OPEN THE INCIDENT REPORT →**

## Event incident reports
Every recorded event now has a permanent URL:

```text
/chaos/<event-slug>
```

The page automatically combines:
- event details
- formal Case Study in Chaos copy, when one exists
- event-linked public photos/videos
- event-linked published social posts
- platform links
- latest stored reach/engagement metrics

This means the map becomes the entry point to a living event archive rather than a decorative travel graphic.

## Supabase
Existing installs should run:

```text
supabase/migrations/20260927_event_incident_reports.sql
```

A fresh install using the cumulative `supabase/schema.sql` already includes it.

---

# Dusk Industries™ v17 — Google OAuth Login

v17 adds **Sign in with Google** to `/login`, using the existing Supabase Google OAuth provider and the existing `/auth/callback` route.

For a Google-authenticated dashboard account, no password is required.

Required Supabase Auth settings:

```text
Site URL: https://duskdawolf.com
Redirect URL: https://duskdawolf.com/auth/callback
```

`DUSK_ADMIN_EMAILS` in Vercel must contain the same Google email address you sign in with.

---

# Dusk Industries™ v16

Coming directly from the old v6 deployment? Start with `INSTALL_FROM_V6.md`.

# Dusk Industries™ v15 — Notification Center + PWA/Web Push

v15 adds the notification infrastructure that the rest of Dusk Industries can use.

## New Dashboard module

```text
/dashboard/notifications
```

The Notification Center supports:

- Events
- Con Prep
- Sticker Factory
- Orders
- Shipping
- Social
- Finance
- System / Make

Severity:

```text
info
action
reminder
urgent
```

Delivery channels:

```text
web_push
telegram
email
```

The full notification is stored once in PostgreSQL. Individual delivery attempts are stored separately, so one notification can be sent to multiple channels without duplicating the source record.

## PWA

The site now ships with:

```text
/manifest.webmanifest
/sw.js
/icon-192.png
/icon-512.png
/badge-96.png
```

This allows Dusk Industries to be installed as a standalone web app.

On iPhone, Web Push works from an installed Home Screen web app on supported iOS versions. Install `duskdawolf.com` to the Home Screen, open the installed Dusk Ops app, then enable phone notifications from the Notification Center.

## Web Push setup

Install dependencies automatically through Vercel after pushing v15.

Generate VAPID keys locally or anywhere you can run the package:

```bash
npx web-push generate-vapid-keys
```

Add these to Vercel:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:your-email@example.com
```

Do not expose `VAPID_PRIVATE_KEY` with a `NEXT_PUBLIC_` prefix.

Redeploy after adding them.

Then:

1. Open the installed Dusk Ops PWA.
2. Go to `/dashboard/notifications`.
3. Tap **Enable phone notifications**.
4. Tap **Send test notification**.

The test queues both:
- Web Push immediately
- Telegram for Make

## Supabase migration

Run:

```text
supabase/migrations/20260926_notifications_pwa_push.sql
```

after the earlier migrations.

## Telegram / Make queue

v15 adds:

```text
GET /api/integrations/make/notifications
POST /api/integrations/make/notifications
```

with:

```text
Authorization: Bearer $MAKE_WEBHOOK_SECRET
```

### GET

Returns pending Telegram deliveries.

A Make scenario can:

1. poll the endpoint
2. send each notification to your Telegram bot/chat
3. POST the delivery result back

### POST delivery receipt

Example:

```json
{
  "deliveryId": "uuid",
  "status": "sent",
  "providerMessageId": "telegram-message-id"
}
```

## Creating notifications from Make

External workflows can create a Dusk notification with:

```text
POST /api/integrations/make/create-notification
```

Example:

```json
{
  "adminEmail": "your-dashboard-email@example.com",
  "severity": "urgent",
  "category": "con_prep",
  "title": "Leave for the airport",
  "message": "Time to leave. Flight departure is 7:00 PM.",
  "targetUrl": "/dashboard/con-prep",
  "channels": ["web_push", "telegram"]
}
```

The Make secret is required.

## Current default push philosophy

The database preference model defaults to:

```text
info      dashboard only
action    push
reminder  push
urgent    push
```

This avoids buzzing your phone for every successful database sync while still making important Dusk Ops activity noisy.

Telegram can still receive all levels if you choose to route them that way in Make.

## What this unlocks next

Every subsystem can now create one normalized notification instead of reinventing alerts:

```text
Event created
Packing session scheduled
Sticker run begins in 30 min
Badge still needed
Hotel payment due
New sticker order
Shippo label created
Social post published
Instagram publish failed
QuickBooks sync failed
Make scenario error
Flight / leave-for-airport reminder
```

## Recommended next step

Build the first real Make scenarios:

### Scenario A — Google Calendar Sync
Use the existing:

```text
GET /api/integrations/make/calendar-jobs
POST /api/integrations/make/calendar-jobs
```

### Scenario B — Telegram Notification Router
Use:

```text
GET /api/integrations/make/notifications
POST /api/integrations/make/notifications
```

Once those are live, Dusk Industries will both schedule your operational calendar and actively tell your phone what changed.
