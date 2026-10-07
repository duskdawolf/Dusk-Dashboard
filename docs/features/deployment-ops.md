# Deployment Ops

This describes the implementation at Alpha v31.1 before Alpha v31.2 work.
Repository source establishes behavior; it does not establish which migrations,
credentials, or cron jobs are installed in a live Supabase project.

## Entry points and selection

[The con-prep layout](../../src/app/dashboard/con-prep/layout.tsx) renders
[Alpha8ConventionWorkspace](../../src/components/alpha8/Alpha8ConventionWorkspace.tsx)
and ignores its `children`. This is the visible workspace under `/dashboard/con-prep`.
The retained page components and older editors are separate source paths; they should
not be treated as the current workspace's rendering implementation.

The workspace loads `GET /api/alpha7/con-preps`, selects an existing `?prep=<id>`,
otherwise keeps its current selection or chooses the first result, and updates the URL.
[The list route](../../src/app/api/alpha7/con-preps/route.ts) includes preps owned by
the authenticated user and preps with no owner. It orders active events first,
upcoming events by start ascending, and remaining events by start descending.
`?add=1` opens Add Deployment and is then removed from the URL.

## Workspace records and sections

[The summary endpoint](../../src/app/api/alpha8/con-preps/[id]/summary/route.ts)
loads the prep and linked event plus packing, tasks, hotels, travel, registrations,
costs, and schedule sub-events. It also builds Where to Find Dusk.
Packing and tasks are ordered by `sort_order`; schedule items by `starts_at`.

The main disclosure sections are Readiness, Packing & Loadouts, Tasks & Subtasks,
Travel, Hotel & Badge, Schedule & Appearances, Where to Find Dusk, Budget & Costs,
and Event Notes & Programming. The side panel includes Chaos, Next Stop, and quick details.
[The editor](../../src/components/alpha8/Alpha8WorkspaceEditor.tsx) handles individual
record forms. A successful save refreshes the options and current summary.

[The records route](../../src/app/api/alpha8/con-preps/[id]/records/route.ts) accepts
`POST`, `PATCH`, and `DELETE`, with a resource name and permitted values.
[workspace-records.ts](../../src/lib/alpha8/workspace-records.ts) maps resources to
`packing_items`, `prep_tasks`, `hotel_stays`, `travel_segments`, `con_registrations`,
`cost_entries`, `con_preps`, or `events`. Unknown fields are dropped.
Prep/event records are updated through their deployment context, not created or
deleted through this generic endpoint. Child updates/deletes also match `con_prep_id`.

## Creation and defaults

[Add Deployment](../../src/components/alpha8/Alpha8AddDeploymentSheet.tsx) can discover
convention information before submitting confirmed fields to
[POST /api/alpha8/deployments](../../src/app/api/alpha8/deployments/route.ts).
Discovery calls [the Alpha9 endpoint](../../src/app/api/alpha9/deployments/discover/route.ts),
which uses OpenAI Responses with required `web_search`, a strict fact schema, and
`OPENAI_DEPLOYMENT_DISCOVERY_MODEL` (default `gpt-5.5`). It returns editable event facts
and up to six citation URLs. Search is optional: the form also accepts manual input,
always sends `event_type=convention`, and saves neither the returned official URL nor
citations or a directory reference. The directory-only Convention / Other Event
flow is [planned for Alpha v31.2](../product-specs/alpha-v31.2-convention-directory.md).
The creation route inserts an event with a generated slug and the authenticated owner,
then a prep. If prep insertion fails, it attempts to delete the newly created event.
This route does not populate default packing, tasks, hotels, or travel records.
The UI sends `planning`; the API accepts a supplied status, subject to database constraints.
The event defaults to unpublished and visible in the Next Stop route sequence.

Manual packing defaults to unpacked, quantity 1, `required=false`, and source `manual`.
Tasks default to `todo`; their UI defaults Required and Counts toward readiness on.
Costs default to USD, source `manual`, and `cost_status=budgeted`.
Hotel, travel, and registration amounts are distinct fields; this CRUD helper does
not automatically create matching `cost_entries` from those record types.

## Nesting and direct-editing limits

Packing and task parent IDs are persisted self-references with cascading child deletion
in [the base Alpha migration](../../supabase/V26_ALPHA_RUN_THIS_WHOLE_FILE.sql).
The current workspace renders both lists flat. The task editor offers Parent task;
the packing editor does not offer a parent selector, although the API accepts one.
Neither the generic helper nor this editor validates cycles or same-deployment parents.
[Template application](../../src/lib/conventions/deploy.ts) preserves packing parents
when templates are ordered so parents have already been mapped.

There is a current direct-task status mismatch: the UI sends `status`, but the task
allowlist in `workspace-records.ts` omits it. A checkbox PATCH containing only status
fails with `No permitted fields supplied.` An editor save drops status; creation stays
`todo`. [Chaos record actions](../../src/lib/alpha7/record-actions.ts) do allow task status.
The workspace checkbox recognizes `done`, `complete`, and `completed`; SQL and summary
completion counts recognize `done` and `skipped`. See [readiness and lifecycle](readiness-lifecycle.md).

## Authorization and public output

[requireAlpha7Admin](../../src/lib/alpha7/auth.ts) verifies a Supabase user with email.
It enforces `DUSK_ADMIN_EMAILS` only when that list is nonempty; an empty list is not
an explicit admin-role check. Prep ownership blocks a different non-null owner,
while unowned preps remain usable. Calls use the server secret/service-role client
from [supabase-admin.ts](../../src/lib/alpha7/supabase-admin.ts), so route checks matter.

Public `/deployments/future`, `/deployments/past`, and `/deployments/[slug]` are
archive/report views rather than this operational editor. `/chaos/[slug]` redirects
to the deployment report. Their date classification is independent of stored prep status.
[Where to Find Dusk](where-to-find-dusk.md) documents appearance visibility separately.

## Validation boundary

[verify-alpha-v31-1.mjs](../../scripts/verify-alpha-v31-1.mjs) checks files, selected UI
strings, version, and security SQL text. It does not prove authenticated CRUD,
database trigger execution, parent constraints, deployed cron, or live public filtering.
