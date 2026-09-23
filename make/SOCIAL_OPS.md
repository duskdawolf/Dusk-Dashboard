# Dusk Industries v25.2 — Live Social Ops / Make Contract

## Live provider state

```text
Telegram   LIVE
X          LIVE
Instagram  LIVE
Snapchat   staged for v25.3
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

The dispatcher now claims due rows where platform is:

```text
telegram
twitter
instagram
```

Dusk, not Make, owns:
- provider validation
- X OAuth/token refresh
- Instagram OAuth/long-lived-token refresh
- Telegram/X direct publishing
- Instagram container creation/polling/publishing
- provider receipt storage
- retries
- parent-post reconciliation
- Notification Ops

## Instagram container state

Instagram can take several minutes to process a Reel or carousel.

If the container is not ready within the current dispatcher request, Dusk stores
the Instagram container ID/state inside `post_platforms.provider_response`,
reschedules the same platform job, and resumes the existing container later.

The Make scenario does not need branches or delays for Instagram.

## Duplicate-send protection

Every due live-provider row is conditionally changed:

```text
scheduled → publishing
```

before an external provider request begins.

An overlapping dispatcher run cannot claim that same row again after it leaves
`scheduled`.

## Generic provider queue

The older generic provider queue remains available for future adapters:

```text
GET  /api/integrations/make/social-jobs
POST /api/integrations/make/social-jobs
```

By default v25.2 excludes Telegram, X, and Instagram because the live dispatcher
owns all three.

For debugging only:

```text
GET /api/integrations/make/social-jobs?includeLive=1
```

Do not create parallel provider-publishing scenarios against that queue.

## Failure / retry

Telegram/X use the standard live-provider retry budget.

Instagram gets an extended retry budget because `IN_PROGRESS` is a normal media
container state rather than a publishing failure.

Permanent auth, permission, media-format, or container errors move that
destination to Failed and trigger Notification Ops.

## Analytics

The existing ingestion endpoint remains:

```text
POST /api/integrations/make/social-metrics
```

Shared provider-metric collection/normalization remains planned for v25.4.
