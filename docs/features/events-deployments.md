# Events and deployments

This records current Alpha v31.2 source behavior, not proof of hosted activation. See [Convention Directory](convention-directory.md) for official selection, legacy review, refresh and public information.

## Names and entry points

An **Event** is the dated `events` row. Its optional `con_preps` row is the **Deployment Ops** workspace. The same event appears publicly as a **Tactical Deployment Plan** before completion and a **Case Study in Chaos** afterward; public presentation does not move or duplicate the event row.

| Route | Current behavior | Source |
| --- | --- | --- |
| `/dashboard/events` | Unified Upcoming/Past/All event browser, text search, structured tag filtering and Add Event choice. | [`UnifiedEventsPage`](../../src/components/alpha92/UnifiedEventsPage.tsx) |
| `/dashboard/events/[id]` | Lifecycle-aware event workspace; upcoming links to Ops, past shows case-study editing, media, retained schedule and paid costs. | [`EventLifecycleWorkspace`](../../src/components/alpha92/EventLifecycleWorkspace.tsx) |
| `/dashboard/con-prep?prep=<id>` | Current operational workspace selected by deployment ID. `?add=1` requests the add-deployment sheet. | [`Alpha8ConventionWorkspace`](../../src/components/alpha8/Alpha8ConventionWorkspace.tsx) |
| `/dashboard/case-studies` | Older separate retrospective manager remains in dashboard navigation. | [`page.tsx`](../../src/app/dashboard/case-studies/page.tsx) |
| `/deployments/future` | Public Tactical Deployment Plans, ascending start date. | [`future/page.tsx`](../../src/app/deployments/future/page.tsx) |
| `/deployments/past` | Public Case Studies in Chaos archive, descending start date. | [`past/page.tsx`](../../src/app/deployments/past/page.tsx) |
| `/deployments/[slug]` | Public event plan or retrospective with media/social receipts. | [`page.tsx`](../../src/app/deployments/[slug]/page.tsx) |
| `/deployments`, `/chaos`, `/chaos/[slug]` | Redirects respectively to future archive, past archive, and canonical deployment detail. | [`deployments/page.tsx`](../../src/app/deployments/page.tsx), [`chaos`](../../src/app/chaos) |

The [`con-prep/layout.tsx`](../../src/app/dashboard/con-prep/layout.tsx) renders `Alpha8ConventionWorkspace` and discards its children. Older `ConOpsManager` and `ConventionDeployment` page components are still checked in; their rendered layouts do not establish the active UI. The nested legacy `/dashboard/con-prep/deployments` page declares an Events redirect, subject to that parent layout.

## Creation and opening

1. **Upcoming:** the Events Add choice navigates to `/dashboard/con-prep?add=1`. [`Alpha8AddDeploymentSheet`](../../src/components/alpha8/Alpha8AddDeploymentSheet.tsx) creates a workspace through [`POST /api/alpha8/deployments`](../../src/app/api/alpha8/deployments/route.ts).
2. That API inserts an owned event with generated title/year/random slug and UTC-derived quarter, then an owned planning workspace. Failure to insert the workspace attempts to delete the new event. This is sequential application compensation, not a SQL transaction.
3. **Past:** [`PastEventSheet`](../../src/components/alpha92/PastEventSheet.tsx) posts `mode: "past"` to [`/api/alpha92/events`](../../src/app/api/alpha92/events/route.ts). The API rejects dates not yet past, inserts an owned published event with `route_visible: false`, then ensures a draft case study. It creates no Ops workspace.
4. Opening an upcoming event uses its existing prep, or [`POST /api/alpha92/events/[id]/ops`](../../src/app/api/alpha92/events/[id]/ops/route.ts) to ensure one. The API rejects past events and `ensureConPrep()` creates only the workspace, without packing/tasks/template seeding.
5. Past cards open the event workspace directly; a missing retrospective can be created with its **Create Case Study** control.

