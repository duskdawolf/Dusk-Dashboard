// Dependency substitution only at transport boundaries; execute the real worker.
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@/lib/auth")
      return {
        url: "data:text/javascript,export async function getDashboardUser(){return globalThis.__directoryTestUser}",
        shortCircuit: true,
      };
    if (specifier === "next/server")
      return {
        url: 'data:text/javascript,export const NextResponse={json:(body,init)=>new Response(JSON.stringify(body),{...init,headers:{"content-type":"application/json"}})};export const NextRequest=Request;',
        shortCircuit: true,
      };
    if (specifier.startsWith("@/lib/convention-directory/"))
      return next(
        new URL(
          "../../src/lib/convention-directory/" +
            specifier.split("/").pop() +
            ".ts",
          import.meta.url,
        ).href,
        context,
      );
    if (specifier === "@/lib/supabase/server")
      return {
        url: "data:text/javascript,export function createAdminSupabaseClient(){return globalThis.__directoryTestDb}",
        shortCircuit: true,
      };
    if (
      specifier === "./fetch-source" &&
      context.parentURL?.endsWith("/convention-directory/server.ts")
    )
      return {
        url: "data:text/javascript,export async function fetchOfficialSource(url){if(globalThis.__directoryTestError)throw new Error(globalThis.__directoryTestError);return globalThis.__directoryTestSources[url]}",
        shortCircuit: true,
      };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const url = new URL(specifier, context.parentURL);
      if (fs.existsSync(fileURLToPath(url) + ".ts"))
        return next(url.href + ".ts", context);
    }
    return next(specifier, context);
  },
});
const worker = await import("../../src/lib/convention-directory/server.ts");
const now = Date.now();
const future = new Date(now + 86400000 * 30).toISOString();
const facts = {
  edition_key: "occurrence-1",
  name: "Fixture Convention",
  edition_year: 2027,
  start_at: future,
  website_url: "https://official.org/2027",
};
const seriesId = "00000000-0000-4000-8000-000000000001";
function fixture({
  existing = [],
  body = [facts],
  discovery = false,
  secondary = false,
} = {}) {
  const tables = {
    convention_series: [
      {
        id: seriesId,
        name: "Fixture",
        official_url: "https://official.org",
        ingest_url: "https://official.org/feed",
        ingest_format: "directory-json",
        next_discovery_at: new Date(
          now + (discovery ? -1 : 86400000),
        ).toISOString(),
        failure_count: 0,
        last_success_at: "2020-01-01T00:00:00Z",
        ...(secondary
          ? {
              discovery_url: "https://secondary.org/feed",
              discovery_format: "directory-json",
            }
          : {}),
      },
    ],
    convention_editions: existing.map((e) => ({ series_id: seriesId, ...e })),
    convention_series_official_sources: [],
    convention_edition_aliases: [],
    convention_directory_candidates: [],
    convention_directory_runs: [],
    public_convention_editions: [],
  };
  const calls = [];
  const db = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data: name === "dusk_directory_claim" ? "test-lease" : null,
        error: null,
      };
    },
    from(table) {
      assert.ok(
        Object.hasOwn(tables, table),
        `worker used unexpected table ${table}`,
      );
      let filters = [],
        mode = "select",
        payload = null,
        one = false;
      const q = {
        select() {
          return q;
        },
        eq(key, value) {
          filters.push((row) => row[key] === value || key === "lease_token");
          return q;
        },
        lte() {
          return q;
        },
        or() {
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        single() {
          one = true;
          return q;
        },
        maybeSingle() {
          one = true;
          return q;
        },
        update(value) {
          mode = "update";
          payload = value;
          return q;
        },
        insert(value) {
          mode = "insert";
          payload = value;
          return q;
        },
        upsert(value) {
          mode = "insert";
          payload = value;
          return q;
        },
        then(resolve, reject) {
          try {
            let rows = tables[table].filter((row) =>
              filters.every((f) => f(row)),
            );
            if (mode === "update") {
              rows.forEach((row) => Object.assign(row, payload));
              calls.push({ table, mode, payload });
            }
            if (mode === "insert") {
              tables[table].push({ ...payload });
              calls.push({ table, mode, payload });
            }
            return Promise.resolve({
              data: one ? (rows[0] ?? null) : rows,
              error: null,
            }).then(resolve, reject);
          } catch (e) {
            return Promise.reject(e).then(resolve, reject);
          }
        },
      };
      return q;
    },
  };
  globalThis.__directoryTestDb = db;
  globalThis.__directoryTestError = null;
  globalThis.__directoryTestSources = {
    "https://official.org/feed": JSON.stringify({ editions: body }),
    "https://secondary.org/feed": JSON.stringify({
      editions: [
        { ...facts, edition_key: "secondary-2028", edition_year: 2028 },
      ],
    }),
  };
  return { tables, calls, db };
}
let checks = 0;
async function test(name, fn) {
  await fn();
  checks++;
  console.log("PASS", name);
}
await test("non-con creation remains manual", async () => {
  const { db } = fixture();
  assert.deepEqual(
    await worker.conventionForDeployment(db, {
      event_type: "meetup",
      title: "My meetup",
      start_at: future,
    }),
    {
      event_type: "meetup",
      title: "My meetup",
      start_at: future,
      convention_edition_id: null,
    },
  );
});
await test("new convention requires selectable official identity", async () => {
  const { db } = fixture();
  await assert.rejects(
    () => worker.conventionForDeployment(db, { event_type: "convention" }),
    /required/,
  );
  await assert.rejects(
    () =>
      worker.conventionForDeployment(db, {
        event_type: "convention",
        convention_edition_id: seriesId,
      }),
    /verified/,
  );
});
await test("official facts seed creation without accepting edited facts", async () => {
  const { db, tables } = fixture();
  tables.public_convention_editions.push({
    ...facts,
    id: seriesId,
    status: "scheduled",
  });
  const result = await worker.conventionForDeployment(db, {
    event_type: "convention",
    convention_edition_id: seriesId,
    title: "Invented official title",
  });
  assert.equal(result.title, facts.name);
  assert.equal(result.start_at, facts.start_at);
});
await test("scheduled refresh updates known editions twice daily", async () => {
  const f = fixture({
    existing: [{ id: "e", ...facts, verification_status: "official" }],
  });
  const r = await worker.refreshSeries(seriesId);
  assert.equal(r.ok, true);
  assert.equal(
    f.calls.filter((c) => c.name === "dusk_directory_apply").length,
    1,
  );
  const delay =
    Date.parse(f.tables.convention_series[0].next_refresh_at) - Date.now();
  assert.ok(delay > 11.9 * 3600000 && delay <= 12 * 3600000);
});
await test("new editions wait for weekly discovery", async () => {
  const f = fixture();
  await worker.refreshSeries(seriesId);
  assert.equal(
    f.calls.filter((c) => c.name === "dusk_directory_apply").length,
    0,
  );
});
await test("weekly official discovery promotes verified facts", async () => {
  const f = fixture({ discovery: true });
  await worker.refreshSeries(seriesId);
  assert.equal(
    f.calls.filter((c) => c.name === "dusk_directory_apply").length,
    1,
  );
  const days =
    (Date.parse(f.tables.convention_series[0].next_discovery_at) - Date.now()) /
    86400000;
  assert.ok(days > 6.9 && days <= 7);
});
await test("secondary discovery queues review and cannot publish", async () => {
  const f = fixture({ discovery: true, secondary: true });
  await worker.refreshSeries(seriesId);
  assert.equal(f.tables.convention_directory_candidates.length, 1);
  assert.equal(
    f.tables.convention_directory_candidates[0].authority,
    "secondary",
  );
  assert.equal(
    f.calls.filter((c) => c.name === "dusk_directory_apply").length,
    1,
  );
});
await test("conflicting occurrence identity never overwrites edition", async () => {
  const f = fixture({
    discovery: true,
    existing: [{ id: "old", ...facts, edition_key: "different-key" }],
  });
  await worker.refreshSeries(seriesId);
  assert.equal(
    f.calls.filter((c) => c.name === "dusk_directory_apply").length,
    0,
  );
  assert.equal(
    f.tables.convention_directory_candidates[0].authority,
    "official",
  );
});
await test("reviewed alias reuses existing edition identity", async () => {
  const f = fixture({
    existing: [{ id: "e", ...facts, edition_key: "legacy-key" }],
  });
  f.tables.convention_edition_aliases.push({
    series_id: seriesId,
    source_key: facts.edition_key,
    edition_id: "e",
  });
  await worker.refreshSeries(seriesId);
  assert.equal(
    f.calls.find((c) => c.name === "dusk_directory_apply").args.p_facts
      .edition_key,
    "legacy-key",
  );
});
await test("failed source preserves last successful verification and backs off", async () => {
  const f = fixture();
  globalThis.__directoryTestError = "Source timeout";
  const r = await worker.refreshSeries(seriesId, true);
  assert.equal(r.ok, false);
  assert.equal(
    f.calls.filter((c) => c.name === "dusk_directory_apply").length,
    0,
  );
  assert.equal(
    f.tables.convention_series[0].last_success_at,
    "2020-01-01T00:00:00Z",
  );
  assert.equal(f.tables.convention_series[0].failure_count, 1);
  assert.ok(
    Date.parse(f.tables.convention_series[0].retry_after) > now + 3590000,
  );
});
await test("on-demand discovery still uses verified source path", async () => {
  const f = fixture();
  await worker.refreshSeries(seriesId, true);
  assert.equal(
    f.calls.find((c) => c.name === "dusk_directory_claim").args.p_force,
    true,
  );
  assert.equal(
    f.calls.filter((c) => c.name === "dusk_directory_apply").length,
    1,
  );
});
await test("cross-domain evidence fails before any fact writes", async () => {
  const f = fixture({
    discovery: true,
    body: [
      facts,
      {
        ...facts,
        edition_key: "evil",
        website_url: "https://unapproved.org/2028",
      },
    ],
  });
  const r = await worker.refreshSeries(seriesId, true);
  assert.equal(r.ok, false);
  assert.equal(
    f.calls.filter((c) => c.name === "dusk_directory_apply").length,
    0,
  );
});
const directoryRoute = await import(
  "../../src/app/api/convention-directory/route.ts"
);
const adminRoute = await import(
  "../../src/app/api/admin/convention-directory/route.ts"
);
await test("directory API denies unauthenticated search and refresh", async () => {
  globalThis.__directoryTestUser = null;
  assert.equal(
    (
      await directoryRoute.GET(
        new Request("https://app.org/api/convention-directory"),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await directoryRoute.POST(
        new Request("https://app.org/api/convention-directory", {
          method: "POST",
        }),
      )
    ).status,
    401,
  );
});
await test("directory administration rejects editors before privileged access", async () => {
  globalThis.__directoryTestUser = { id: seriesId, role: "editor" };
  assert.equal((await adminRoute.GET()).status, 403);
  assert.equal(
    (
      await adminRoute.POST(
        new Request("https://app.org/api/admin/convention-directory", {
          method: "POST",
        }),
      )
    ).status,
    403,
  );
});
await test("directory APIs reject malformed JSON without writes", async () => {
  globalThis.__directoryTestUser = { id: seriesId, role: "admin" };
  const f = fixture();
  assert.equal(
    (
      await directoryRoute.POST(
        new Request("https://app.org/api/convention-directory", {
          method: "POST",
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await adminRoute.POST(
        new Request("https://app.org/api/admin/convention-directory", {
          method: "POST",
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal(f.calls.length, 0);
});
hooks.deregister();
console.log(`${checks} directory worker behavior checks passed.`);
