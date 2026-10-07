# Readiness and deployment lifecycle

This records Alpha v31.1 source behavior before Alpha v31.2 changes.
The SQL rules below require [ALPHA_V31_DEPLOYMENT_AUTOMATION_RUN_THIS.sql](../../supabase/ALPHA_V31_DEPLOYMENT_AUTOMATION_RUN_THIS.sql)
and the existing tables/parent columns from prior migrations. No live database
execution or installed migration state is asserted by this document.

## Weighted SQL calculation

`dusk_alpha31_recalculate_deployment(prep_id)` stores integer component scores and
`readiness_score = clamp(round(0.55*T + 0.35*B + 0.10*P), 0, 100)`.
Each component is itself rounded to an integer percentage before weighting.
It also updates lifecycle status, `readiness_calculated_at`, and `updated_at`.

| Component | Eligible rows | Finished/accounted rows | Empty component |
| --- | --- | --- | --- |
| Tasks (`T`, 55%) | Prep's leaf tasks with `counts_toward_readiness=true` | `status` exactly `done` or `skipped` | 0% |
| Budget (`B`, 35%) | All prep's `cost_entries` | `cost_status` exactly `budgeted` or `paid` | 0% |
| Packing (`P`, 10%) | Prep's leaf packing rows with `required=true` | `packed=true` | 0% |

A leaf has no row referencing its ID through `parent_task_id`/`parent_item_id`. The child
existence query does not restrict children to the same prep or to eligible
children. An excluded child still excludes its parent from the component denominator.
Task `required` does not determine SQL task eligibility. Parent completion does not roll
up children, and parent flags are not inherited by children in these functions.
The helpers do not reject cycles or repair invalid hierarchy relationships.

Budget readiness counts rows, not amounts, category coverage, available cash, or
percentage paid. One paid row and one unbudgeted row yield 50%, regardless of amounts;
a zero-dollar budgeted row counts as accounted for. No budget rows yield 0%, rather
than an exemption. Missing components retain their weights: tasks alone can supply
at most 55%, and all eligible tasks/packing completed with no costs give 65%.
For example, `T=50`, `B=100`, `P=0` produces `round(62.5)=63` in PostgreSQL.

## Workspace presentation differs from scoring

[The summary route](../../src/app/api/alpha8/con-preps/[id]/summary/route.ts) returns
stored readiness/component fields; it does not run the SQL recalculation itself.
Its task and packing totals include all rows, including containers and excluded rows.
Open-task counts exclude `done`/`skipped`; monetary totals group cost amounts by status.
The packing badge uses all packed rows divided by all packing rows, not required leaves.
Consequently these counts and badges need not equal the SQL component percentages.

[The timing editor](../../src/components/alpha8/Alpha8WorkspaceEditor.tsx) exposes
departure, arrival, prep deadline, packing deadline, and notes. It does not submit
manual readiness or status. Only departure affects the SQL state rules below.
The direct-task status allowlist problem is documented in [Deployment Ops](deployment-ops.md).

## State selection is recomputed, not a one-way progression

`dusk_alpha31_expected_status` applies these rules in priority order:

1. A non-null event `end_at` at or before database `now()` gives `complete`.
2. Otherwise a non-null prep `departure_at` at or before `now()` gives `traveling`.
3. Otherwise any packed row in the prep gives `packing`, including optional/container rows.
4. Otherwise the state is `planning`.

Readiness percentage does not gate transitions. Event `start_at`, packing/prep
deadlines, arrival targets, and travel-segment departures are not state inputs.
Without an event end date, SQL does not automatically complete the deployment.
Unpacking everything or moving dates forward can move a state backward on recalculation.
The migration maps the former `ready` state to `planning` and constrains statuses
to `planning`, `packing`, `traveling`, and `complete`.

Completion calls `dusk_alpha31_ensure_case_study`: reuse the event's existing record,
or insert an unpublished `Draft` with blank narrative fields and `<event-slug>-case-study`.
It attempts an event-ID conflict path to avoid duplicate insertion; it does not publish it.
The checked-in Alpha9.2 index is unique only where `event_id IS NOT NULL`, while this
helper's `ON CONFLICT (event_id)` omits that predicate. Without an additional full unique
index in the deployed schema, creating a missing draft can fail and roll back the
recalculation, migration backfill or sweep. See the [migration caveat](../data-model.md).

## Triggers, sweep, and HTTP cron

Packing, task, and cost INSERT/UPDATE/DELETE triggers recalculate affected old/new preps.
Changing `con_preps.departure_at` also recalculates. There is no v31 event `end_at`
trigger or prep INSERT trigger. The migration performs an initial full backfill.
Time passing alone needs `dusk_alpha31_lifecycle_sweep`, which recalculates every prep
and returns rows for all of them, including unchanged statuses.

[POST /api/integrations/automation/tick](../../src/app/api/integrations/automation/tick/route.ts)
calls the sweep, then calls reminder and social-dispatch endpoints concurrently.
It returns 200 only if all three succeed; reported component failure returns 207.
[The separate cron SQL](../../supabase/ALPHA_V31_ENABLE_SUPABASE_CRON_AFTER_DEPLOY.sql)
sets a five-minute `pg_cron`/`pg_net` HTTP POST using a base URL and secret in Vault.
It recreates the named job but creates Vault secrets only if absent; rerunning does
not rotate existing secrets. The placeholder must be replaced before execution.

The tick prefers `AUTOMATION_TICK_SECRET` over `MAKE_WEBHOOK_SECRET` and forwards it.
Both downstream handlers accept only `MAKE_WEBHOOK_SECRET`; different values cause downstream authorization failure even when the outer tick is authorized.
[The v31.1 hotfix](../../supabase/ALPHA_V31_1_SECURITY_HOTFIX_RUN_THIS.sql) pins function
search paths, makes read helpers invoker functions, revokes PUBLIC/anon/authenticated
execution, and grants service-role execution. Write/sweep functions remain definers.

## Competing legacy calculation and public dates

[con-ops.ts](../../src/lib/con-ops.ts) still computes another score: required task/packing leaves have weight 1 each, travel presence 3, hotel presence 2, paid/confirmed registration 2.
It ignores budget and `counts_toward_readiness`; it finds leaves among required rows only.
`syncReadiness` writes only the total, leaving weighted component fields unchanged.
[The legacy admin GET](../../src/app/api/admin/con-prep/[id]/route.ts) invokes it before
checking prep ownership through `getDeployment`, without passing the user to the sync.
This remains a competing write path even though the con-prep layout replaces child UI.

[Public archive filtering](../../src/lib/deployment-archive.ts) and [report lifecycle](../../src/lib/incident-report.ts) classify past using `endAt ?? startAt`;
the archive uses `< now` and report uses `<= now`. These can disagree with SQL status,
especially for events with no end date. They do not invoke the lifecycle sweep.
