# Upgrade Dusk Industries from v6 to the current app

This guide assumes nothing after v6 has been installed.

You do NOT need to install v7, v8, v9, etc. individually.
This package is cumulative.

## 1 — Replace the old repo in Working Copy

1. Download `dusk-industries-v16-working-copy-ready.zip`.
2. In iOS Files, tap the ZIP once to extract it.
3. Open the existing Dusk Git repository in Working Copy.
4. Keep the repository itself / `.git` metadata.
5. Remove the old v6 project files from the working tree.
6. Copy the CONTENTS of the extracted v16 folder into the repo root.

The repo root should contain:

package.json
src/
public/
supabase/
make/
README.md
INSTALL_FROM_V6.md
.env.example

Do not nest all of that inside another folder.

7. Review Changes.
8. Commit once, e.g. `Upgrade Dusk Industries from v6 to current platform`.
9. Push `main`.

Vercel should auto-deploy.

## 2 — Vercel environment variables

Your Vercel/Supabase integration may already provide:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY

The app also supports older Supabase aliases.

Add:

DUSK_ADMIN_EMAILS=<your dashboard login email>
MAKE_WEBHOOK_SECRET=<long random secret>
DUSK_HOME_TIMEZONE=America/New_York

For Web Push also add:

NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:<your email>

Never expose SUPABASE_SECRET_KEY, VAPID_PRIVATE_KEY, or MAKE_WEBHOOK_SECRET with a NEXT_PUBLIC_ prefix.

Redeploy after changing environment variables.

## 3 — Supabase database

Because this guide assumes you are coming directly from v6, use the cumulative schema rather than every historical migration.

Run in Supabase SQL Editor, in this order:

1. `supabase/schema.sql`
2. `supabase/seed.sql`
3. `supabase/seed-furpocalypse-2026.sql`

Do not then run all the historical migration files; the cumulative schema already includes them.

## 4 — Supabase Auth

Set the Supabase Site URL to:

https://duskdawolf.com

Allow redirect:

https://duskdawolf.com/auth/callback

Then visit:

https://duskdawolf.com/login

Use the email configured in DUSK_ADMIN_EMAILS.

## 5 — Test the Dashboard

Check:

/dashboard/events
/dashboard/media
/dashboard/posts
/dashboard/con-prep
/dashboard/notifications

Recommended:
1. Events load.
2. Con Prep shows FurPocalypse.
3. FurPoc shows Hilton Stamford and projected costs.
4. Media accepts an image upload.
5. Posts saves a draft.
6. Notifications opens without a database error.

## 6 — Install Dusk Ops as an iPhone PWA

After VAPID keys are configured and the new deployment is live:

1. Open https://duskdawolf.com in Safari.
2. Tap Share.
3. Choose Add to Home Screen.
4. Launch the installed Dusk Ops app from the Home Screen.
5. Sign in.
6. Open `/dashboard/notifications`.
7. Tap Enable phone notifications.
8. Accept iOS notification permission.
9. Tap Send test notification.

Use the installed Home Screen app for iPhone Web Push.

## 7 — Make

Two scenarios are part of this rollout:

- Dusk Ops — Google Calendar Sync
- Dusk Ops — Telegram Notification Router

Details are in `make/SCENARIOS.md`.

They use MAKE_WEBHOOK_SECRET when calling protected Dusk endpoints.

Calendar:
GET  /api/integrations/make/calendar-jobs
POST /api/integrations/make/calendar-jobs

Telegram:
GET  /api/integrations/make/notifications
POST /api/integrations/make/notifications

## 8 — Do NOT

- push every intermediate version one at a time
- run every historical migration after the fresh cumulative schema
- commit secrets or `.env.local`
- expose private keys as NEXT_PUBLIC_ variables
- manually duplicate Google Calendar events once Make owns a synced job
