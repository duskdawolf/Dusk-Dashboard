import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  deploymentImages,
  DIRECTORY_PLACEHOLDER,
  safePublicUrl,
  sameOfficialHost,
  parseDirectorySource,
  EditionSchema,
  officialEvidenceAllowed,
} from "../src/lib/convention-directory/model.ts";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log("PASS", name);
}
const facts = {
  edition_key: "2027-main",
  name: "Test 2027",
  edition_year: 2027,
  start_at: "2027-05-01T12:00:00Z",
  website_url: "https://testcon.org/2027",
};
check("exact image order", () =>
  assert.deepEqual(
    deploymentImages("https://assets.org/user.jpg", {
      banner_url: "https://assets.org/banner.jpg",
      logo_url: "https://assets.org/edition.jpg",
      series_logo_url: "https://assets.org/series.jpg",
    }),
    [
      "https://assets.org/user.jpg",
      "https://assets.org/banner.jpg",
      "https://assets.org/edition.jpg",
      "https://assets.org/series.jpg",
      DIRECTORY_PLACEHOLDER,
    ],
  ),
);
check("missing/unsafe images fall through", () =>
  assert.deepEqual(
    deploymentImages("javascript:alert(1)", {
      banner_url: null,
      logo_url: "https://assets.org/logo.jpg",
    }),
    ["https://assets.org/logo.jpg", DIRECTORY_PLACEHOLDER],
  ),
);
check("empty images use placeholder", () =>
  assert.deepEqual(deploymentImages(), [DIRECTORY_PLACEHOLDER]),
);
check("source URL validation", () => {
  for (const url of [
    "http://testcon.org",
    "https://127.0.0.1",
    "https://user:pass@testcon.org",
    "https://host.internal",
    "https://[::1]",
    "javascript:alert(1)",
  ])
    assert.equal(safePublicUrl(url), null);
  assert.equal(
    sameOfficialHost("https://www.testcon.org", "https://testcon.org/2027"),
    true,
  );
  assert.equal(
    sameOfficialHost("https://testcon.org", "https://testcon.org.attacker.org"),
    false,
  );
});
check("official social approval is account-specific", () => {
  const sources = [{ url: "https://social.org/official-con", kind: "social" }];
  assert.ok(
    officialEvidenceAllowed(
      "https://testcon.org",
      sources,
      "https://social.org/official-con/posts/1",
    ),
  );
  assert.equal(
    officialEvidenceAllowed(
      "https://testcon.org",
      sources,
      "https://social.org/somebody-else",
    ),
    false,
  );
});
check("feed validation rejects personal planning fields", () =>
  assert.equal(
    EditionSchema.safeParse({ ...facts, confirmation_code: "PRIVATE" }).success,
    false,
  ),
);
check("all official hotel roles", () => {
  for (const role of ["main", "overflow", "secondary", "staff", "other"])
    assert.ok(
      EditionSchema.safeParse({
        ...facts,
        hotels: [
          {
            source_key: role,
            name: role,
            role,
            source_url: "https://testcon.org/hotels",
          },
        ],
      }).success,
    );
});
check("date integrity and unique hotel identity", () => {
  assert.equal(
    EditionSchema.safeParse({ ...facts, end_at: "2027-01-01T12:00:00Z" })
      .success,
    false,
  );
  const h = {
    source_key: "a",
    name: "a",
    role: "main",
    source_url: "https://testcon.org/hotels",
  };
  assert.equal(
    EditionSchema.safeParse({ ...facts, hotels: [h, h] }).success,
    false,
  );
});
check("structured feed preserves occurrence keys", () =>
  assert.equal(
    parseDirectorySource(
      JSON.stringify({ editions: [facts] }),
      "directory-json",
      "https://testcon.org/feed",
    )[0].edition_key,
    "2027-main",
  ),
);
check("duplicate editions rejected", () =>
  assert.throws(() =>
    parseDirectorySource(
      JSON.stringify({ editions: [facts, facts] }),
      "directory-json",
      "https://testcon.org/feed",
    ),
  ),
);
check("JSON-LD deterministic evidence without invented dates/themes", () => {
  const html =
    '<script type="application/ld+json">' +
    JSON.stringify({
      "@graph": [
        {
          "@type": "Event",
          "@id": "/2028",
          name: "Test 2028",
          startDate: "2028-05-01",
          location: {
            name: "Convention Center",
            address: { addressLocality: "Boston" },
          },
        },
      ],
    }) +
    "</script>";
  const e = parseDirectorySource(
    html,
    "jsonld",
    "https://testcon.org/editions",
  )[0];
  assert.equal(e.edition_key, "https://testcon.org/2028");
  assert.equal(e.start_at, "2028-05-01T00:00:00.000Z");
  assert.equal(e.date_precision, "date_only");
  assert.equal(e.theme, undefined);
  assert.equal(e.hotels, undefined);
});
check("unsupported sources and missing identities require review", () => {
  assert.throws(() =>
    parseDirectorySource(
      "<html>Unstructured facts</html>",
      "jsonld",
      "https://testcon.org",
    ),
  );
  assert.throws(() =>
    parseDirectorySource(
      '<script type="application/ld+json">{"@type":"Event","name":"No identity"}</script>',
      "jsonld",
      "https://testcon.org",
    ),
  );
});
check("canonical app version", () =>
  assert.match(
    fs.readFileSync("src/lib/app-version.ts", "utf8"),
    /APP_VERSION = "Alpha v31\.2"/,
  ),
);
check("directory worker never writes personal tables", () => {
  const source = fs.readFileSync(
    "src/lib/convention-directory/server.ts",
    "utf8",
  );
  for (const table of [
    "events",
    "con_preps",
    "hotel_stays",
    "travel_segments",
    "cost_entries",
    "prep_tasks",
    "packing_items",
    "event_media",
  ])
    assert.ok(!source.includes(`.from("${table}")`));
});
check("worker behavior suite", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/fixtures/alpha-v31-2-worker.mjs"],
    { encoding: "utf8" },
  );
  process.stdout.write(result.stdout);
  if (result.status !== 0)
    throw new Error(result.stderr || "Worker suite failed");
});
if (process.argv.includes("--database")) {
  const container = `dusk-v312-test-${process.pid}`;
  const docker = ["--host=unix:///var/run/docker.sock"];
  const dockerEnv = { ...process.env };
  for (const k of [
    "DOCKER_HOST",
    "DOCKER_CONTEXT",
    "DOCKER_TLS",
    "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH",
  ])
    delete dockerEnv[k];
  function run(args, input) {
    const r = spawnSync("docker", [...docker, ...args], {
      input,
      encoding: "utf8",
      maxBuffer: 8_000_000,
      env: dockerEnv,
    });
    if (r.status !== 0)
      throw new Error(r.stderr || r.stdout || "Docker failed");
    return r.stdout;
  }
  try {
    // No ports, no Internet, no mounted production data. Trust is local to this fixture.
    run([
      "run",
      "-d",
      "--name",
      container,
      "--network",
      "none",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:17-alpine",
    ]);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const r = spawnSync(
        "docker",
        [...docker, "exec", container, "pg_isready", "-U", "postgres"],
        { encoding: "utf8", env: dockerEnv },
      );
      if (r.status === 0) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(ready, "isolated PostgreSQL ready");
    const sql = (text) =>
      run(
        [
          "exec",
          "-i",
          container,
          "psql",
          "-U",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
        ],
        text,
      );
    sql(
      fs.readFileSync("scripts/fixtures/alpha-v31-2-prerequisites.sql", "utf8"),
    );
    const migration = fs.readFileSync(
      "supabase/ALPHA_V31_2_CONVENTION_DIRECTORY_RUN_THIS.sql",
      "utf8",
    );
    check("migration applies", () => sql(migration));
    check("migration reruns without loss", () => sql(migration));
    check(
      "SQL backfill, integrity, privacy, refresh, notifications and leases",
      () =>
        sql(
          fs.readFileSync(
            "scripts/fixtures/alpha-v31-2-assertions.sql",
            "utf8",
          ),
        ),
    );
  } finally {
    spawnSync("docker", [...docker, "rm", "-f", container], {
      encoding: "utf8",
      env: dockerEnv,
    });
  }
} else
  console.log(
    "Database tests not requested; use --database for isolated PostgreSQL integration checks.",
  );
console.log(`${checks} Alpha v31.2 checks passed.`);