Convention creation requires a verified directory edition; both upcoming and past forms offer manual non-con events. The older `deployCatalogConvention()` requires a verified mapped edition before initializing its legacy defaults. `deployManualConvention()` now rejects the obsolete bypass. Existing event IDs/plans are retained by the v31.2 backfill.

## Current event API

| Endpoint | Behavior |
| --- | --- |
| [`GET /api/alpha92/events`](../../src/app/api/alpha92/events/route.ts) | Loads owned or ownerless events, adds workspace/case-study/media count, classifies by date, then applies `scope`, case-insensitive `tag`, and `q`. |
| [`GET /api/alpha92/events/[id]`](../../src/app/api/alpha92/events/[id]/route.ts) | Requires accessible event; returns event, lifecycle, prep, case study, `event_media`, sub-events and event-linked costs. |
| [`POST/PATCH .../[id]/case-study`](../../src/app/api/alpha92/events/[id]/case-study/route.ts) | Ensures the retrospective or updates title/status/challenge/solution/outcome/published. Publishing sets `published_at`; unpublishing clears it. |
| [`POST/PATCH/DELETE .../[id]/media`](../../src/app/api/alpha92/events/[id]/media/route.ts) | Attaches an existing reusable asset, changes caption/order/featured state, or removes an attachment; recalculates case-study hero URL. |
| [`PATCH /api/alpha8/con-preps/[id]/records`](../../src/app/api/alpha8/con-preps/[id]/records/route.ts) | Edits allowlisted workspace/event fields using `resource: "event"` or `"prep"`. |
| [`/api/admin/events`](../../src/app/api/admin/events/route.ts) | Older general event CRUD still exists, with camelCase request fields and separate dashboard-role authorization. |

`requireOwnedEvent()` allows current-user or ownerless events. Alpha APIs use [`requireAlpha7Admin()`](../../src/lib/alpha7/auth.ts) and a server-role client; route ownership checks, not browser RLS writes, enforce these operations. See [security](../security.md).

## Two different lifecycle calculations

### Event/browser lifecycle

[`eventIsPast()`](../../src/lib/alpha92/event-lifecycle.ts) and [`getDeploymentArchive()`](../../src/lib/deployment-archive.ts) classify an event as past when `end_at || start_at` is a finite timestamp before now. This is computed when a request is made; it is not a stored event status or a row-moving job. An event already underway remains upcoming until its end timestamp; without an end it becomes past after its start.

[`getIncidentReport()`](../../src/lib/incident-report.ts) uses the same fallback boundary with `<= now` and returns public `deployment`/`case_study` mode. That mode does not guarantee a published retrospective row exists.

### Stored deployment lifecycle

When [v31 SQL](../../supabase/ALPHA_V31_DEPLOYMENT_AUTOMATION_RUN_THIS.sql) is installed, `dusk_alpha31_expected_status()` selects:

| Priority | Condition | Stored status |
| --- | --- | --- |
| 1 | Non-null event end has been reached | `complete` |
| 2 | Non-null workspace `departure_at` has been reached | `traveling` |
| 3 | Any packing row is marked packed | `packing` |
| 4 | Otherwise | `planning` |

This replaces the old `ready` state and migrates existing `ready` rows to planning before backfill. Completion is time-based rather than gated by a readiness percentage. The database has **no start-date fallback** for completion, so an end-less event can be Past in the UI while its prep is still planning/traveling.

`dusk_alpha31_recalculate_deployment()` stores component scores, total, status and calculation time; on complete it ensures a draft retrospective. Packing/task/cost child triggers recalculate after changes; a changed prep departure triggers recalculation. Passage of time needs the lifecycle sweep; event end edits have no dedicated lifecycle trigger in this SQL.

