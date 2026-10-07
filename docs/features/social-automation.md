# Social publishing and automation

Status: **CURRENT IMPLEMENTATION**. Provider support below describes the checked-in
code; it does not establish that production credentials, accounts, Make schedules,
or Supabase Cron jobs are configured. Alpha v31.2 directory refreshes run through this tick when enabled; see [Convention Directory](convention-directory.md).

## Publishing model

- `/dashboard/posts` uses [PostManager](../../src/components/PostManager.tsx) and
  the authenticated [posts API](../../src/app/api/admin/posts/route.ts).
- `posts` holds title, master caption, optional `event_id`, base schedule, approval,
  parent status and automation status. `post_media` orders reusable media assets.
- `post_platforms` holds a destination, caption/schedule overrides, status, attempts,
  errors, provider receipt, live URL and published caption/media snapshots.
- The editable workflow is `draft → approved → scheduled`; the dispatcher claims
  platform rows as `publishing`, then records `published`, retries, or `failed`.
  Scheduling requires a live configured destination and a time for every live one.
- Snapchat remains staged as `approved` when live destinations are scheduled.
  Existing published destination rows are preserved when the post is edited.
- [Parent reconciliation](../../src/lib/social/reconcile.ts) derives aggregate state:
  all live destinations published can yield `published_with_staged_destinations`;
  mixed failures yield `partial_failure`; active sends yield `publishing`.
  `ready_for_make` is a stored historical name, even when Cron invokes dispatch.

## Providers and configuration

[Provider registry](../../src/lib/social/providers.ts) distinguishes `live`
(implemented), `configured` (required settings present), and `connected` (account
or provider check). `/api/admin/social/providers` GET reports these; its Telegram
POST test **sends an actual message**. A configured OAuth app alone is insufficient.

| Provider | Current publishing support | Required server settings / connection |
| --- | --- | --- |
| [Telegram](../../src/lib/social/telegram.ts) | Text, images, videos, albums; 4,096 text characters, 10 assets; long media captions sent separately | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; optional thread ID/public username |
| [X](../../src/lib/social/x.ts) (`twitter`) | Text, up to four photos, or one video/GIF; default 280 characters | `X_CLIENT_ID`, `X_CLIENT_SECRET`, `SOCIAL_TOKEN_ENCRYPTION_KEY`, connected admin OAuth account |
| [Instagram](../../src/lib/social/instagram.ts) | JPEG feed images, video/Reel, up to 10 carousel assets; 2,200 caption characters | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `SOCIAL_TOKEN_ENCRYPTION_KEY`, connected admin account |
| [Bluesky](../../src/lib/social/bluesky.ts) | Text and up to four images; 300 graphemes; video unsupported | `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`; optional `BLUESKY_PDS_URL` |
| Snapchat | No live adapter | Staged only |

X/Instagram connections are stored per user in `social_provider_connections`,
with encrypted access/refresh tokens. [Encryption](../../src/lib/social/crypto.ts)
uses AES-256-GCM and requires a base64-encoded 32-byte key. RLS has no client read
policy for this table. Dispatch selects an authorized administrator's connection;
this is not a general multi-user publishing-account router.

Optional deployment links are appended by [deployment-link](../../src/lib/social/deployment-link.ts).
They still use `/chaos/{slug}`, which redirects to `/deployments/{slug}`. The
caption label is selected from the event **start**, rather than end, timestamp.
The [Social Review API](../../src/app/api/admin/social/review/route.ts) generates
Copilot suggestions and records usage; a review never publishes a post.

## Dispatch, retries and limits

[Social dispatch](../../src/app/api/integrations/make/social-dispatch/route.ts)
accepts POST with `Authorization: Bearer <MAKE_WEBHOOK_SECRET>`. Each invocation
loads at most 10 due live-provider rows and processes them sequentially. A
conditional `scheduled → publishing` update prevents overlapping dispatchers
from claiming the same scheduled row. Success stores provider receipts and
notifies administrators; retryable errors reschedule with 5/15/30-minute delays
or a provider suggestion capped at one hour. Instagram allows six attempts;
other live providers allow three. Nonretryable/exhausted jobs become failed.

