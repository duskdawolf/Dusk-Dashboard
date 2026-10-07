# Public Tactical Deployment Plans and Case Studies

Status: **CURRENT IMPLEMENTATION**. Public archives and detail pages are read-only
views of published events and public evidence. Alpha v31.2 adds verified official
convention information and shared edition/series image fallbacks.

## Routes and lifecycle presentation

| Route | Current behavior |
| --- | --- |
| `/deployments` | Redirects to `/deployments/future` |
| `/deployments/future` | Tactical Deployment Plans, ascending start time |
| `/deployments/past` | Case Studies in Chaos, descending start time |
| `/deployments/{eventSlug}` | One public event's plan or historical Case Study |
| `/chaos` | Legacy redirect to `/deployments/past`, preserving the tag filter |
| `/chaos/{slug}` | Legacy redirect to `/deployments/{slug}` |

[Archive loader](../../src/lib/deployment-archive.ts) divides future/past using
`event.endAt ?? event.startAt` against the current time; it does not consult the
private `con_preps.status`. In-progress events remain future until the end.
When no end exists, the start is the boundary. [Detail loader](../../src/lib/incident-report.ts)
uses the same boundary, with `<= now` for historical mode versus archive `< now`.
The switch is computed on read, independent of whether a database lifecycle
sweep has run or a Case Study has been written/published.

Archive `tag` filtering matches the displayed legacy tag, event type or quarter,
case-insensitively. Cards link with the **event slug**; a linked Case Study's own
slug may differ. [Archive card](../../src/components/DeploymentArchiveCard.tsx)
uses the shared featured → edition banner → edition logo → series logo → placeholder chain for conventions, including broken-image fallthrough. Non-con cards retain public Case Study/legacy image fallback. Counts still use legacy associations; detail galleries use modern attachments.

## Public data sources and fallbacks

[Repository layer](../../src/lib/repository.ts) creates a publishable-key Supabase
client without persisted auth. Events and Case Studies are filtered by their
own `published=true`; linked Case Studies additionally require a returned published event. Events use an explicit public field selection and directory/media views. Sample events/Case Studies are used only without public configuration; a configured empty/error query returns no records.

Case Studies match an event first by `event_id`, then by shared slug. A published
event can have no published Case Study. Historical pages still exist in that
case and show analysis pending. An unpublished linked Case Study is not required
for an event to enter the past archive; automatic draft creation is not public
publication. Empty configured Case Study queries remain empty.

After locating the public event, [incident-report](../../src/lib/incident-report.ts)
uses the server secret client, when configured, to load:

- `event_media` attachments in featured/sort order, excluding media explicitly
  marked unpublished; caption override wins over the reusable media caption.
- Published legacy `media.event_id` rows, used only when no published modern
  attachments remain. The two association systems are not merged.
- Parent `posts` with `status=published`, destination receipts and latest metrics.
  All destination rows on that parent are mapped, including staged destinations;
  the page uses master caption, not a destination's published-caption snapshot.

With no server Supabase secret configured, the detail still renders the public
event/Case Study but has empty media and social receipts. Child query errors are
not surfaced by this loader, so missing tables may also resemble absent evidence.

## What the pages display

[Detail page](../../src/app/deployments/[slug]/page.tsx) always displays title,
date range, location, description, tag/type/quarter and lifecycle language.
Future plans show a brief and Where to Find Dusk. Historical pages show published
Case Study challenge/solution/outcome, photographic/video evidence with captions,
and published social posts with links and reach/engagement summaries.

Where to Find Dusk is built server-side from [appearance projection](../../src/lib/alpha31/where-to-find-dusk.ts):
non-`not_going` sub-events with `show_in_find_dusk`, their room/location,
time/suiting/role, and manual `events.find_me_notes`. Manual notes are always
included in public lines; use them only for intentional public appearance copy.
Unflagged internal schedule rows are not shown. The page catches projection
errors and displays unavailable appearance details.

## Publication and privacy boundary

Public page rendering does not load `hotel_stays`, `travel_segments`, costs,
packing lists or prep tasks. Personal reservation details, confirmation numbers,
private travel, budget, packing and internal tasks must remain outside public
page projections and content. Operator-written event descriptions, appearance
notes, Case Study text, captions and social master captions are public content
when their containing records are published.

This is a rendering boundary, not a claim that published database rows expose
only mapped columns: base public RLS still permits row reads, though the repository now selects explicit event fields.
Do not add private planning columns to a publicly readable event row without
reviewing database permissions and projections. Secret-client child readers
bypass RLS, so their explicit parent gate and field/filter choices matter.

Current limitations requiring care:

- [Public Case Study media endpoint](../../src/app/api/case-studies/[slug]/media/route.ts)
  requires a published Case Study, a published parent event and published attached media.
- `public-media` object URLs are public regardless of database publish flags.
  Hero sync also selects images without a published filter; see [Media Library](media-library.md).
- Social posts appear once their parent is published; staged platform entries
  can still be listed. Metrics are latest stored snapshots, not live analytics.
- Legacy social-link labels use event start time and may say Incident Report
  while an in-progress deployment page remains a Tactical Deployment Plan.

Case Study linkage starts in [incident-report migration](../../supabase/migrations/20260927_event_incident_reports.sql);
[Alpha 9.2 migration](../../supabase/V26_ALPHA92_UNIFIED_EVENT_LIFECYCLE_RUN_THIS.sql)
adds one Case Study per event and reusable media joins. [Case Study editor API](../../src/app/api/alpha92/events/[id]/case-study/route.ts)
requires event ownership, creates drafts, and edits public text/publish state.
The [v31 lifecycle SQL](../../supabase/ALPHA_V31_DEPLOYMENT_AUTOMATION_RUN_THIS.sql)
can ensure a completion draft but does not automatically publish it.

The official-directory section displays verified name/branding, dates, venue/city, theme, official website, registration and schedule by default. Official hotel information is opt-in per edition. No personal reservation/planning table enters the projection. See [Convention Directory](convention-directory.md).
