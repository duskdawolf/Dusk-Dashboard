# Alpha v31.2 — Convention Directory

**Status: PLANNED — not implemented.** This document records product requirements for work after Alpha v31.1. Proposed entities and workflows below are conceptual; no new tables, endpoints, UI or refresh jobs are delivered by this documentation change.

## Purpose and current baseline

Make the official convention directory the authority for convention facts while retaining Deployment as the universal object for the user's attendance and planning. A deployment may represent a convention, meetup, hosted activity or another non-con event.

Today the repository has a flat `convention_catalog`, a bundled WikiFur snapshot and an AI-assisted event discovery endpoint. The active Add Deployment form accepts editable facts and sets `event_type: "convention"`; it does not require an official edition. Catalog sync reloads bundled data, and its `verified_at` timestamp does not establish a fresh official-source check. Personal lodging is stored in `hotel_stays`. There are no normalized Series/Edition records or official multi-hotel directory/refresh jobs. See [Events / Deployments](../features/events-deployments.md), [Deployment Ops](../features/deployment-ops.md) and [data model](../data-model.md).

## Product invariants

1. **Deployment is universal.** Do not replace it with a convention-only attendance object or remove flexible non-con events.
2. **Convention deployments require an official Convention Edition reference.** Enforce this on the server and in data integrity rules, including updates that change an event into a convention. Free-text convention names and AI suggestions are not a substitute for a valid directory reference.
3. **Deployment Ops cannot create Convention Editions.** Users select existing official editions. A missing edition can trigger directory discovery/review, but the Add Deployment form must not offer a manual edition-creation bypass.
4. **Directory facts and personal plans have separate ownership and write paths.** Refreshing or discovering official data must never overwrite personal planning.

## Conceptual data model

The names below are product concepts, not committed SQL names or a migration design.

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

The featured image remains a personal selection and survives directory updates. Only images eligible for the destination's visibility may be used; a private featured asset must not become public through a fallback resolver. Missing or unusable images proceed to the next eligible source. This directory fallback is planned and differs from today's public cover behavior.

## Public/private contract

Public Tactical Deployment Plans and Case Studies may expose a curated subset of official convention information, including public edition identity, dates, venue/location, links and selected published hotel facts. Visibility requires the deployment's public gate and an explicit public projection of directory data.

They must **never** expose personal reservations or confirmation numbers, private travel, budget, packing or internal tasks. This applies to API payloads, server-component serialization, metadata, public storage and generated images as well as visible HTML. Never publish a joined planning row or a full Deployment Ops summary. An official hotel's published address/booking link is directory information; a user's room booking and confirmation are personal data.

Existing public-storage and endpoint-filter gaps documented in [security](../security.md) are not solved by this specification. Implementation must enforce the new boundary at each read/render/generated-asset path it changes and must not claim privacy solely because a component omits a field.

## Migration and operational decisions still required

- Identify and map existing flat catalog rows and manually entered convention deployments to official Series/Edition records. Preserve IDs, links, history and personal plans; unresolved mappings need a review path before enforcing the new required reference on legacy records.
- Define controlled directory administration, candidate verification, source ingestion rules and correction/audit permissions outside Deployment Ops.
- Define identity/year handling, cancellation/postponement behavior and the policy for stale or incomplete official editions.
- Choose refresh cadence, discovery sources, on-demand latency/cost limits and scheduler placement. The existing tick/Cron code does not already implement these jobs.
- Design compatible additive schema/API changes and a reviewed backfill/enforcement sequence. No directory migration is specified as already executable here.

## Acceptance criteria for future implementation

- A non-con deployment can be created and edited manually without a directory link.
- A new or changed convention deployment is rejected unless it references a valid official Edition; Add Deployment has no manual Edition-creation path.
- Editions for the same Series retain separate dates, theme, venue, registration, policies and media; an edition supports multiple hotel roles.
- Convention Information is read-only and reflects verified directory updates; personal lodging remains editable and independent.
- Scheduled upcoming-edition refresh, periodic new-edition discovery and on-demand freshness checks work and report evidence/timestamps/failures accurately.
- Repeated refreshes/discovery do not create duplicates or overwrite any personal planning or featured-image selection.
- Image selection obeys the five-step fallback order and destination visibility.
- Public pages, APIs and generated assets expose only approved public facts and exclude every personal-data category above.
- Existing convention records have an explicit migration/review outcome, with personal planning preserved; these checks are verified before calling Alpha v31.2 implemented.
