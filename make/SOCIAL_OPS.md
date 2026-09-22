# Dusk Industries v25.0 — Live Social Ops / Make Contract

## v25.0 provider state

```text
Telegram   LIVE
X          staged for v25.1
Instagram  staged for v25.2
Snapchat   staged for v25.3
```

## Telegram dispatcher

Make acts as the publishing clock.

Recommended scenario:

```text
Schedule every 1–5 minutes
        ↓
HTTP POST
https://duskdawolf.com/api/integrations/make/social-dispatch
        ↓
Dusk claims due Telegram jobs
        ↓
Dusk publishes through Telegram Bot API
        ↓
Dusk stores provider receipt
        ↓
Dusk creates publish/failure notifications
```

Request:

```text
POST https://duskdawolf.com/api/integrations/make/social-dispatch
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
Content-Type: application/json
```

Body:

```json
{}
```

A successful no-work response:

```json
{
  "ok": true,
  "dispatched": 0,
  "results": []
}
```

The dispatcher includes:
- conditional job claim to prevent duplicate sends
- up to 10 due Telegram jobs per run
- provider validation
- up to 3 transient-error attempts
- retry-after support
- published receipt storage
- parent-post reconciliation
- Notification Ops integration

## Generic provider queue

The v24.2 generic provider queue remains for future provider adapters:

```text
GET /api/integrations/make/social-jobs
POST /api/integrations/make/social-jobs
```

By default, `GET /social-jobs` now excludes Telegram because Telegram is owned by
the v25.0 dispatcher.

For debugging/backwards compatibility only:

```text
GET /api/integrations/make/social-jobs?includeTelegram=1
```

Do not run a second Telegram publishing scenario against that generic queue or
you risk duplicate publishing.

## Generic publishing receipt

Future X/Instagram Make/provider adapters can post:

```json
{
  "platformId": "uuid",
  "status": "published",
  "platformPostId": "provider-id",
  "postUrl": "https://...",
  "providerAccount": "@account",
  "publishedCaption": "actual caption",
  "publishedMedia": [],
  "providerResponse": {},
  "makeJobId": "optional-run-id",
  "publishedAt": "2026-09-22T20:15:00-04:00"
}
```

Failure:

```json
{
  "platformId": "uuid",
  "status": "failed",
  "errorMessage": "Provider rejected the media upload."
}
```

## Analytics

The existing metrics endpoint remains:

```text
POST /api/integrations/make/social-metrics
```

Telegram Bot API publishing does not provide the richer organic reach/engagement
analytics Dusk ultimately wants, so v25.0 treats Telegram analytics capability as
unavailable while preserving the metrics architecture for X/Instagram and later
analytics work.
