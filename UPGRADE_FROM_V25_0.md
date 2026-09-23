# Upgrade Dusk Industries v25.0 → v25.1

v25.1 adds live X publishing without changing the existing Telegram workflow.

## 1 — Update the repository

Replace/update v25.0 with v25.1.

Suggested commit:

```text
v25.1 live X publishing and OAuth provider
```

## 2 — Run one SQL migration

Supabase → SQL Editor:

```text
supabase/migrations/20260922_v25_1_x_social.sql
```

`Success. No rows returned` is normal.

## 3 — Configure X + encryption in Vercel

Follow `X_SOCIAL_SETUP.md`.

Required:

```text
X_CLIENT_ID
X_CLIENT_SECRET
SOCIAL_TOKEN_ENCRYPTION_KEY
```

Generate the encryption key with:

```bash
openssl rand -base64 32
```

Optional:

```text
X_MAX_POST_CHARS=280
X_MAX_MEDIA_MB=50
```

Exact X callback:

```text
https://duskdawolf.com/api/admin/social/x/callback
```

Redeploy after adding the variables.

## 4 — Connect the X account

Open `/dashboard/posts` and click **Connect X** in Publishing Providers.

## 5 — Make

No new Make scenario is needed if the v25.0 Social Dispatcher is already ON.
The same endpoint now publishes Telegram + X:

```text
POST /api/integrations/make/social-dispatch
```

## 6 — Test

Start with X-only, text-only, under 280 characters, scheduled 5–10 minutes out.
Confirm:

```text
Scheduled → Publishing → Published
```

Then test still-image and short-video Posts.

## 7 — Footer

The global footer now shows:

```text
Copyright 2026 Dusk Induskries.          v25.1
```
