# Dusk Industries v24.3 — Notification Ops Make Contract

## Hourly operational sweep

Recommended scenario:

```text
Schedule: every hour
  ↓
HTTP POST
https://duskdawolf.com/api/integrations/make/notification-sweep
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

The server decides which reminders exist and deduplicates them. Make does not
need to reproduce business logic.

## Telegram delivery queue

```text
GET https://duskdawolf.com/api/integrations/make/notifications?channel=telegram
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

For each returned delivery:
1. send the notification title/message to Dusk's Telegram destination
2. preserve the target URL as a button/link when possible
3. POST the delivery result back

Receipt:

```json
{
  "deliveryId": "uuid",
  "status": "sent",
  "providerMessageId": "telegram-message-id"
}
```

Failure:

```json
{
  "deliveryId": "uuid",
  "status": "failed",
  "errorMessage": "Telegram API error"
}
```

A failed queued delivery receives one retry after 15 minutes before the failure
becomes final.

## Email delivery in v24.4

Email no longer uses Make.

When Email is enabled for a notification topic, Dusk Notification Ops sends the
message directly through Resend and records the result in
`notification_deliveries`.

Supabase Auth recovery/magic-link email is also routed through Resend using
Supabase Custom SMTP. See `RESEND_SETUP.md`.

## External systems creating notifications

```text
POST https://duskdawolf.com/api/integrations/make/create-notification
Authorization: Bearer <MAKE_WEBHOOK_SECRET>
```

Example:

```json
{
  "adminEmail": "benc555@mac.com",
  "topicKey": "integration.make_failed",
  "title": "Calendar automation failed",
  "message": "The Google Calendar scenario exhausted its retries.",
  "targetUrl": "/dashboard/notifications",
  "actionLabel": "Inspect automation",
  "dedupeKey": "make-calendar-failure-2026-09-22"
}
```

Do not select channels in Make. The user's Notification Routing Preferences
decide whether that event goes to Dashboard, Web Push, Telegram, and/or Email.

## Source of truth

Supabase owns:
- notification record
- read/unread
- topic key
- user preferences
- delivery status
- failure history
- dedupe behavior

Make remains a courier.
