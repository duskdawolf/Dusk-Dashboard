# Dusk Industries v26.0 Alpha 5 — Chaos Social Review

Alpha 5 moves Chaos Copilot out of the top of Social Ops and directly into the
posting workflow.

## Review workflow

Every draft / approved / scheduled post now has:

```text
✨ Review with Chaos
```

The review screen receives only the current submission plus compact relevant
history. It reviews:

- master wording
- platform-specific wording
- current media/order
- deployment-link usefulness
- posting time per platform
- likely reach / platform fit
- quick wins before publishing

The review does not publish anything. Suggestions are applied back to the
composer and still go through normal approval / scheduling / provider checks.

## Evidence priority

Chaos uses:

```text
1. Dusk-specific historical post metrics
2. current online guidance when Dusk data is sparse
3. general platform reasoning as the last fallback
```

Every review labels its evidence basis and confidence. If online search is used,
the screen says so and displays source links.

Web search is only enabled when the review context reports sparse Dusk-specific
history. It uses low search context to limit token/tool cost.

## Staggered timing

The composer now supports optional per-platform schedule overrides.

```text
Base time: Friday 7:00 PM
Instagram override: Friday 7:20 PM
Bluesky override: Friday 6:35 PM
X override: Friday 8:05 PM
Telegram: inherits base time
```

Chaos timing suggestions can be applied one platform at a time or with Apply All.
The parent post uses the earliest live destination time while each provider job
retains its own `scheduled_at` value.

## Social chat

The standalone Social Ops Chaos chat is removed.

Follow-up conversation now lives inside the review itself, so questions like:

```text
Why later on Instagram?
Keep my wording but change the times.
Make only the Bluesky version more chaotic.
```

remain scoped to the exact submission being reviewed.

## Cost controls

Alpha 4's cheap-context architecture remains:

- `store: false`
- low reasoning
- explicit caching mode with no cache breakpoint
- compact pre-aggregated Dusk metrics instead of raw metric dumps
- Luna by default

Alpha 5 additionally records web-search calls in the existing Chaos AI Usage
card. OpenAI currently prices web search at $10 / 1,000 calls plus search-content
tokens at the selected model's token rate, so the estimator adds the $0.01 base
call charge and normal response usage. Web fallback can be disabled with:

```text
CHAOS_SOCIAL_WEB_FALLBACK=off
```

## Future Beta groundwork

`posts.owner_user_id` is added now. New posts are assigned to the current
operator, and Social Review uses matching user-owned history while still
allowing legacy Alpha posts with no owner.

## SQL

If Alpha 4 is already installed, run only:

```text
supabase/migrations/20260924_v26_alpha5_social_review.sql
```

## Optional Vercel variables

```text
OPENAI_SOCIAL_REVIEW_MODEL=gpt-5.6-luna
CHAOS_SOCIAL_WEB_FALLBACK=on
```

If `OPENAI_SOCIAL_REVIEW_MODEL` is omitted, Social Review inherits
`OPENAI_COPILOT_MODEL`.

No Make changes are required.
