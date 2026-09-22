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
