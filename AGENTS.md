# Repository map and working rules

Start with [docs/README.md](docs/README.md), then read the relevant feature page and cited code/SQL. Specifications marked **PLANNED** are requirements, not shipped features.

## Map

- `src/app/`: Next.js pages, layouts, authentication and API routes.
- `src/components/`: public/dashboard UI and workspaces.
- `src/lib/`: domain operations, Supabase, AI, scheduling and providers.
- `src/data/`: public fallback data and the bundled convention snapshot.
- `supabase/`: schema and upgrade SQL; see [data model](docs/data-model.md) and [setup](docs/setup.md).
- `scripts/`: release checks and historical patches; see [releases](docs/releases.md).

## Durable rules

- Use the existing isolated cloud checkout; create worktrees only when requested. Preserve unrelated user changes.
- Trace active routes, layouts, helpers and SQL together. Historical docs, suffixed copies, retained components and installed dependencies do not establish active or deployed behavior.
- Preserve Deployment as the universal object. Keep official facts separate from personal planning; public pages/assets must exclude reservations, confirmation numbers, private travel, budgets, packing and internal tasks.
- Authorize server operations and check ownership before service-role access. Service-role clients bypass RLS; owner columns alone do not provide isolation.
- Apply AI changes through validated typed proposals and explicit approval. Never expose arbitrary database writes or silently authorize external publishing.
- Keep privileged credentials server-side. Never commit or print secret values or populated environment files; document names/placeholders only.
- Use `npm ci`; avoid incidental dependency/version changes. Add reviewed migrations with prerequisites; do not assume the base schema includes all upgrades or rewrite applied migrations as cleanup.
- Update relevant docs with behavior changes; distinguish current implementation, limitations and plans. Run scoped checks and report failures/unavailable integrations accurately; [setup](docs/setup.md) documents validation caveats.
