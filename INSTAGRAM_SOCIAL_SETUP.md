# Dusk Industries v25.2 — Live Instagram Publishing

v25.2 makes Instagram the third live Social Ops provider.

```text
Telegram   LIVE
X          LIVE
Instagram  LIVE
Snapchat   staged for v25.3
```

Dusk uses **Instagram API with Instagram Login**, not the older Facebook-Page
login path.

That matters because the Instagram Login flow:
- works with Instagram professional accounts (Business / Creator)
- does not require a Facebook Page to be linked
- uses the current `instagram_business_*` permissions
- publishes through `graph.instagram.com`

## 1 — Configure the Meta / Instagram app

In Meta for Developers, create or open the app used for Dusk Industries and
enable **Instagram API with Instagram Login / Instagram business login**.

Configure the exact OAuth redirect URI:

```text
https://duskdawolf.com/api/admin/social/instagram/callback
```

Dusk requests only:

```text
instagram_business_basic
instagram_business_content_publish
```

The older `business_basic` / `business_content_publish` scope aliases were
deprecated by Meta in 2025, so v25.2 deliberately uses the current scope names.

The account you connect must be an Instagram **Business or Creator** account.

If the Meta app is still in development/testing mode, make sure the Instagram
account is allowed as a developer/test account according to the Meta dashboard.

## 2 — Add Vercel environment variables

Add to the Dusk project in Vercel:

```text
INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET
INSTAGRAM_GRAPH_VERSION=v25.0
```

v25.2 also uses the existing:

```text
SOCIAL_TOKEN_ENCRYPTION_KEY
```

from v25.1. You do not need another encryption key.

Do not prefix the app secret with `NEXT_PUBLIC_`.

Redeploy Production after adding the variables.

## 3 — Run the v25.2 SQL migration

Supabase → SQL Editor → New query:

```text
supabase/migrations/20260923_v25_2_instagram_social.sql
```

Run the whole file.

It:
- expands `social_provider_connections` to allow Instagram
- adds `posts.include_deployment_link`
- adds an Instagram connection index

No existing X connection data is replaced.

## 4 — Connect Instagram

Open:

```text
https://duskdawolf.com/dashboard/posts
```

The Publishing Providers panel should show Instagram as **SETUP NEEDED**.

Click:

```text
Connect Instagram
```

Dusk:
1. generates CSRF state
2. redirects to Instagram authorization
3. exchanges the authorization code server-side
4. converts the short-lived token to a long-lived Instagram token
5. reads the professional account username/id
6. encrypts the token with AES-256-GCM
7. stores it in Supabase

You return to `/dashboard/posts` and the provider should show:

```text
CONNECTED
@yourusername
```

## 5 — Token refresh

Instagram Login long-lived access tokens last roughly 60 days.

Dusk refreshes the token automatically when it has less than seven days of
runway. Instagram's refresh endpoint requires a still-valid long-lived token and
is intended for tokens that are at least 24 hours old; Dusk's seven-day refresh
window satisfies that condition.

If refresh fails, the provider card reports that reauthorization is required.

Use:

```text
Reconnect Instagram
```

to authorize again.

## 6 — Publishing behavior

Instagram publishing is container-based:

```text
Create media container
        ↓
Wait for FINISHED
        ↓
Publish container
        ↓
Read permalink / provider receipt
```

Meta fetches media from the URL Dusk supplies, so the media URL must remain
publicly reachable while the container is being processed.

### Single photo

v25.2 creates one image container and publishes it as a feed post.

Instagram API image publishing requires JPEG.

### Single video

v25.2 publishes a single video as:

```text
REELS
share_to_feed=true
```

### Carousel

For 2–10 items, Dusk:

```text
creates each child container
waits for the children
creates a CAROUSEL parent
waits for the parent
publishes the parent
```

Photo/video mixtures are supported by the container flow.

### Caption

v25.2 validates against Instagram's 2,200-character caption limit.

Instagram has no text-only publishing path in this integration, so at least one
media item is required.

## 7 — Container processing and retries

Video/Reel/carousel containers may need time to process.

Dusk polls inside the dispatch request for up to ~45 seconds. If Instagram is
still processing, Dusk stores the container state in `provider_response`,
returns the platform job to Scheduled, and resumes the same container on the
next dispatcher run rather than creating it again.

Instagram jobs get up to:

```text
6 dispatcher attempts
```

because legitimate media processing can take several minutes.

Transient Graph/API failures can retry. Terminal container errors or unsupported
media move the platform destination to Failed and trigger Notification Ops.

## 8 — Existing Make dispatcher

**No new Make scenario is needed.**

Keep the v25 dispatcher:

```text
POST https://duskdawolf.com/api/integrations/make/social-dispatch
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

running every 1–5 minutes.

It now claims:

```text
telegram
twitter
instagram
```

Dusk owns all Instagram OAuth, container creation, polling, publishing, receipt
storage, retry logic, and notifications.

## 9 — Deployment document checkbox

v25.2 also adds a checkbox directly under **Related deployment**:

```text
☑ Add Incident Report link to the post
```

for past events, or:

```text
☑ Add Tactical Deployment Plan link to the post
```

for future events.

When enabled, Dusk appends the canonical event page to each selected platform's
final caption:

```text
Incident Report: https://duskdawolf.com/chaos/<slug>
```

or:

```text
Tactical Deployment Plan: https://duskdawolf.com/chaos/<slug>
```

The link is not permanently pasted into the master caption. It is composed at
preview/publish time, which keeps the canonical caption clean and lets the label
correctly reflect whether the deployment is past or future.

## 10 — First Instagram test

Use a low-stakes post:

```text
Instagram only
1 JPEG
short caption
5–10 minutes in the future
```

Expected:

```text
Draft
→ Approved
→ Scheduled
→ Publishing
→ Published
```

Then test:
- one Reel
- 2–3 JPEG carousel
- mixed photo/video carousel

Confirm the published card stores the Instagram permalink and provider media ID.
