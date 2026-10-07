# Alpha v31.2 — Convention Directory

**Status: IMPLEMENTED IN SOURCE — Alpha v31.2.** Hosted availability requires the migration, official-source review and operational setup in [release notes](../releases/alpha-v31.2.md). [Convention Directory](../features/convention-directory.md) documents actual tables, APIs, review workflows, supported ingestion formats and limitations. This remains the product contract; checked-in code is not proof that production SQL/Cron was activated.

## Purpose and baseline

Deployment (`events`) remains universal. Series/Edition directory records own official convention facts, while reservations and personal planning remain in the existing workspace tables. The former flat `convention_catalog` is preserved as legacy evidence and imported for review, never automatically relabeled official.

## Product invariants

1. **Deployment is universal.** Do not replace it with a convention-only attendance object or remove flexible non-con events.
2. **Convention deployments require an official Convention Edition reference.** Enforce this on the server and in data integrity rules, including updates that change an event into a convention. Free-text convention names and AI suggestions are not a substitute for a valid directory reference.
3. **Deployment Ops cannot create Convention Editions.** Users select existing official editions. A missing edition can trigger directory discovery/review, but the Add Deployment form must not offer a manual edition-creation bypass.
4. **Directory facts and personal plans have separate ownership and write paths.** Refreshing or discovering official data must never overwrite personal planning.

## Product data model

The concepts below are implemented by normalized tables documented in the [directory feature guide](../features/convention-directory.md).

| Concept | Responsibility and relationship |
| --- | --- |
| Convention Series | Long-lived identity across editions: stable identity/name, aliases, series links and fallback logo; one Series has many Editions |
| Convention Edition | A specific yearly occurrence belonging to a Series; most real facts live here, with its own stable identity and verification history |
| Official Edition Hotel | One of multiple hotels associated with an Edition, independent of any user's booking |
| Deployment | Existing universal operational object; a convention deployment references an Edition; a non-con deployment remains manual/flexible |
| Personal Lodging Reservation | User/deployment-owned booking; may optionally reference an official hotel, but is never an official directory fact |
| Source / verification record | Evidence and freshness for directory facts and refresh attempts |

### Edition-specific facts

Each Edition supports dates (including time precision/timezone where known), venue, location, theme, official website/social links, registration information and links, official schedule information/links, policies, logo/banner and other edition-specific facts. Do not silently carry last year's theme, dates, venue, hotel rates or policies into a newly discovered edition as verified facts. Unknown facts remain unknown, with evidence/status visible.

An Edition's identity is not derived solely from its display name or year. Corrections, postponements, cancellations and repeated occurrences need a deliberate identity policy; the storage design must allow them without conflating separate official editions.

### Multiple official hotels

An Edition can list zero, one or many official hotels. Supported roles include **main, overflow, secondary, staff and other**; roles describe each hotel's relationship to that edition rather than imposing one universal hotel record. Official entries can contain name/address/location, official booking links, published booking windows or block terms and other sourced hotel facts. Preserve source and verification information for each entry.

Official hotel data is separate from the user's reservation: chosen accommodation, booked dates, room details, personal price/payment, confirmation number and private notes belong to personal lodging. Users may stay somewhere outside the official list. Directory corrections or removal of an official hotel must not delete or rewrite a personal reservation.

## Add Deployment and workspace behavior

**Add Deployment offers Convention vs Other Event.**

- **Convention:** search only the official directory for an Edition; show Series identity, edition dates/location, source and verification freshness so users can distinguish years. Selection establishes the required reference. AI/web discovery can refresh the directory through its controlled workflow, but returned free-text facts cannot be saved directly as a convention deployment.
- **Other Event:** allow flexible manual event facts without a Convention Edition reference. Existing non-con workflows remain supported.
- If no matching edition is available, explain the missing official record and support a discovery/freshness request; do not invent dates or allow manual edition creation inside Deployment Ops.

Convention deployments display a **read-only Convention Information** section populated from the official directory: selected edition identity, official dates, venue/location, theme, links, registration/schedule/policies and official hotels where known. Users manage attendance and personal planning in separate editable sections. Corrections to official facts belong to a controlled directory-maintenance workflow outside Deployment Ops.

## Sources, verification and freshness

Track sources and last-verification timestamps for directory information, including field-level evidence where facts come from different pages. Distinguish last attempted refresh, last successful check and last verified fact change; a failed request must not make data look freshly verified. Prefer the convention's own website or official channels. Secondary sources may aid discovery, but must retain their identity and confidence rather than being relabeled official evidence.

Three refresh paths are required:

| Path | Required behavior |
| --- | --- |
| Known upcoming editions | Automatically refresh their changing official facts on a configured schedule |
| New editions | Periodically discover newly announced yearly editions and resolve them to the correct Series without duplicates |
| Add Deployment | Offer an on-demand freshness check for the searched/selected edition, reporting results or failures while retaining its valid directory identity |

