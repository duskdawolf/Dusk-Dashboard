# Convention Directory — Alpha v31.2

**CURRENT implementation; requires migration and source configuration.** The directory owns official convention facts. `events` remains the universal deployment object; personal plans remain in the existing planning tables. Neither a directory refresh nor candidate approval writes planning records.

## Identity, verification and ownership

[Migration](../../supabase/ALPHA_V31_2_CONVENTION_DIRECTORY_RUN_THIS.sql) introduces:

| Table | Responsibility |
| --- | --- |
| `convention_series` | Long-lived identity, primary official website, Media Library logo, source configuration and refresh/discovery clocks |
| `convention_series_official_sources` | Administrator-approved additional websites or specific official social accounts |
| `convention_editions` | Stable occurrence key within a Series, year, dates/precision/timezone, status, venue/address/location, theme, website/social, registration, schedule, policies and imagery |
| `convention_edition_hotels` | Multiple official hotels per edition; main/overflow/secondary/staff/other, booking windows/links, published block information, source and verification |
| `convention_edition_sources` | Field/source identity, official vs legacy authority, confidence and individual verification timestamps |
| `convention_edition_aliases` | Reviewed source occurrence keys mapped to existing editions without duplicating deployments |
| `convention_directory_candidates` | Unapplied discovery/conflict proposals, evidence source, authority and review state; never selectable/public |
| `convention_directory_runs` | Refresh/review/failure history and before/after fact snapshots |
| `convention_legacy_links` | Exact legacy deployment-to-import links allowed to remain editable pending review |

Core relationships are foreign keys, with uniqueness/indexes for series/occurrence, hotel identity, source identity, pending review and refresh queues. JSON is limited to candidate proposals and audit snapshots. An edition is not identified solely by name or year; distinct occurrences can share a year. Retain its key during postponements/corrections. Cancelled editions retain history and are unavailable in Add Deployment.

`verification_status=official` is the **Verified** state. Only approved official website/account evidence can establish it. Secondary feeds and the old WikiFur catalog cannot promote records. Confidence is explicit on evidence; the application does not assign an invented numeric certainty score. Dates can remain unknown, but a verified edition needs a start date before selection creates a deployment.

RLS denies direct browser reads/writes of internal directory tables. Authenticated dashboard operators search the directory; only central-role administrators can curate it. Service-role operations must go through those gates. The public view exposes verified facts through a deliberate column projection.

## Deployment flows

Add Deployment offers **Convention** or **Other Event** (including Meetup/Hosting). Convention search uses verified directory editions only. The server resolves the selected ID and initializes the event's title/date/location/theme from that edition. Other events remain manual. Past-event entry supports the same distinction. Editing a deployment can preserve or replace its directory reference; changing a non-con event to convention requires a verified reference.

The event database trigger rejects a new/relinked convention without a verified edition; non-con events cannot retain an edition reference. Grandfathered imports are scoped to the exact original event/link and cannot be reused to create new conventions. This protects old plans during review, without a global `NOT NULL` change that strands unresolved legacy records.

Deployment Ops displays read-only **Convention Information** and an on-demand check button. Official hotels here are distinct from personal `hotel_stays`. Directory edits can change the official dates while personal attendance dates stay unchanged. Material-change notifications ask the operator to review their plans.

Older catalog deployment requires an already verified mapped edition. The old manual-convention function/API rejects creation with directions to Add Deployment. Older general event/Make APIs accept camelCase `conventionEditionId`. Make preserves an existing reference when omitted on an existing event; new conventions require one. The old AI discovery endpoint remains research-only and does not establish verified directory identity.

## Administration and legacy review

Open `/dashboard/convention-directory` as an administrator:

1. Select/create a Series, confirm its official website, and optionally approve additional official evidence sources. Social approval is scoped to the account path, not the whole social platform.
2. Select an imported edition or create the missing occurrence **here**, outside Deployment Ops. Review dates, venue, edition facts, sources and multiple hotels. Check the official-evidence confirmation to verify/save it.
3. Use the Media Library picker for Series logo, edition banner and logo. Only accessible, published image assets qualify. Source image URLs are an optional HTTPS fallback.
4. Review secondary candidates/conflicts. Either load their proposed facts and verify against official evidence, select the existing matching edition, or dismiss them. Saving a reviewed candidate records a source-key alias to prevent repeated duplicate discovery.
5. Match unresolved legacy deployments to verified editions. Relinking changes only `events.convention_edition_id`, preserving IDs, personal dates, notes, lodging, travel, costs, tasks, packing and media.
6. Explicitly enable **Show official hotel information publicly** only when desired; it is off by default.

The migration imports all flat catalog entries as `needs_review`, regardless of their old `verified_at`. It uses an existing prep/catalog link only for a matching occurrence year. A different year retains the known Series and creates a review edition from the existing deployment. Unlinked ambiguous events get isolated review identities rather than a guessed merge. Existing catalog, event and planning rows remain. No live migration is performed by checking out/building this code.

Read-only inspection during implementation found 7 events, 3 convention events (all catalog-linked), and 126 catalog rows all marked `wikifur`. Their sources therefore require official verification; these counts are observations, not a permanent schema assumption.

