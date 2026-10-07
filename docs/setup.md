# Development and deployment

**Status: CURRENT — Alpha v31.2.** The repository contains a Next application and Supabase upgrade SQL, not a complete infrastructure provisioning tool.

## Local development

Use Node 24 and npm (tested with Node 24.19.0). Directory transport uses native proxy-aware HTTPS agents, and behavior checks use Node TypeScript/module hooks. From the existing checkout:

```sh
npm ci
npm run typecheck -- --incremental false
node scripts/verify-alpha-v31-1.mjs
npm run dev
```

`npm ci` uses the committed lockfile despite the manifest's `latest` ranges. The public website has seeded fallbacks and can render without Supabase. Dashboard authentication/writes, AI and external providers require their own configuration.

The repository tracks `next-env.d.ts`, `tsconfig.json` and `tsconfig.tsbuildinfo`. Next 16 regenerates the first two during build/development, and incremental TypeScript checking can rewrite the third. Avoid committing incidental generated changes. The supplied Codex cloud environment's saved install/start instructions use a generated runtime mirror outside the checkout and synchronize edits from the original. That helper is environment configuration, not a repository script or a second Git checkout; use the saved environment instructions where available. Do not create a worktree just for setup.

For production verification, `npm run build` creates an optimized build and `npm run start` serves it. Use a generated runtime copy if tracked generated files must stay untouched. There is no CI workflow. The Alpha v31.2 verifier includes executable worker/model checks and optional isolated PostgreSQL integration tests; historical verifiers remain structural checks. `npm run lint` currently fails because it invokes `next lint`, removed by Next 16.

## Configuration

Use ignored `.env.local` for local development or secure environment/hosting settings for deployed code. Keep values out of Git and logs. See [security](security.md) for privileged keys and token encryption.

