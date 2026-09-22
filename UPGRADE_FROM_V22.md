# Upgrade Dusk Industries v22 → v25.0

The v25.0 package is cumulative at the code level, but an existing v22 Supabase
database needs the later migrations.

## 1 — Update code

Replace v22 code with v25.0 while keeping the Git repository.

Push `main` after the database/environment work below is ready.

## 2 — Run SQL migrations in order

```text
1. supabase/migrations/20260922_v24_2_social_ops.sql
2. supabase/migrations/20260922_v24_3_notification_ops.sql
3. supabase/migrations/20260922_v25_0_live_social.sql
```

The v24.4 / v24.4.1 / v24.4.2 releases did not require SQL migrations.

Do not rerun the full schema over an already initialized v22 database.

## 3 — Auth + Resend

Follow the existing:
- `RESEND_SETUP.md`
- `AUTH_EMAIL_TEMPLATES.md`

Install the branded Supabase Auth templates, including Reauthentication.

## 4 — PWA notifications

Configure the VAPID environment variables from the v24.3 guide if you have not
already done so.

## 5 — Telegram v25.0

Follow:

```text
TELEGRAM_SOCIAL_SETUP.md
```

Required Vercel values:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

Then create the Make Social Dispatcher scenario.

## 6 — Verify

Check:

```text
/dashboard/events
/dashboard/media
/dashboard/case-studies
/dashboard/posts
/dashboard/con-prep
/dashboard/notifications
/dashboard/account
```

The global footer should show `v25.0`.
