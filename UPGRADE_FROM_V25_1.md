# Upgrade Dusk Industries v25.1 → v25.2

v25.2 adds:
- live Instagram publishing
- Instagram Login OAuth
- long-lived token refresh
- photos / Reels / carousels
- deployment-document link checkbox in Social Ops

## 1 — Update code

Replace/update v25.1 with the v25.2 package.

Suggested commit:

```text
v25.2 live Instagram publishing and deployment links
```

## 2 — Run one SQL migration

Supabase → SQL Editor:

```text
supabase/migrations/20260923_v25_2_instagram_social.sql
```

Expected:

```text
Success. No rows returned
```

Do not rerun the full schema.

## 3 — Configure Instagram

Follow:

```text
INSTAGRAM_SOCIAL_SETUP.md
```

Required Vercel values:

```text
INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET
INSTAGRAM_GRAPH_VERSION=v25.0
```

Keep the existing:

```text
SOCIAL_TOKEN_ENCRYPTION_KEY
```

## 4 — OAuth callback

Set the exact Instagram business-login redirect URI in Meta:

```text
https://duskdawolf.com/api/admin/social/instagram/callback
```

## 5 — Redeploy

Redeploy Production after the Vercel values are set.

## 6 — Connect Instagram

Open:

```text
/dashboard/posts
```

Click **Connect Instagram** and authorize the Business/Creator account.

## 7 — Make

No new Make scenario.

The existing dispatcher now publishes:

```text
Telegram
X
Instagram
```

through:

```text
POST /api/integrations/make/social-dispatch
```

## 8 — Test the deployment-link checkbox

Choose a Related deployment.

Directly underneath it, enable:

```text
Add Incident Report link to the post
```

or:

```text
Add Tactical Deployment Plan link to the post
```

The final preview should show the canonical `/chaos/<slug>` URL.

## 9 — Footer

The global footer should read:

```text
Copyright 2026 Dusk Induskries.          v25.2
```
