# Chaos Copilot

Status: **CURRENT IMPLEMENTATION**. Two proposal systems coexist. Deployment Ops uses
the Alpha 7 APIs through the newer Alpha 8 workspace; the global dashboard still uses
the older `/api/admin/copilot` chat. Neither path gives the model arbitrary SQL execution.
Repository SQL describes the required schema, not the live migration state.

## Current Deployment Ops analysis

The [con-prep layout](../../src/app/dashboard/con-prep/layout.tsx) always renders
[Alpha8ConventionWorkspace](../../src/components/alpha8/Alpha8ConventionWorkspace.tsx).
Its [Chaos card](../../src/components/alpha8/Alpha8ChaosCard.tsx) sends instructions, an
uploaded image, or a Media Library image to
[`POST /api/alpha7/chaos/analyze`](../../src/app/api/alpha7/chaos/analyze/route.ts).

The analysis route loads [deployment context](../../src/lib/alpha7/deployment-context.ts)
(event, prep, hotels, travel, registrations, costs), packing, tasks, and sub-events.
It reuses the latest unarchived thread for this user/deployment and supplies four recent
messages. The full selected records, potentially including private confirmations and
costs, are sent to OpenAI with the instruction/image; `store: false` is set.

Uploads allow JPEG, PNG, WebP, HEIC/HEIF up to 4 MiB at the route. They are saved to private
`copilot-attachments` with an attachment row. Media Library selection checks image kind
and rejects a nonnull owner different from the operator; it fetches `media.url` and stores
an attachment reference rather than copying the image to the private bucket. The selected
media branch does not apply the upload branch's 4 MiB limit.

The Responses model is `OPENAI_COPILOT_VISION_MODEL` → `OPENAI_COPILOT_MODEL` →
`gpt-5.6-luna`, using server-only `OPENAI_API_KEY`. It returns JSON containing `summary`
and up to 12 proposals under a schema with `strict: false`. Each proposal has an action
type, title, explanation, existing `record_id` or null, and a `changes` object.

| Action type | Target |
| --- | --- |
| `upsert_hotel` | Personal `hotel_stays` reservation data |
| `upsert_travel` | `travel_segments` |
| `upsert_registration` | `con_registrations` |
| `upsert_cost` | `cost_entries` |
| `upsert_packing_item` | `packing_items` |
| `upsert_prep_task` | `prep_tasks` |
| `upsert_sub_event` | `deployment_sub_events` schedule |
| `update_event` | Selected `events` row |
| `update_con_prep` | Selected `con_preps` timing/notes |

The prompt forbids invented facts, direct readiness/status changes, and new schedule
items without exact timestamps. It asks matching records to use their exact IDs.
Analysis persists user/assistant messages and `copilot_actions` in `proposed` status;
all these record proposals are `risk_level=normal`, `requires_reauth=false`. Attachment
rows retain extraction JSON/model. Analysis alone does not apply proposed planning changes.

## Approval and typed execution

[`GET /api/alpha7/chaos/actions`](../../src/app/api/alpha7/chaos/actions/route.ts) lists the
operator's latest 30 matching record proposals for a deployment. The current card displays
up to six pending proposals with Apply buttons; it has no rejection or reauthentication UI.

[`POST .../actions/[id]/apply`](../../src/app/api/alpha7/chaos/actions/[id]/apply/route.ts)
checks action ownership and `proposed` status, marks it executing/approved, invokes the
[typed executor](../../src/lib/alpha7/record-actions.ts), then records completion or failure.
The executor filters changes against per-action field allowlists. Existing child updates
match both row ID and deployment ID; null IDs insert rows with defaults. New schedule
items require a title and nonempty start value; database types constrain stored timestamps.
Readiness and lifecycle fields are excluded from the event/prep allowlists.

Applying planning data can trigger the database's derived readiness/lifecycle behavior;
the model does not calculate or directly set those values. Hotel actions concern personal
reservations, not official Convention Edition hotels.