## Automatic refresh and discovery

The [worker](../../src/lib/convention-directory/server.ts) runs from the existing five-minute [automation tick](../../src/app/api/integrations/automation/tick/route.ts) when `CONVENTION_DIRECTORY_AUTOMATION=true`. Enable each Series source separately after reviewing its authority.

- Known upcoming editions: every **12 hours** after a successful source check.
- Broader discovery: an independent **7-day** clock checks configured official sources and an optional secondary discovery feed. New official occurrences can be verified automatically; secondary proposals and identity conflicts require review.
- On demand: Add Deployment and Convention Information check the selected Series source, including discovery, with a ten-minute cooldown. Searching a missing edition also offers enabled matching Series checks. Sources not yet configured/enabled explain that no refresh ran.
- Each tick processes at most two Series. A database lease prevents concurrent claims for five minutes. Requests are bounded to 2 MB, 15 seconds per fetch and three same-host HTTPS redirects. Feed batches contain at most 100 editions.
- Failures retain last successful facts/timestamps, record an error/review notification, and retry after 1 hour, then 2 hours, then at most daily. Explicit on-demand attempts still respect the ten-minute claim cooldown. A later success resets the failure count.

Supported source formats are official HTML `application/ld+json` with `Event`/`Festival` metadata (including graph/list wrappers), or a `directory-json` feed. The latter is an object with `editions`, validated by [EditionSchema](../../src/lib/convention-directory/model.ts). Example:

```json
{"editions":[{"edition_key":"2027-main","name":"Example Con 2027","edition_year":2027,"start_at":"2027-06-04T09:00:00-04:00","end_at":"2027-06-06T18:00:00-04:00","date_precision":"exact","timezone":"America/New_York","website_url":"https://example-con.org/2027","hotels":[{"source_key":"main","name":"Official Main Hotel","role":"main","source_url":"https://example-con.org/2027/hotels"}],"sources":[{"field_name":"dates","url":"https://example-con.org/2027"}]}]}
```

Use stable occurrence-specific URLs/keys. JSON-LD without an identity, cross-source claims and ambiguous same-year matches require review. Unknown fields are not invented or copied from last year's edition. Partial metadata preserves other facts from the **same** edition; explicit null clears a corrected field. Omitted hotels retain the current set; an explicit array replaces it. Removed official hotels never touch personal reservations. Each edition/fact/source/hotel/audit update is transactional; a multi-edition source run can report failure after earlier editions succeeded.

The fetcher validates public HTTPS URLs and DNS, pins direct connections to checked IPv4 addresses, rejects internal addresses and cross-host redirects, and preserves configured proxy/TLS trust. Node 24 is the tested runtime. This does not crawl arbitrary text or invoke AI; unsupported sites need manual curation or an official structured feed. Arbitrary web-wide crawling, paid social APIs and site-specific scraping adapters are not implemented.

## Change history and Dashboard notifications

Each successful check records verification/history; failed attempts do not mark facts fresh. Individual sources retain their own timestamps. `facts_changed_at` changes only for actual edition/hotel changes. Material date/status/venue/location/registration/schedule/policy/hotel changes notify admin profiles, the configured Series maintainer and linked deployment owners. New candidates and failures notify administrators. Notifications are in-app only; this worker creates no email, Telegram or push delivery jobs. No-op/minor refreshes do not emit material-change notices, and identical review exceptions are deduplicated.

## Public/privacy and imagery

`public_convention_editions` defaults to edition identity/branding, dates, venue/city, theme, official website, registration, schedule, policies/social links and verified evidence. **Official hotels are opt-in per edition**; their field-source links are also omitted by default. Authenticated Ops can read all official hotels regardless of that public option. No projection joins reservations, confirmations, private travel, budgets, packing or internal tasks.

`public_deployment_featured_media` checks both event publication and asset publication/image kind. [Shared resolver](../../src/lib/convention-directory/model.ts) and [image component](../../src/components/convention-directory/DeploymentImage.tsx) apply:

1. User-selected published featured deployment image.
2. Published edition banner (Media Library first, then official source URL).
3. Published edition logo.
4. Published Series logo.
5. Generic deployment placeholder.

Broken images advance to the next candidate. Homepage cards, deployment archives/details and linked Case Study cards share this chain. Non-con archives preserve existing public Case Study/legacy-image behavior. Generated Next Stop posters retain their existing separate rendering workflow; directory refresh does not change their backgrounds, chosen media or personal inputs.

Public storage remains public by URL; database flags are not object revocation. Never upload private planning documents to the reusable public Media Library. See [security](../security.md).

## Verification

`node scripts/verify-alpha-v31-2.mjs --database` runs resolver/schema/worker behavior checks and an isolated PostgreSQL migration fixture (Docker required). SQL tests exercise reruns, backfill, invalid convention references, legacy edits, multiple hotels, personal-data preservation, opt-in public hotels, RLS/privilege boundaries, featured-media privacy, no-op notifications and refresh leases. Fixtures are deliberately minimal v31.1 table contracts; they are not a fresh Supabase installation recipe. See [release notes](../releases/alpha-v31.2.md) for deployment order and validation limits.
