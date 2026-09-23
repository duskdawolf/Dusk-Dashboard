# Dusk Industries v25.1 — Live X Publishing

v25.1 makes X the second live Social Ops provider, alongside Telegram.

## Current live chain

```text
Dusk Social Ops
   ↓
Supabase scheduled platform rows
   ↓
Make dispatcher
   ├── Telegram provider
   └── X provider
          ↓
      X API v2
          ↓
provider receipt + Notification Ops
```

## 1 — Configure the X developer app

In the X Developer Console, create or select a confidential OAuth 2.0 app such
as **Web App**, **Automated App**, or **bot**.

Set the exact callback URL:

```text
https://duskdawolf.com/api/admin/social/x/callback
```

Website:

```text
https://duskdawolf.com
```

Dusk requests:

```text
tweet.read
tweet.write
users.read
media.write
offline.access
```

`offline.access` is required for a refresh token so scheduled publishing can
continue without asking you to authorize each Post.

## 2 — Add Vercel environment variables

Required:

```text
X_CLIENT_ID
X_CLIENT_SECRET
SOCIAL_TOKEN_ENCRYPTION_KEY
```

Generate the encryption key on your Mac:

```bash
openssl rand -base64 32
```

Optional:

```text
X_MAX_POST_CHARS=280
X_MAX_MEDIA_MB=50
```

`SOCIAL_TOKEN_ENCRYPTION_KEY` is separate from the X client secret. Dusk uses
it to encrypt X access/refresh tokens with AES-256-GCM before they are stored in
Supabase.

Redeploy Production after adding the variables.

## 3 — Run the v25.1 SQL migration

Supabase → SQL Editor:

```text
supabase/migrations/20260922_v25_1_x_social.sql
```

This creates `social_provider_connections`, which stores the X account identity,
encrypted OAuth tokens, token expiry/refresh state, and provider errors. RLS is
enabled and there are deliberately no browser-side policies for this table.

## 4 — Connect X from Social Ops

Open:

```text
https://duskdawolf.com/dashboard/posts
```

Click **Connect X** on the X provider card.

Dusk creates a CSRF state value and PKCE verifier/challenge, redirects to X,
then exchanges the returned authorization code on the server. After the account
is identified with `/2/users/me`, Dusk encrypts and stores the tokens and sends
you back to Social Ops.

The provider card should then show:

```text
CONNECTED
@yourusername
```

You can use **Reconnect X** whenever authorization needs to be refreshed, or
**Disconnect** to remove the stored connection.

## 5 — Make requires no second scenario

Keep the v25.0 dispatcher scenario:

```text
POST https://duskdawolf.com/api/integrations/make/social-dispatch
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

Recommended cadence remains every 1–5 minutes. In v25.1 that same endpoint
claims both `telegram` and `twitter` platform jobs.

Do **not** create another X publisher against `/social-jobs`; the dispatcher
owns the live X queue and conditionally claims each row before publishing to
reduce duplicate sends.

## 6 — First test

Start with a low-stakes Post:

```text
Destination: X only
Media: none
Text: under 280 characters
Schedule: 5–10 minutes ahead
```

Expected lifecycle:

```text
Scheduled → Publishing → Published
```

Then test one image, 2–4 images, and finally a short video.

## 7 — Media behavior

X's current Create Post API allows up to **4 photos, 1 animated GIF, or 1
video** on a Post. Dusk validates that combination before publishing.

Still images use the X API v2 media upload endpoint. Video/GIF media use the
v2 chunked upload flow:

```text
initialize → append chunks → finalize → processing status → Create Post
```

Dusk uses a conservative `X_MAX_MEDIA_MB` serverless safety cap because the
Vercel function has to download the Supabase-hosted file before sending chunks
to X. This is intentionally separate from X's own provider limits.

## 8 — Token refresh

X OAuth access tokens are short-lived. Dusk requests `offline.access`, stores
the refresh token encrypted, and refreshes the access token before provider
status checks or scheduled publishing when it is close to expiry.

If refresh fails, Social Ops reports that X needs reauthorization instead of
silently attempting to publish under an invalid session.

## 9 — Roadmap

```text
v25.0  Telegram live
v25.1  X live
v25.2  Instagram live
v25.3  Snapchat assisted handoff
v25.4  normalized metrics collection + optimization
```

X supports metrics APIs, but v25.1 leaves automated analytics collection for
the shared v25.4 metrics pass so Telegram/X/Instagram performance can be
normalized together.
