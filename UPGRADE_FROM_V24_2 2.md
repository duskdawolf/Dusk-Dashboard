# Upgrade Dusk Industries v24.2 → v24.3

v24.3 finishes the internal Notification Ops layer before live Social Ops
providers are connected.

## 1 — Update the repository

Replace/update the v24.2 project files with this v24.3 package, keep the
existing Git repository, commit, and push `main`.

Suggested commit:

```text
v24.3 notification ops and granular push routing
```

Vercel should deploy automatically.

## 2 — Run one SQL migration

In Supabase → SQL Editor → New query, run the entire file:

```text
supabase/migrations/20260922_v24_3_notification_ops.sql
```

`Success. No rows returned` is normal.

This migration adds:
- notification topic/event keys
- dedupe keys
- deep-link action labels
- dashboard visibility
- unread/dedupe indexes
- quiet-hour controls
- unread-badge preference
- `notification_topic_preferences`

Do not rerun the full schema.

## 3 — Web Push environment variables

For real phone push, Vercel needs:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

If they are already present, do nothing.

If not, generate keys on your laptop from the project directory:

```bash
npx web-push generate-vapid-keys
```

Add the public key to:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
```

Add the private key to:

```text
VAPID_PRIVATE_KEY
```

Set:

```text
VAPID_SUBJECT=mailto:<your email>
```

The private key must NOT use a `NEXT_PUBLIC_` prefix.

After changing Vercel environment variables, redeploy.

## 4 — Install Dusk Ops on iPhone

1. Open `https://duskdawolf.com` in Safari.
2. Share → **Add to Home Screen**.
3. Launch Dusk Ops from the new Home Screen icon.
4. Sign into the Dashboard.
5. Open `/dashboard/notifications`.
6. Tap **Enable phone notifications**.
7. Allow notifications in iOS.
8. Tap **Send test notification**.

## 5 — Configure exactly what you want

Open:

```text
/dashboard/notifications
```

Then choose **Routing Preferences**.

There are 76 granular notification topics across:
- Events
- Con Prep
- Sticker Factory
- Orders
- Shipping
- Social Ops
- Finance
- Media
- Integrations
- System

Each topic has independent switches for:
- Dashboard Inbox
- Web Push
- Telegram
- Email

There are also global channel switches, quiet hours, urgent quiet-hours bypass,
an unread-bell toggle, and presets:

```text
Recommended
Critical only
Absolutely everything
Dashboard only
```

## 6 — Notification sweep

v24.3 adds a protected sweep endpoint:

```text
POST /api/integrations/make/notification-sweep
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

It evaluates time-sensitive operational data such as:
- events tomorrow / today / starting soon
- prep tasks due / overdue
- sticker printing starting soon
- travel departure in ~2h / ~30m / now
- hotel check-in / checkout
- social posts publishing soon

Recommended Make schedule: once per hour.

The endpoint uses dedupe keys so an hourly scenario does not repeatedly spam
the same alert.

## 7 — Existing Make notification delivery

Queued notifications:

```text
GET /api/integrations/make/notifications?channel=telegram
GET /api/integrations/make/notifications?channel=email
```

Delivery receipts:

```text
POST /api/integrations/make/notifications
```

Telegram/email failures retry once after 15 minutes before becoming final
failures.

## 8 — Social Ops is already wired into Notification Ops

v24.3 automatically creates notification events for:
- post approved
- post scheduled
- failed job re-queued
- post published
- post publish failed
- post publishing soon via the hourly sweep

That means v25.0 live publishing can plug into the existing Social Ops receipt
endpoint and phone alerts will already work.
