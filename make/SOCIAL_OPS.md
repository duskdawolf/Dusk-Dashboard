# Dusk Industries v25.1 — Live Social Ops / Make Contract

## Live providers

```text
Telegram   LIVE
X          LIVE
Instagram  staged for v25.2
Snapchat   staged for v25.3
```

Keep exactly one live publishing scenario:

```text
Schedule every 1–5 minutes
        ↓
HTTP POST
https://duskdawolf.com/api/integrations/make/social-dispatch
```

Header:

```text
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
Content-Type: application/json
```

Body:

```json
{}
```

The dispatcher claims due `telegram` and `twitter` rows by moving them from
`scheduled` to `publishing` before contacting the provider. Dusk owns provider
validation, OAuth refresh, media upload, publication, retries, receipts, parent
post reconciliation, and notifications.

The older `/api/integrations/make/social-jobs` endpoint remains for future
provider work, but v25.1 excludes Telegram and X from its normal GET results.
Use `?includeLive=1` only for debugging; do not build a second live publisher
against it.

Shared provider metrics ingestion still exists at:

```text
POST /api/integrations/make/social-metrics
```

Automated cross-provider metric collection is planned for v25.4.
