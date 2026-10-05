# Dusk Industries v26.0 Alpha 4 — Cheap Chaos

Alpha 4 is the cost-optimization pass for Chaos Copilot™ and fixes the
Convention Ops `taskTemplates` TypeScript build error.

## Cost changes

- Default Copilot model is now `gpt-5.6-luna`.
- New optional env override: `OPENAI_COPILOT_MODEL`.
- Legacy `OPENAI_MODEL` is intentionally ignored so an old premium-model value
  cannot silently keep running up API spend.
- Responses use `reasoning.effort = low`.
- Responses use low verbosity and a 900-token output cap.
- `store` is now `false`; Supabase remains the durable conversation store.
- Prompt caching is explicit-only with no breakpoint, intentionally producing
  no prompt-cache writes for the changing deployment/social context.
- Conversation history sent to OpenAI is reduced from 12 messages to 4.
- Deployment context is compacted to the selected con identity, readiness,
  relevant packing/task labels, and concise travel/hotel/budget state.
- Action/tool proposals no longer trigger a second OpenAI response just to say
  that a proposal was created. The UI renders the proposal itself.

## Admin usage card

The Dashboard now shows rolling 24-hour Chaos Copilot telemetry:

- requests
- input tokens
- cache reads
- cache writes
- output tokens
- reasoning tokens
- model mix
- estimated cost

Telemetry is stored inside existing `copilot_messages.metadata`, so no separate
usage table is required. The cost number is an operational estimate based on
the model pricing embedded in this build, not an OpenAI invoice.

## Convention Ops build fix

`ConOpsManager` now accepts the `taskTemplates` prop that the server page
passes, and the templates are actually exposed through an `Add suggested task
set` selector. This fixes:

```text
Property 'taskTemplates' does not exist ...
```

## SQL

If you have been running the earlier v26 Alpha migrations, run:

```text
supabase/migrations/20260923_v26_alpha4_optimized_copilot.sql
```

It guarantees the suggested-task-template tables/seeds exist for the updated
Convention Ops page. No usage/billing table is added.

## Vercel

Keep:

```text
OPENAI_API_KEY=...
```

Add or change to:

```text
OPENAI_COPILOT_MODEL=gpt-5.6-luna
```

You can remove the old `OPENAI_MODEL` variable; Alpha 4 ignores it.

No Make changes.
