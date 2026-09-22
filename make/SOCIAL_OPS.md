# Dusk Industries v24.2 — Social Ops / Make Contract

v24.2 creates the publishing queue. v25.0 is where live provider publishing
gets connected.

## Source of truth

Supabase stays authoritative.

```text
Dashboard
  ↓
Supabase post + platform rows
  ↓
Make reads due jobs
  ↓
Provider publishes
  ↓
Make posts a receipt
  ↓
Supabase records URL / provider ID / failure
```

Make is the courier, not the database.

## Publishing queue

```text
GET https://duskdawolf.com/api/integrations/make/social-jobs
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

Only platform jobs that are:
- `status = scheduled`
- due at or before the current time

are returned.

Draft and Approved records are deliberately invisible to the publishing queue.

Each job includes:
- platform row ID
- post ID
- platform
- platform-specific caption, with master-caption fallback
- scheduled time
- related event
- ordered media URLs and media metadata

## Publishing receipt

```text
POST https://duskdawolf.com/api/integrations/make/social-jobs
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
Content-Type: application/json
```

Success:

```json
{
  "platformId": "uuid",
  "status": "published",
  "platformPostId": "provider-id",
  "postUrl": "https://...",
  "makeJobId": "optional-make-run-id",
  "publishedAt": "2026-09-22T20:15:00-04:00"
}
```

Failure:

```json
{
  "platformId": "uuid",
  "status": "failed",
  "makeJobId": "optional-make-run-id",
  "errorMessage": "Provider rejected the media upload."
}
```

The parent post reconciles automatically:
- all platforms published → `published`
- failed platforms with nothing pending → `failed`
- mixed success/failure → `partial_failure`

## Analytics capture

```text
POST https://duskdawolf.com/api/integrations/make/social-metrics
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

Example:

```json
{
  "platformId": "uuid",
  "reach": 1842,
  "impressions": 2204,
  "likes": 167,
  "comments": 21,
  "shares": 14,
  "saves": 9,
  "clicks": 5,
  "videoViews": 0,
  "followersGained": 3
}
```

Each call stores a new timestamped snapshot rather than overwriting history.

## Planned v25.0 provider order

1. Telegram
2. X
3. Instagram
4. Snapchat assisted handoff

Do not enable a live provider scenario until its authentication and media rules
have been tested against a private/test destination.