Claims do not guarantee exactly-once delivery across external-provider success,
database-write failure or process interruption. There is no stale `publishing`
lease/recovery sweep here. Inspect provider receipts before manually retrying an
uncertain send. Avoid parallel generic Make publishing for live providers.

## Unified tick and Supabase Cron

[Automation tick](../../src/app/api/integrations/automation/tick/route.ts) POST:

1. Runs `dusk_alpha31_lifecycle_sweep` through the server Supabase client.
2. Calls sub-event reminder sweep and social dispatch in parallel.
3. Returns 200 when all operations succeed, or 207 with per-operation results.

The tick authorizes `AUTOMATION_TICK_SECRET ?? MAKE_WEBHOOK_SECRET`; outbound reminder/social child calls now use `MAKE_WEBHOOK_SECRET` when available, so the inbound secret can differ. Directory work runs independently and reports its own result. No additional Make polling is needed. The tick does not run every older Make workflow.

[Cron activation SQL](../../supabase/ALPHA_V31_ENABLE_SUPABASE_CRON_AFTER_DEPLOY.sql)
is a separate manual operation after application deployment. It enables `pg_cron`
and `pg_net`, creates Vault entries for URL/secret when absent, replaces the
named job, and schedules the tick every five minutes. Replace the placeholder
securely before execution. Rerunning does not update existing Vault values.
Its intent is to replace Make's social polling; SQL presence proves no live job.

## Remaining Make contracts and database prerequisites

All [Make routes](../../src/app/api/integrations/make) require the shared bearer
secret. Checked-in [scenario guidance](../../make/SCENARIOS.md) describes external
Google Calendar and Telegram couriers; it is not an exported active scenario.

| Endpoint under `/api/integrations/make/` | Current responsibility |
| --- | --- |
| `calendar-jobs` GET/POST | Unlinked task/travel/hotel calendar jobs and Google Calendar ID receipts |
| `notifications` GET/POST | Pending Telegram deliveries and receipts; email is sent directly through Resend |
| `notification-sweep` POST | General event/task/travel/hotel/social reminders; separate from the unified tick |
| `sub-event-reminder-sweep` POST | Opted-in upcoming schedule reminders; short polling window and dedupe |
| `social-jobs` GET/POST | Generic queued jobs/receipts; excludes all live providers unless `includeLive=1` |
| `social-metrics` POST | Inserts metrics snapshots; no shared automated analytics collector implemented |
| `events`, `create-notification` POST | External event upserts and notification creation |

Social tables begin in [Ops migration](../../supabase/migrations/20260921_ops_media_posts_conprep.sql),
followed by [queue reliability](../../supabase/migrations/20260922_v24_2_social_ops.sql),
[receipt fields](../../supabase/migrations/20260922_v25_0_live_social.sql),
[X connections](../../supabase/migrations/20260922_v25_1_x_social.sql),
[Instagram/link fields](../../supabase/migrations/20260923_v25_2_instagram_social.sql),
and [Bluesky constraint](../../supabase/migrations/20260923_v25_3_bluesky_social.sql).
The tick additionally needs Alpha 9 schedule tables, [v31 automation](../../supabase/ALPHA_V31_DEPLOYMENT_AUTOMATION_RUN_THIS.sql)
and the subsequent [v31.1 security hotfix](../../supabase/ALPHA_V31_1_SECURITY_HOTFIX_RUN_THIS.sql).

Do not put bearer secrets or provider credentials in code, documentation, logs,
or public environment variables. Current external event upserts can change event
fields by slug; directory-only refreshes use a separate write boundary in
[Alpha v31.2](../product-specs/alpha-v31.2-convention-directory.md).