Refresh/discovery must support idempotent updates, traceable source changes, bounded retries and failures that preserve last known verified information. Publication/verification criteria and refresh intervals remain implementation decisions. Unverified discovery candidates must not masquerade as selectable verified official editions.

**Automated refreshes must never write personal deployment-planning data.** This includes personal dates/attendance choices where distinct from official dates, reservations, confirmation numbers, travel, budgets, packing, tasks, internal notes and user-selected featured images. Store official facts once and resolve them by the Edition reference; do not implement freshness as a broad deployment upsert. Where an official change affects plans, surface it for the user to review instead of silently rewriting those plans.

## Images

Use this exact fallback order for convention deployment imagery:

1. User-added featured deployment image.
2. Edition banner.
3. Edition logo.
4. Series logo.
5. Generic placeholder.

The featured image remains a personal selection and survives directory updates. Only images eligible for the destination's visibility may be used; a private featured asset must not become public through a fallback resolver. Missing or unusable images proceed to the next eligible source. This shared fallback is implemented on public deployment/homepage/Case Study surfaces.

## Public/private contract

Public Tactical Deployment Plans and Case Studies may expose a curated subset of official convention information, including public edition identity, dates, venue/location, links and selected published hotel facts. Visibility requires the deployment's public gate and an explicit public projection of directory data.

They must **never** expose personal reservations or confirmation numbers, private travel, budget, packing or internal tasks. This applies to API payloads, server-component serialization, metadata, public storage and generated images as well as visible HTML. Never publish a joined planning row or a full Deployment Ops summary. An official hotel's published address/booking link is directory information; a user's room booking and confirmation are personal data.

The public Case Study attachment filter gap is fixed in v31.2; public-storage URL visibility remains documented in [security](../security.md). Implementation must enforce the new boundary at each read/render/generated-asset path it changes and must not claim privacy solely because a component omits a field.

## Agreed automation and public defaults

- Refresh known upcoming verified editions twice daily; perform broader configured-source discovery weekly; allow on-demand checks from Add Deployment and Convention Information.
- Secondary evidence creates candidates only. Approved official websites or specific official social accounts can verify an edition. Identity conflicts require review and never overwrite a verified occurrence silently.
- Retain source identity, confidence/verification, refresh attempts and before/after change history. Material date/venue/status/registration/schedule/policy/hotel changes and review-required exceptions create deduplicated Dashboard notifications; no-op/minor checks do not spam.
- Public defaults include edition name/branding, dates, city/venue, theme, official website, registration information/link and official schedule link. **Official hotels require explicit public opt-in.** Personal planning is never part of the projection.
- Backfill preserves existing event IDs and all personal planning. Exact legacy exceptions keep unresolved records editable; new/relinked conventions require verified editions. Review, source approval, candidate resolution and mapping are available outside Deployment Ops without raw SQL.

## Implementation and acceptance mapping

| Contract | Implementation / verification |
| --- | --- |
| Universal deployments and directory-only convention creation | Add/Past/Edit flows; server resolver and database guard; creation and SQL tests |
| Series, occurrence facts, multiple hotels, source/media reuse | Normalized migration and internal directory manager; migration and hotel tests |
| Provenance, review and conservative identity handling | Approved sources, candidate queue, aliases, source timestamps and audit history; worker tests |
| Automatic and on-demand freshness without plan writes | Existing tick, leased worker, per-edition RPC; cadence/failure/SQL preservation tests |
| Meaningful change notifications | Material-field/hotel comparison and deduplicated Dashboard notices; no-op SQL tests |
| Public defaults, hotel opt-in and image fallback/privacy | Public views, shared resolver/image component, gallery parent/asset gates; SQL/model checks |
| Legacy continuity and deployment setup | Additive backfill plus admin mapping; rerun/preservation tests and release notes |

Remaining operational/source-adapter limitations are explicitly recorded in [release notes](../releases/alpha-v31.2.md).

## Acceptance criteria

- A non-con deployment can be created and edited manually without a directory link.
- A new or changed convention deployment is rejected unless it references a valid official Edition; Add Deployment has no manual Edition-creation path.
- Editions for the same Series retain separate dates, theme, venue, registration, policies and media; an edition supports multiple hotel roles.
- Convention Information is read-only and reflects verified directory updates; personal lodging remains editable and independent.
- Scheduled upcoming-edition refresh, periodic new-edition discovery and on-demand freshness checks work and report evidence/timestamps/failures accurately.
- Repeated refreshes/discovery do not create duplicates or overwrite any personal planning or featured-image selection.
- Image selection obeys the five-step fallback order and destination visibility.
- Public pages, APIs and generated assets expose only approved public facts and exclude every personal-data category above.
- Existing convention records have an explicit migration/review outcome, with personal planning preserved; these checks are verified before calling Alpha v31.2 implemented.
