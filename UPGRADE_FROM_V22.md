# Upgrade Dusk Industries v22 → v24.3

This package is cumulative. You do not need to install the intermediate v24
releases one by one.

## 1 — Update code

Replace the v22 project files with v24.3, keeping the existing Git repository.

Commit/push `main`; Vercel should deploy automatically.

## 2 — Run these SQL migrations in order

### First: Social Ops queue

```text
supabase/migrations/20260922_v24_2_social_ops.sql
```

### Second: Notification Ops

```text
supabase/migrations/20260922_v24_3_notification_ops.sql
```

Run each entire file in Supabase → SQL Editor.

Do not rerun the full cumulative schema if the v22 database is already
initialized.

## 3 — Existing environment variables

Keep:

```text
DUSK_ADMIN_EMAILS
MAKE_WEBHOOK_SECRET
DUSK_HOME_TIMEZONE
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

Older Supabase aliases remain supported.

For phone push, also configure:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Generate VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

## 4 — Supabase auth redirects

Keep these allowed:

```text
https://duskdawolf.com/auth/callback
https://duskdawolf.com/auth/recovery
```

## 5 — Verify v24.3

Test:

```text
/dashboard/posts
/dashboard/notifications
```

In Notifications:
1. open Routing Preferences
2. choose your notification mix
3. install Dusk Ops to iPhone Home Screen
4. enable phone notifications
5. send a test notification

## 6 — Optional hourly Make sweep

Call once per hour:

```text
POST https://duskdawolf.com/api/integrations/make/notification-sweep
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

This generates time-sensitive event, con-prep, travel, printing, hotel, and
Social Ops reminders while respecting dedupe and your granular preferences.