## Older chat, still active globally

The [global dashboard](../../src/app/dashboard/page.tsx) renders
[ChaosCopilot](../../src/components/ChaosCopilot.tsx), which uses
[`/api/admin/copilot/chat`](../../src/app/api/admin/copilot/chat/route.ts).
Older deployment components also retain it, but are superseded by the current con-prep layout.
The API supports `global`, `deployment`, and `social` context; a thread must match its user,
scope, prep/post IDs, and archive state. A missing browser thread ID creates a fresh chat.

[Context loading](../../src/lib/copilot/context.ts) supplies compact database summaries
and operator preferences; only four recent messages are sent. The model uses
`OPENAI_COPILOT_MODEL` or `gpt-5.6-luna`, `store: false`, low reasoning/verbosity,
900 output tokens, and explicit prompt cache mode with no breakpoint. These are request
settings, not a guarantee of caching or cost. The handler allows 60 seconds.

Its five function tools propose `add_packing_items`, `add_tasks`, `social_copy_plan`,
`social_schedule`, or `publish_now`. They create persisted proposals; titles/explanations
serve as the response when no text is returned, avoiding a second model call. Approved
[actions](../../src/lib/copilot/actions.ts) add nested packing/tasks with label/title
deduplication, update captions, or schedule validated live social destinations.
`publish_now` queues destinations for immediate dispatch; it does not directly call a
provider publish endpoint. There is no browser/search tool in this chat's tool list.

The [decision endpoint](../../src/app/api/admin/copilot/actions/[id]/route.ts) supports
approval/rejection. Sensitive `publish_now` requires a fresh action-specific grant.
[Reauthentication](../../src/app/api/admin/copilot/reauth/route.ts) verifies the operator's
Supabase password and creates a 10-minute grant; only its SHA-256 hash is stored.
The raw token goes in `X-Chaos-Reauth-Grant` and is consumed during approval.

## Data, usage, and security limits

[Chaos foundation SQL](../../supabase/migrations/20260923_v26_alpha_chaos_ops.sql) defines
`copilot_threads`, `copilot_messages`, `copilot_actions`, and `security_grants` with RLS.
[Alpha 7 complete SQL](../../supabase/V26_ALPHA7_COMPLETE_RUN_THIS.sql) adds attachments,
event/attachment action references, and private screenshot Storage. Server clients use
Supabase secret/service-role credentials, so route checks are the effective access boundary.

The older chat records [usage metadata](../../src/lib/copilot/usage.ts) on assistant
messages; [`/usage`](../../src/app/api/admin/copilot/usage/route.ts) totals the operator's
24-hour/7-day telemetry. Cost is an estimate using embedded model prices, cache weighting,
and recorded search calls. Alpha 7 analysis and Next Stop do not write this usage metadata,
so the dashboard usage card is not a complete AI spending ledger.

- Older APIs use [dashboard editor/admin authorization](../../src/lib/auth.ts). Alpha 7
  uses [a separate gate](../../src/lib/alpha7/auth.ts): an empty `DUSK_ADMIN_EMAILS` accepts
  any signed-in user with email. It does not inherit the older profile-role check.
- Alpha 7 context reads and direct event/prep updates lack deployment-owner filters.
  Older social context/action targets also lack comprehensive per-owner checks. Do not
  represent either implementation as a completed multi-user isolation model.
- Approval, execution, grant consumption, and audit updates are separate operations,
  not an atomic claim/transaction. Failed/partial work requires inspecting actual rows
  before retrying; pending status checks alone do not establish concurrency safety.
- Current proposals are AI suggestions checked by typed field filters/database constraints.
  They are not official directory verification, automatic web research, or autonomous edits.
  Alpha v31.2's directory is implemented separately; Copilot cannot create or verify editions. See [Convention Directory](convention-directory.md).