| Capability | Variables read by current code |
| --- | --- |
| Supabase core | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`), `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) |
| Approved operators | `DUSK_ADMIN_EMAILS`; the central dashboard helper supports the older singular alias, but Alpha7/Next Stop helpers do not |
| Site URLs / local time | `NEXT_PUBLIC_SITE_URL`, `DUSK_HOME_TIMEZONE`; several paths default to the production site and `America/New_York` |
| Chaos / Next Stop / event discovery | `OPENAI_API_KEY`; model and image overrides are detailed in [Chaos](features/chaos-copilot.md) and [Next Stop](features/next-stop.md); discovery reads `OPENAI_DEPLOYMENT_DISCOVERY_MODEL` |
| Make / unified tick | `MAKE_WEBHOOK_SECRET`; optional `AUTOMATION_TICK_SECRET` for inbound tick; child calls use `MAKE_WEBHOOK_SECRET` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; optional username/thread settings |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET`, `SOCIAL_TOKEN_ENCRYPTION_KEY`; optional text/media limits |
| Instagram | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `SOCIAL_TOKEN_ENCRYPTION_KEY`; optional `INSTAGRAM_GRAPH_VERSION` |
| Bluesky | `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`; optional `BLUESKY_PDS_URL` |
| Email / push | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`; `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

The central Supabase helper also supports `SUPABASE_URL`; newer Alpha7 and Next Stop helpers require the public URL name. Setting only the legacy alias is not sufficient across all routes. X/Instagram additionally require completing provider OAuth connection flows; environment variable presence alone is not a connected account. Use a Bluesky app password, not the account's primary password.

Required network destinations depend on enabled capabilities: the project's Supabase hostname, OpenAI API, selected social APIs, Resend and push destinations. Preserve existing network policy and add only destinations the selected workflow needs. Package installation requires the registries represented in the lockfile. The repository does not configure a VPN or cloud network policy itself.

## Supabase setup and upgrades

Determine the actual existing schema before executing SQL. File names and comments are evidence of intended prerequisites, not a deployed migration ledger. Back up an existing database and validate the chosen upgrades in a development project first.

| SQL group | Role |
| --- | --- |
| [schema.sql](../supabase/schema.sql), dated [migrations](../supabase/migrations/) | Base tables and accumulated early operations upgrades; not a complete v31.1 schema |
| [V26_ALPHA_RUN_THIS_WHOLE_FILE.sql](../supabase/V26_ALPHA_RUN_THIS_WHOLE_FILE.sql) and later dated Alpha upgrades | Convention/Copilot and early feature prerequisites; inspect overlap with the actual base |
| Alpha7 complete → Alpha7.1 brand assets → Alpha7.2 background reuse | Generator, attachment, brand and background-history foundations |
| Alpha8.1 → Alpha9 → Alpha9.1 → Alpha9.2 SQL | Direct editing, timeline, tags/media library and unified event attachments; no standalone Alpha8 SQL file is checked in |
| [Alpha v30 AI rendering](../supabase/ALPHA_V30_NEXT_STOP_AI_RENDER_RUN_THIS.sql) | Current generator assets/configuration |
| [Alpha v31 automation](../supabase/ALPHA_V31_DEPLOYMENT_AUTOMATION_RUN_THIS.sql) | Readiness helpers, triggers, lifecycle sweep and draft Case Studies |
| [Alpha v31.1 security hotfix](../supabase/ALPHA_V31_1_SECURITY_HOTFIX_RUN_THIS.sql) | Function search paths and execution permissions; requires v31 |

This is a dependency inventory, **not a blindly executable fresh-install recipe**. Earlier root guides call `schema.sql` cumulative, but later tables/functions exist only in separate upgrades, and some early appended content is not executable SQL as written. The provided Alpha9.2 partial Case Study uniqueness index also does not satisfy v31's unqualified `ON CONFLICT (event_id)` on its own. A database with an additional full unique index may differ. There is no verified one-command Alpha v31.1 database installer in this checkout. Review [data model / migration caveats](data-model.md) before establishing a new schema.

Seed files contain application/demo data and a specific event plan; they are not mandatory migration prerequisites or safe generic production updates. Never rerun them against user planning data without deliberate review.

Configure Supabase Auth for the actual deployment origin and the implemented `/auth/callback`, `/auth/confirm` and recovery/reset routes. The supplied [email templates](../supabase/email-templates/) and [auth-template guide](../AUTH_EMAIL_TEMPLATES.md) describe the branded links. Approve operators through configured admin emails or profile roles, accounting for the authorization differences documented in [security](security.md).

## Hosted deployment and automation activation

The existing setup guides target Vercel, and the app uses its standard `next build` / `next start` commands; no repository-owned Vercel or container deployment configuration is present. Supply server-only secrets and intentionally public variables before building; Next public environment values are baked into browser code. Confirm applicable schema upgrades and storage buckets/policies separately from application deployment.

After the compatible v31 application is deployed, the optional [Cron activation script](../supabase/ALPHA_V31_ENABLE_SUPABASE_CRON_AFTER_DEPLOY.sql) schedules the unified HTTP tick every five minutes using `pg_cron`, `pg_net` and Vault. Its secret must match the application's Make secret under the current implementation. Existing Vault records are not updated by rerunning the script. Inspect/rotate them securely, and choose the scheduler deliberately instead of leaving duplicate Make dispatch schedules active. See [social automation](features/social-automation.md); committing this SQL does not activate a job.

## Useful validation

1. Run typechecking and the current structural release check; build in the documented working directory.
2. Start the app and request representative pages such as `/`, `/login`, `/deployments/future` and `/deployments/past`. With no Supabase keys, verify the expected setup login redirect and seed-backed public behavior.
3. Request `/api/health`. Its `supabaseConfigured` field checks URL/key presence only. Public repository fallbacks can hide missing tables, errors and empty results; neither check proves live database readiness.
4. With configured development credentials, perform read-only public and server queries against the expected schema and verify authorization. Validate trigger/lifecycle behavior against an isolated database before claiming it works.
5. Enable and test AI, publishing and notification integrations only when those effects are authorized. A provider test or automation tick can send messages/publish due work. Do not use production dispatch as a generic smoke test.

Documentation-only changes need link/source consistency and whitespace checks, not an application rebuild. Keep successful checks, known repository defects and untested hosted configuration distinct.

## Upgrade an existing Alpha v31.1 deployment to v31.2

Follow [Alpha v31.2 release notes](releases/alpha-v31.2.md). Run `ALPHA_V31_2_CONVENTION_DIRECTORY_RUN_THIS.sql` once after existing v31/v31.1 prerequisites, then deploy this application. Temporarily pause convention creation across the schema/application change. The backfill preserves events/plans, but imported catalog entries require official review before they can be selected for new conventions. Set `CONVENTION_DIRECTORY_AUTOMATION=true` only after sources are reviewed. Existing five-minute Supabase Cron can continue unchanged; no new Make job is needed. Optional development source checks require each configured official/secondary hostname in the cloud network allowlist; Supabase-only network access does not permit convention websites.

```sh
node scripts/verify-alpha-v31-2.mjs --database
npm run typecheck -- --incremental false
npm run build
```

The database test uses an isolated Docker Postgres 17 container with no network/ports and removes it afterward. Never run files under `scripts/fixtures/` against production.
