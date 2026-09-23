# Dusk Industries v25.3 — Live Social Ops / Make Contract

## Live provider state

```text
Telegram   LIVE
X          LIVE
Instagram  LIVE
Bluesky    LIVE
Snapchat   postponed / staged
```

## One dispatcher for all live providers

Keep one Make scenario:

```text
Schedule every 1–5 minutes
        ↓
HTTP POST
https://duskdawolf.com/api/integrations/make/social-dispatch
```

Headers:

```text
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
Content-Type: application/json
```

Body:

```json
{}
```

The dispatcher now claims due rows for:

```text
telegram
twitter
instagram
bluesky
```

Dusk owns:
- provider validation
- Telegram publishing
- X OAuth/token refresh + publishing
- Instagram OAuth/container publishing
- Bluesky AT Protocol session + blob publishing
- provider receipt storage
- retries
- parent-post reconciliation
- Notification Ops

## Bluesky

Make contains no Bluesky logic.

Dusk logs into the configured Bluesky PDS using the server-side app password,
uploads image blobs when needed, creates `app.bsky.feed.post` records, stores
the AT URI/CID/live bsky.app URL, and reports success/failure through the same
dispatcher response.

## Generic provider queue

The legacy generic endpoint remains:

```text
GET  /api/integrations/make/social-jobs
POST /api/integrations/make/social-jobs
```

By default v25.3 excludes Telegram, X, Instagram, and Bluesky because the live
dispatcher owns them.

For debugging only:

```text
GET /api/integrations/make/social-jobs?includeLive=1
```

Do not create parallel provider-publishing scenarios against that queue.

## Analytics

The existing metrics ingestion endpoint remains:

```text
POST /api/integrations/make/social-metrics
```

Shared provider-metric collection/normalization remains a later Social Ops
analytics pass.
