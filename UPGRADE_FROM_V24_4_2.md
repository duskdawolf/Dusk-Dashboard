# Upgrade Dusk Industries v24.4.2 → v25.0

v25.0 is the first **live Social Ops publishing** release.

Telegram is live. X, Instagram, and Snapchat remain staged for the next v25.x
provider releases.

---

## 1 — Update the repository

Replace/update v24.4.2 with the v25.0 package.

Suggested commit:

```text
v25.0 live social publishing core and telegram
```

Push `main` and let Vercel deploy.

---

## 2 — Run one SQL migration

Supabase → SQL Editor → New query.

Run:

```text
supabase/migrations/20260922_v25_0_live_social.sql
```

Expected success:

```text
Success. No rows returned
```

The migration adds publishing receipt snapshots to `post_platforms`:

```text
provider_account
published_caption
published_media
provider_response
last_provider_check
```

Do not rerun the full schema.

---

## 3 — Configure Telegram

Follow:

```text
TELEGRAM_SOCIAL_SETUP.md
```

Required Vercel variables:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

Optional:

```text
TELEGRAM_PUBLIC_CHAT_USERNAME
TELEGRAM_MESSAGE_THREAD_ID
```

Redeploy after adding/changing Vercel environment variables.

---

## 4 — Verify the provider

Open:

```text
/dashboard/posts
```

The new **Publishing Providers** panel should show:

```text
Telegram · CONNECTED
```

Click:

```text
Send provider test
```

and confirm the test message appears in the configured Telegram destination.

---

## 5 — Create the Make live dispatcher

Create a Make scenario containing:

```text
Schedule
  ↓
HTTP POST
https://duskdawolf.com/api/integrations/make/social-dispatch
```

Recommended cadence:

```text
Every 1–5 minutes
```

Header:

```text
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

Body:

```json
{}
```

Turn the scenario ON after **Run once** succeeds.

Detailed steps are in:

```text
TELEGRAM_SOCIAL_SETUP.md
make/SOCIAL_OPS.md
```

---

## 6 — Test with a throwaway/private post first

In `/dashboard/posts`:

1. Make a Draft.
2. Select Telegram.
3. Add text and optional media.
4. Approve it.
5. Schedule it 5–10 minutes ahead.
6. Watch the Social Operations Board.
7. Confirm:
   - Scheduled
   - Publishing
   - Published
8. Confirm Notification Ops records publishing/published events.

Do not start with a public high-stakes post.

---

## 7 — v25.0 media/caption behavior

Telegram v25.0 supports:

```text
text-only
single photo
single video
2–10 photo/video album
mixed photo/video album
```

Validation:

```text
text max: 4096
media caption max: 1024
media items max: 10
```

If a full caption is longer than 1024 characters but within 4096, Dusk sends
the media first and the full caption as a separate Telegram text message.

---

## 8 — Future-platform variants are preserved

You can leave X/Instagram/Snapchat selected while scheduling Telegram.

v25.0 behavior:

```text
Telegram   → Scheduled → live publish
X          → stays Approved
Instagram  → stays Approved
Snapchat   → stays Approved
```

The future caption variants remain in Supabase.

---

## 9 — Automatic retries

Transient Telegram failures can retry up to 3 total attempts with backoff.

Permanent validation/auth/permission failures go to Failed immediately.

Use **Retry failed** after correcting the underlying issue.

---

## 10 — Footer / version

The global footer now reads:

```text
Copyright 2026 Dusk Induskries.          v25.0
```

No Auth/Resend/PWA configuration changes are required from v24.4.2.
