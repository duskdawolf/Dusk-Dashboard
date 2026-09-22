# Upgrade v24.3 → v24.4

v24.4 is intentionally narrow: **email delivery moves to Resend**.

## 1. Update code

Replace/update the v24.3 project with the v24.4 package, commit, and push `main`.

Suggested commit:

```text
v24.4 route auth and notification email through Resend
```

## 2. SQL

**No SQL migration is required.**

## 3. Configure Resend

Follow:

```text
RESEND_SETUP.md
```

You must configure both:

```text
Supabase Custom SMTP → Resend
Vercel RESEND_API_KEY / RESEND_FROM_EMAIL
```

Supabase SMTP handles password recovery/magic links.

The Vercel Resend variables handle Notification Ops email.

## 4. Redeploy

After adding Vercel variables, redeploy Production.

## 5. Verify

Test:

```text
Dashboard password recovery
/dashboard/notifications → Send test notification
```

Telegram delivery remains unchanged and still uses Make.
