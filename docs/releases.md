# Releases and versioning

**Status: CURRENT — Alpha v31.2.**

## Sources of version information

| Source | Meaning today |
| --- | --- |
| [src/lib/app-version.ts](../src/lib/app-version.ts) | Displayed release: `Alpha v31.2`; channel `Alpha`; numeric companion `31.2` |
| [Footer](../src/components/Footer.tsx) and [AppVersionFooter](../src/components/AppVersionFooter.tsx) | Import the displayed release constant |
| [package.json](../package.json) / lockfile root | Still `26.0.0-alpha.5`; legacy package metadata, not the current displayed product release |
| Git history | Release commits such as `Alpha v31: Deployment Automation` and `Alpha v31.1 Hotfix` |
| SQL filenames | Both dated migrations and descriptive `V26_ALPHA*` / `ALPHA_V*` upgrade scripts |

The repository has no automated release/version synchronization pipeline, changelog generator or CI workflow. Earlier `v26 Alpha 7/9.2` feature naming and current `Alpha v30/v31` display naming coexist. Do not rename functioning API prefixes or older SQL as an incidental version cleanup. The numeric companion is a JavaScript number, not a semantic-version parser.

## Current release checks

Run from the repository root:

```sh
node scripts/verify-alpha-v31-1.mjs
npm run typecheck -- --incremental false
```

[Alpha v31.2 release notes](releases/alpha-v31.2.md) record the schema/operational upgrade. Run `node scripts/verify-alpha-v31-2.mjs --database` for behavior and isolated SQL checks, and `npm run build` for the application build. Run all `verify-*.mjs` and both retained `next-stop-smoke-check*.mjs` scripts for historical feature coverage.

Historical version checks now require the relevant minimum version, while the v31.2 verifier checks the canonical exact version. Old assertions point to the current deployment routes, labels and `compose.tsx`; they no longer fail because of already-shipped v31.1 renames. Patch scripts remain historical mutating utilities, not verification commands. `npm run lint` still invokes removed `next lint`; it is not part of the release verifier suite.

## Preparing a future release

When a release is explicitly authorized, update the displayed version and relevant release checks together; reconcile package metadata deliberately if it is in scope. Keep current implementation docs accurate and leave proposed functionality marked **PLANNED** until the behavior and required migrations exist. The [Alpha v31.2 specification](product-specs/alpha-v31.2-convention-directory.md) maps requirements to the implementation; `app-version.ts` remains canonical.

Record schema prerequisites, deployment order, any data backfill and operational activation separately. A migration file being committed does not mean it ran. Cron activation belongs after a compatible application deployment, with secure secret setup. Validate changed UI/server flows and relevant SQL behavior using an appropriate development database; file-presence checks cannot verify database constraints, triggers or authorization.

Historical root release/setup documents and suffixed duplicate files are retained as context. Use [docs/README.md](README.md) as the current documentation entry point.
