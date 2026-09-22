# Upgrade old Dusk Industries v6 → current v25.0

The v25.0 package is cumulative. Do not install every historical release one by
one.

## Fresh / empty Supabase project

Run:

```text
1. supabase/schema.sql
2. supabase/seed.sql
3. supabase/seed-furpocalypse-2026.sql
```

The cumulative `schema.sql` already includes:
- Event / map architecture
- Con Prep
- Media / Case Studies
- Social Ops
- Notification Ops
- v25.0 provider receipt fields

Do not run historical migrations after a fresh current schema install.

## Existing database

Use the upgrade guide closest to your current version.

Current path:

```text
UPGRADE_FROM_V24_4_2.md
```

## Core Vercel environment

```text
DUSK_ADMIN_EMAILS
MAKE_WEBHOOK_SECRET
DUSK_HOME_TIMEZONE=America/New_York

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

## Resend

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
```

Supabase Auth should also use Resend Custom SMTP.

## PWA/Web Push

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

## v25.0 Telegram provider

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

Optional:

```text
TELEGRAM_PUBLIC_CHAT_USERNAME
TELEGRAM_MESSAGE_THREAD_ID
```

## Auth templates

Install the branded templates from:

```text
supabase/email-templates/
```

including:
- recovery
- magic link
- confirm signup
- invite
- change email
- reauthentication

## Make

Keep the v24.3 hourly Notification Sweep if desired.

Add the v25.0 Social Dispatcher:

```text
POST /api/integrations/make/social-dispatch
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

Recommended cadence: every 1–5 minutes.

Full Telegram steps:

```text
TELEGRAM_SOCIAL_SETUP.md
```
