# Alpha v31.2 — Convention Directory

Implements official Series/Edition selection while preserving deployments as the universal event object. New conventions require verified editions; other events remain manual. Adds official multi-hotel information, candidate/mapping review, source verification/history, read-only Ops information, public information with opt-in hotels, shared image fallbacks and bounded directory automation. Canonical footer version is **Alpha v31.2**; legacy npm package metadata is unchanged.

## Upgrade order

For an **existing Alpha v31.1 database**, run exactly:

1. `supabase/ALPHA_V31_2_CONVENTION_DIRECTORY_RUN_THIS.sql` in Supabase SQL Editor as the database administrator.
2. Deploy this branch's application after the migration succeeds. Pause convention creation while the old app and new constraint briefly overlap.
3. Review imported directory records and existing deployment mappings in `/dashboard/convention-directory` before creating new convention deployments.
4. Configure reviewed official sources and enable per-Series automatic refresh. Set server environment `CONVENTION_DIRECTORY_AUTOMATION=true` to activate the scheduled worker.

If upgrading from an older schema, first establish the existing Alpha 9/9.1/9.2 and v30 prerequisites listed in [setup](../setup.md), then run `ALPHA_V31_DEPLOYMENT_AUTOMATION_RUN_THIS.sql`, then `ALPHA_V31_1_SECURITY_HOTFIX_RUN_THIS.sql`, then the new v31.2 migration. Do not rerun the entire historical stack blindly: [data model](../data-model.md) records historical SQL incompatibilities. The v31.2 migration tests use the documented prerequisite table contracts; they do not repair unrelated older installation defects.

The migration is transactional/rerunnable and preserves production events, planning and media. It creates normalized directory/review/evidence tables, `events.convention_edition_id`, integrity triggers, indexes, restricted RPCs and public views. **No production migration or data write was performed during implementation.**

## Configuration and Cron

- Keep existing Supabase URL/public key/server secret and `DUSK_ADMIN_EMAILS`/admin profile configuration. No new external API key is needed for the directory.
- Add `CONVENTION_DIRECTORY_AUTOMATION=true` server-side when ready. It defaults off; explicit authenticated on-demand checks use the per-Series source setting independently.
- Existing five-minute Supabase Cron continues to call `/api/integrations/automation/tick`; no new Cron schedule or Make polling is required. Upcoming official editions check every 12 hours, discovery every 7 days, enforced by database clocks/leases.
- If the tick Cron was never installed, run `supabase/ALPHA_V31_ENABLE_SUPABASE_CRON_AFTER_DEPLOY.sql` **after deploying**, using your deployment URL and a securely configured bearer secret. Existing Vault values are not replaced by rerunning that script.
- `AUTOMATION_TICK_SECRET` can differ from `MAKE_WEBHOOK_SECRET`; the tick now forwards the Make secret specifically to reminder/social child endpoints. Both child services still require the Make secret.
- Use Node 24. Allow configured source hosts in any deployment/cloud network policy. This cloud environment currently permits Supabase/package registries; arbitrary live convention-site fetches were not enabled or exercised.

## One-time review

All 126 observed catalog rows were WikiFur-derived; none are automatically treated as official evidence. Review/verify the needed editions, including dates and official hotel entries. Three observed convention deployments already have catalog links; matching-year links are retained and different-year occurrences stay separate within the known Series. Unresolved records remain editable with a review notice. Review does not require SQL or recreating deployments.

Choose trusted structured official sources (JSON-LD Event metadata or the documented directory JSON format). Approve additional official website/account evidence as needed. Secondary discovery can create candidates only. For identity conflicts, review the proposal against the existing edition and record its alias. Official hotel publication is off by default and requires an explicit administrator choice.

## Validation and security

Run from the repository root:

```sh
node scripts/verify-alpha-v31-2.mjs --database
npm run typecheck -- --incremental false
npm run build
```

Also run every retained `verify-*.mjs` and both `next-stop-smoke-check*.mjs` scripts. Historical assertions now check current routes/labels and minimum release versions; the v31.2 verifier checks the exact version. New tests exercise creation rules, source parsing/authority, worker cadence/discovery/failures/aliases, image order, migration reruns, legacy preservation, SQL integrity, public hotel opt-in, private media exclusion, RLS/RPC grants, personal-data preservation and notification deduplication.

The public Case Study media endpoint now requires published parent events and published assets. Configured empty event/Case Study queries no longer fall back to sample records. No secret values or populated environment files are included. Public storage URL visibility remains an existing limitation; do not upload private planning documents there.

## Recorded validation for this implementation

- `npm run build`: passed, including Next.js TypeScript validation.
- `npm run typecheck -- --incremental false`: passed.
- All 16 verification/smoke scripts: passed.
- v31.2 verifier with `--database`: passed 18 top-level checks, including 15 worker/API behavior cases and isolated PostgreSQL assertions.
- The SQL migration applied twice successfully; tests cover matching-year and different-year backfill, legacy edits, verified-reference integrity, official hotels, unchanged personal planning, media/privacy gates, source aliases, candidate resolution, notification deduplication and leases.
- Production-server smoke requests: homepage and Future/Past pages returned 200; unauthenticated directory search/refresh returned 401, admin API returned 403, and the protected admin page redirected to login.
- All 339 documentation links resolved; `git diff --check` passed. Generated Next/TypeScript files were restored to avoid incidental changes.

Authenticated browser interaction with a migrated Supabase project and live external convention-source checks were not run. Production was queried read-only for schema/backfill assumptions; no migration, source promotion, deployment record change or external notification was sent.

## Deliberate limits

Official source setup and legacy verification are operational prerequisites. Arbitrary unstructured website crawling, paid social-platform ingestion and source-specific scraping adapters are not included; unsupported sources fail visibly and require curation. Unknown facts remain unknown. Refresh writes are atomic per edition, not across an entire multi-edition feed. End-to-end live Supabase migration/authenticated UI/provider execution still requires applying the migration in a target project. The existing legacy task-status allowlist mismatch, partial Case Study uniqueness issue and unrelated public-storage limitations remain documented rather than being silently folded into this release.
