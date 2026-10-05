# Dusk Industries v25.0 — Live Telegram Social Publishing

v25.0 is the first live Social Ops provider release.

The publishing chain is:

```text
Dusk Social Ops
   ↓
Supabase scheduled Telegram row
   ↓
Make clock / dispatcher trigger
   ↓
Dusk Telegram provider adapter
   ↓
Telegram Bot API
   ↓
provider receipt stored in Supabase
   ↓
Dusk notification: published / failed
```

Supabase remains the source of truth. Make acts as the clock that wakes the
dispatcher. Provider credentials stay in Vercel.

---

## 1 — Create / choose a Telegram bot

Use Telegram's official **@BotFather** to create a bot if you do not already
have one.

Copy the bot token.

Do not commit the token to GitHub.

---

## 2 — Add the bot to the posting destination

For a channel, add the bot to the channel and grant it permission to post.

For a group, add the bot to the group.

Dusk accepts either:

```text
@public_channel_username
```

or a Telegram numeric chat id.

For a public channel, using the `@username` form is easiest because Dusk can also
construct the public post URL automatically.

---

## 3 — Add Vercel environment variables

Vercel → Dusk project → Settings → Environment Variables.

Required:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

Example chat id:

```text
@duskdawolf
```

Optional:

```text
TELEGRAM_PUBLIC_CHAT_USERNAME
```

Use this only when the actual `TELEGRAM_CHAT_ID` is numeric/private but there is
a public channel username that should be used to build `https://t.me/...` links.

Optional for Telegram forum/group topics:

```text
TELEGRAM_MESSAGE_THREAD_ID
```

Apply the variables to Production and redeploy.

---

## 4 — Verify the provider from Dusk Dashboard

Open:

```text
/dashboard/posts
```

The **Publishing Providers** panel should show Telegram as:

```text
CONNECTED
```

It also displays:
- bot account
- target chat/channel
- supported media capabilities

Click:

```text
Send provider test
```

You should receive:

```text
🐾 Dusk Industries Social Ops provider test

Telegram v25.0 connection is operational.
```

If the provider status says the bot token is valid but the chat cannot be read,
check the chat id and bot membership/admin access.

---

## 5 — Run the v25 SQL migration

Supabase → SQL Editor:

```text
supabase/migrations/20260922_v25_0_live_social.sql
```

It adds provider receipt snapshots to `post_platforms`:

```text
provider_account
published_caption
published_media
provider_response
last_provider_check
```

These fields let Dusk preserve what actually published, not just what was
originally drafted.

---

## 6 — Create the Make dispatcher scenario

This scenario does not contain Telegram business logic. It wakes Dusk up and
Dusk handles the provider call.

Create a Make scenario:

```text
Scheduler
   ↓
HTTP → Make a request
```

Recommended schedule:

```text
Every 1–5 minutes
```

Use the smallest practical interval for your Make plan.

HTTP request:

```text
Method:
POST

URL:
https://duskdawolf.com/api/integrations/make/social-dispatch

Authentication:
None
```

Add header:

```text
Authorization
Bearer <your existing MAKE_WEBHOOK_SECRET>
```

Body:

```text
{}
```

Content type:

```text
application/json
```

Run once.

A successful empty response looks like:

```json
{
  "ok": true,
  "dispatched": 0,
  "results": []
}
```

That means the dispatcher works; there simply are no Telegram posts due.

Turn the scenario ON.

---

## 7 — Publish a private/test Social Ops post

Before sending real public content:

1. Open `/dashboard/posts`.
2. Choose only Telegram for the first test.
3. Write a test caption.
4. Attach zero, one, or several test images.
5. Save as Draft.
6. Approve it.
7. Schedule it 5–10 minutes ahead.
8. Wait for the Make dispatcher.

Social Ops should move through:

```text
Scheduled
→ Publishing
→ Published
```

Your v24.3 notification system should also create:
- Publishing started
- Published successfully

If Telegram fails permanently:

```text
Scheduled
→ Publishing
→ Failed
```

and Dusk creates an urgent `social.publish_failed` notification.

---

## 8 — Retry behavior

Transient Telegram errors such as rate limiting, temporary server errors, or
network errors receive automatic retries.

Maximum automatic attempts in v25.0:

```text
3
```

Backoff defaults to approximately:

```text
5 minutes
15 minutes
30 minutes
```

If Telegram supplies a retry-after duration, Dusk respects it up to one hour.

Permanent validation/auth/chat-permission errors fail immediately and wait for
manual attention.

The Social Ops **Retry failed** button can put a failed job back into the queue
after the underlying problem is corrected.

---

## 9 — Telegram publishing rules implemented by v25.0

Dusk validates before scheduling:

```text
Text-only post:
maximum 4096 characters

Media post caption:
maximum 1024 characters on the media itself

Album:
2–10 photos/videos

Overall Dusk media limit:
10 items
```

If a media post's full caption is longer than 1024 characters but no longer than
4096, Dusk publishes:

```text
media / album
then
full caption as a separate text message
```

That preserves the full Social Ops caption without silently truncating it.

Single-photo and single-video posts are supported.

Mixed photo/video albums are supported.

---

## 10 — Staged X / Instagram / Snapchat variants

v25.0 does not throw away future platform variants.

You may keep Telegram + X + Instagram selected on one Social Ops plan.

When you schedule it:

```text
Telegram → Scheduled / live
X → remains Approved
Instagram → remains Approved
Snapchat → remains Approved
```

After Telegram publishes, the canonical post can be considered published while
those future destination records stay preserved for the upcoming provider
releases.

Planned next releases:

```text
v25.1  X
v25.2  Instagram
v25.3  Snapchat assisted handoff
v25.4  metrics / optimization refinement
```
