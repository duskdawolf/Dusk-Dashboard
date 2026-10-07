# Releases and versioning

**Status: CURRENT — Alpha v31.1.**

## Sources of version information

| Source | Meaning today |
| --- | --- |
| [src/lib/app-version.ts](../src/lib/app-version.ts) | Displayed release: `Alpha v31.1`; channel `Alpha`; numeric companion `31.1` |
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

[verify-alpha-v31-1.mjs](../scripts/verify-alpha-v31-1.mjs) checks current files, the exact version string, deployment navigation/detail labels, removal of duplicate readiness UI and security-hotfix SQL text. It is a structural regression check, not an application test suite or proof that SQL was applied.

Older `verify-alpha-v30.mjs` / `verify-alpha-v31.mjs` assert previous version strings and can fail on the current release. [next-stop-smoke-check.mjs](../scripts/next-stop-smoke-check.mjs) expects `compose.ts`, while the retained implementation is `compose.tsx`. Patch scripts mutate source and are historical upgrade utilities; they are not normal validation commands. `npm run lint` currently calls the removed `next lint` command; see [setup](setup.md).

## Preparing a future release

When a release is explicitly authorized, update the displayed version and relevant release checks together; reconcile package metadata deliberately if it is in scope. Keep current implementation docs accurate and leave proposed functionality marked **PLANNED** until the behavior and required migrations exist. The [Alpha v31.2 specification](product-specs/alpha-v31.2-convention-directory.md) does not itself bump the application version.

Record schema prerequisites, deployment order, any data backfill and operational activation separately. A migration file being committed does not mean it ran. Cron activation belongs after a compatible application deployment, with secure secret setup. Validate changed UI/server flows and relevant SQL behavior using an appropriate development database; file-presence checks cannot verify database constraints, triggers or authorization.

Historical root release/setup documents and suffixed duplicate files are retained as context. Use [docs/README.md](README.md) as the current documentation entry point.
