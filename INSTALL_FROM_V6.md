# Upgrade old Dusk Industries v6 → current v24.3

The current package is cumulative. Do not install every intermediate version.

## Code

Replace the old v6 working tree with the contents of this v24.3 package while
keeping the existing Git repository. Commit and push `main`.

## Fresh Supabase initialization

If the Dusk database has never been initialized, run in this order:

```text
1. supabase/schema.sql
2. supabase/seed.sql
3. supabase/seed-furpocalypse-2026.sql
```

The current `schema.sql` already contains the v24.2 Social Ops and v24.3
Notification Ops structures. Do not then run all historical migrations.

If the database is already initialized, use the appropriate upgrade guide
instead:

```text
UPGRADE_FROM_V22.md
UPGRADE_FROM_V24_2.md
```

## Required Vercel environment

```text
DUSK_ADMIN_EMAILS
MAKE_WEBHOOK_SECRET
DUSK_HOME_TIMEZONE=America/New_York

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

Supported older Supabase key aliases still work.

For phone push:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

## Supabase Auth URLs

```text
Site URL:
https://duskdawolf.com

Redirect URLs:
https://duskdawolf.com/auth/callback
https://duskdawolf.com/auth/recovery
```

## After deployment

Verify:

```text
/dashboard/events
/dashboard/media
/dashboard/case-studies
/dashboard/posts
/dashboard/con-prep
/dashboard/notifications
```

Then install `duskdawolf.com` to the iPhone Home Screen, open the installed
Dusk Ops PWA, enable notifications, and configure Routing Preferences.