The service-role [`automation/tick`](../../src/app/api/integrations/automation/tick/route.ts) calls the sweep. [v31.1 SQL](../../supabase/ALPHA_V31_1_SECURITY_HOTFIX_RUN_THIS.sql) restricts helper execution; the [separate post-deploy cron](../../supabase/ALPHA_V31_ENABLE_SUPABASE_CRON_AFTER_DEPLOY.sql) schedules the production HTTP tick. These files are separate prerequisites, not installed by opening Events.

## Readiness shown on event cards

The modern Events list and Ops workspace display stored `con_preps.readiness_score`. Under v31 SQL, the rounded total is `55% tasks + 35% budget + 10% packing`:

- Tasks count leaf rows with `counts_toward_readiness = true`; `done` and `skipped` are complete.
- Packing counts required leaf rows; packed rows are complete.
- Budget counts ledger **rows**, not dollars, in `budgeted` or `paid` state.
- An empty component scores zero. Travel/hotel/registration do not directly contribute to this database formula.

Legacy [`computeReadiness()`/`syncReadiness()`](../../src/lib/con-ops.ts) calculate a different score and still write it through the older prep detail API. Ops summary counts also include more rows than readiness eligibility. UI totals and persisted component scores therefore need not match. [Deployment operations](deployment-ops.md) covers the operational controls; [readiness and lifecycle](readiness-lifecycle.md) details the database rules.

## Retrospectives and reusable media

[`ensureCaseStudy()`](../../src/lib/alpha92/event-lifecycle.ts) creates an unpublished `Draft` with blank narrative/hero and a generated slug if none exists for the event. The UI editor saves the three narrative fields independently of the event's public publication flag. A draft can exist for an upcoming event through APIs even though the UI emphasizes retrospective editing for past events.

The Alpha 9.2 migration creates `event_media`, backfills legacy `media.event_id` relationships, and fills missing retrospective hero images. Attachment endpoints enforce an accessible event and check asset ownership on attach. A featured asset is preferred for the hero, followed by display order and creation time; the hero selection chooses an image, so a featured video can leave another image as hero. A single featured attachment is enforced by sequential application updates, not a unique database constraint. Removing a join preserves the reusable media asset; see [media library](media-library.md).

`getIncidentReport()` uses modern attached public assets when any are present, otherwise published legacy media; it does not merge both lists. It includes event-related published social posts with platform URLs and latest metrics. The public page computes reach/engagement totals in TypeScript; these are not database aggregate functions.

## Public data and known limits

- [`repository.ts`](../../src/lib/repository.ts) reads published events/case studies using the public Supabase client, and uses seed events/case studies only when public configuration is absent. Configured empty/error queries return empty results; they do not resurrect sample deployments.
- Public event mapping retains only the legacy `tag`, event type and quarter; archive filters use those values. Dashboard filtering uses the richer `events.tags[]`. [`dusk_sync_event_tags()`](../../supabase/V26_ALPHA91_MEDIA_TAGS_FIX_RUN_THIS.sql) cleans/sorts structured tags and synchronizes the legacy primary tag.
- Archive media counts remain based on `media.event_id`; convention covers use the new public featured-media view and directory image fallback. Detail galleries prefer `event_media`. Modern-only attachments may appear in detail while an archive card reports no media.
- Past public events appear in the archive even before a retrospective is published; detail then shows the pending-analysis state. `incidentFiled` indicates a returned case study, not deployment DB status.
- Event list detail/creation/case-study operations use multiple separate queries and writes. They are not atomic; partial creation, concurrent ensure calls and inconsistent reads are possible.
- Alpha 9.2 creates a partial case-study event uniqueness index; v31 SQL's conflict target lacks its predicate. See [data model](../data-model.md) for the conditional migration incompatibility and unverified hosted state.
- Existing general event/case-study routes and catalog helpers have older authorization, field and initialization semantics. Changes to dates through workspace editing do not update the stored quarter like legacy event CRUD does.

Alpha v31.2 implements the directory and controlled source worker; arbitrary attendance import and unstructured web scraping remain outside this release. See [Convention Directory](convention-directory.md).
