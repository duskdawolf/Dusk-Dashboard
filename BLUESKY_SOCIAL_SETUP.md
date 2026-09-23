# Dusk Industries v25.3 — Live Bluesky Publishing

v25.3 replaces the previously planned Snapchat release with **Bluesky**.

Live provider state:

```text
Telegram   LIVE
X          LIVE
Instagram  LIVE
Bluesky    LIVE
Snapchat   postponed / staged
```

Dusk uses the AT Protocol XRPC APIs directly.

## 1 — Create a dedicated Bluesky app password

In your Bluesky account settings, create an **App Password** specifically for
Dusk Industries Social Ops.

Do not use your primary Bluesky account password in Vercel.

You need:

```text
BLUESKY_IDENTIFIER
BLUESKY_APP_PASSWORD
```

`BLUESKY_IDENTIFIER` should be the account handle, for example:

```text
yourname.bsky.social
```

or a custom-domain handle.

## 2 — Add Vercel environment variables

Add to Production:

```text
BLUESKY_IDENTIFIER=<your handle>
BLUESKY_APP_PASSWORD=<your app password>
BLUESKY_PDS_URL=https://bsky.social
```

For a self-hosted/different PDS, set `BLUESKY_PDS_URL` to that account's PDS.

Redeploy after adding the variables.

There is no Bluesky client secret, OAuth callback, Meta-style webhook, or
Supabase token table required in v25.3.

## 3 — Run the SQL migration

Supabase → SQL Editor:

```text
supabase/migrations/20260923_v25_3_bluesky_social.sql
```

It expands the `post_platforms.platform` constraint to allow:

```text
bluesky
```

No existing Telegram/X/Instagram data is changed.

## 4 — Verify the provider

Open:

```text
/dashboard/posts
```

The Publishing Providers panel calls the Bluesky session endpoint using the
server-side app password.

A good setup displays:

```text
Bluesky
CONNECTED
@yourhandle
```

The card also shows the account DID.

If the credentials fail, Social Ops displays the provider error.

## 5 — Publishing support

v25.3 supports:

```text
text-only Bluesky posts
1–4 image posts
alt text from Dusk media
clickable URL facets
Incident Report / Tactical Deployment Plan links
provider URI + CID receipts
live bsky.app post URL
```

The current `app.bsky.feed.post` lexicon allows at most:

```text
300 graphemes
```

Dusk counts graphemes instead of raw JavaScript characters so emoji sequences
do not get incorrectly counted as several visible characters.

### Images

Bluesky posts can embed up to:

```text
4 images
```

Dusk uploads each image with:

```text
com.atproto.repo.uploadBlob
```

and publishes an:

```text
app.bsky.embed.images
```

record.

v25.3 rejects images above 2 MB before attempting the Post.

### Video

Bluesky supports native video at the protocol/app level, but Dusk v25.3 does
**not** enable video publishing yet.

If a Social Ops plan contains a video and Bluesky is selected, the composer
blocks scheduling Bluesky rather than silently dropping the video.

## 6 — Links

Dusk automatically creates `app.bsky.richtext.facet#link` facets for HTTP/HTTPS
URLs inside the final caption.

That includes the existing v25.2 deployment-document checkbox:

```text
Incident Report: https://duskdawolf.com/chaos/<slug>
```

or:

```text
Tactical Deployment Plan: https://duskdawolf.com/chaos/<slug>
```

The URL therefore remains clickable in the Bluesky post.

The appended deployment link counts toward Bluesky's 300-grapheme limit, and
Dusk validates the **final** platform caption before scheduling.

## 7 — Existing Make dispatcher

No new Make scenario is required.

Keep:

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
bluesky
```

Bluesky uses the same:

```text
Scheduled → Publishing → Published / Failed
```

lifecycle, provider receipts, retries, and Notification Ops integration as the
other live platforms.

## 8 — First test

Start with:

```text
Bluesky only
text only
under 300 graphemes
5–10 minutes in the future
```

Then test:

```text
one image
four images
deployment-document checkbox
```

Confirm the published Social Ops row has a live:

```text
https://bsky.app/profile/<handle>/post/<rkey>
```

URL.
