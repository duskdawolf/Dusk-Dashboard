# Upgrade Dusk Industries v25.2.1 → v25.3

v25.3 adds live Bluesky publishing. Snapchat is intentionally postponed.

## 1 — Update code

Replace/update v25.2.1 with v25.3.

Suggested commit:

```text
v25.3 live Bluesky publishing
```

## 2 — Run one SQL migration

Supabase → SQL Editor:

```text
supabase/migrations/20260923_v25_3_bluesky_social.sql
```

Expected:

```text
Success. No rows returned
```

## 3 — Configure Bluesky

Follow:

```text
BLUESKY_SOCIAL_SETUP.md
```

Required Vercel values:

```text
BLUESKY_IDENTIFIER
BLUESKY_APP_PASSWORD
```

Recommended/default:

```text
BLUESKY_PDS_URL=https://bsky.social
```

Use a dedicated Bluesky app password, not the primary account password.

## 4 — Redeploy

Redeploy Production after adding the Vercel values.

## 5 — Verify

Open:

```text
/dashboard/posts
```

The Publishing Providers panel should show Bluesky as:

```text
CONNECTED
```

## 6 — Make

No new scenario.

The existing dispatcher now handles:

```text
Telegram
X
Instagram
Bluesky
```

through:

```text
POST /api/integrations/make/social-dispatch
```

## 7 — Test

Schedule a text-only Bluesky post first.

Then test:
- one image
- four images
- deployment-document link

v25.3 deliberately rejects Bluesky video publishing rather than dropping media.

## 8 — Footer

The global footer should read:

```text
Copyright 2026 Dusk Induskries.          v25.3
```
