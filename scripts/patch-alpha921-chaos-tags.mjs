import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const archivePath = path.join(root, "src/app/chaos/page.tsx");
const reportPath = path.join(root, "src/app/chaos/[slug]/page.tsx");

function fail(message) {
  console.error(`\nAlpha 9.2.1 patch failed: ${message}`);
  process.exit(1);
}

for (const file of [archivePath, reportPath]) {
  if (!fs.existsSync(file)) {
    fail(`Expected public Chaos route not found: ${file}`);
  }
}

function ensureImport(source, statement, anchor) {
  if (source.includes(statement)) return source;
  if (!source.includes(anchor)) {
    fail(`Could not find import anchor: ${anchor}`);
  }
  return source.replace(anchor, `${anchor}\n${statement}`);
}

// ---------------------------------------------------------------------------
// Incident report: turn the three existing metadata pills into links.
// ---------------------------------------------------------------------------
let report = fs.readFileSync(reportPath, "utf8");

report = ensureImport(
  report,
  'import { ChaosFilterLink } from "@/components/ChaosFilterLink";',
  'import Link from "next/link";',
);

const oldPills = `<div className="mt-5 flex flex-wrap gap-2">
            <span className="tag !mt-0">{event.tag}</span>
            <span className="tag !mt-0">{event.eventType}</span>
            <span className="tag !mt-0">{event.quarter.toUpperCase()}</span>
          </div>`;

const newPills = `<div className="mt-5 flex flex-wrap gap-2">
            <ChaosFilterLink value={event.tag} />
            <ChaosFilterLink value={event.eventType} />
            <ChaosFilterLink value={event.quarter.toUpperCase()} />
          </div>`;

if (!report.includes("ChaosFilterLink value={event.tag}")) {
  if (!report.includes(oldPills)) {
    fail(
      "Could not locate the incident-report metadata pills. " +
        "The page has changed from the expected v26 layout, so it was left untouched.",
    );
  }
  report = report.replace(oldPills, newPills);
}

fs.writeFileSync(reportPath, report);

// ---------------------------------------------------------------------------
// /chaos archive: accept ?tag= and filter the same metadata.
// ---------------------------------------------------------------------------
let archive = fs.readFileSync(archivePath, "utf8");

archive = ensureImport(
  archive,
  'import Link from "next/link";',
  'import { ChaosArchiveCard } from "@/components/ChaosArchiveCard";',
);

if (!archive.includes("const activeTag =")) {
  const oldSignature = "export default async function ChaosPage() {";
  const newSignature = `export default async function ChaosPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string | string[] }>;
}) {`;

  if (!archive.includes(oldSignature)) {
    fail(
      "Could not locate the ChaosPage function signature. " +
        "The page has changed from the expected v26 layout.",
    );
  }

  archive = archive.replace(oldSignature, newSignature);

  const archiveLoad = "  const archive = await getChaosArchive();";
  const filterBlock = `  const params = await searchParams;
  const rawTag = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const activeTag = rawTag?.trim() ?? "";

  const archive = await getChaosArchive();

  const filteredArchive = activeTag
    ? archive.filter((item) => {
        const needle = activeTag.toLowerCase();

        return [
          item.event.tag,
          item.event.eventType,
          item.event.quarter.toUpperCase(),
        ].some(
          (value) =>
            String(value ?? "")
              .trim()
              .toLowerCase() === needle,
        );
      })
    : archive;`;

  if (!archive.includes(archiveLoad)) {
    fail("Could not locate getChaosArchive() call.");
  }

  archive = archive.replace(archiveLoad, filterBlock);

  // Only replace the two lifecycle source arrays, not global archive counts.
  archive = archive.replace(
    `  const completed = archive.filter(`,
    `  const completed = filteredArchive.filter(`,
  );
  archive = archive.replace(
    `  const upcoming = archive.filter(`,
    `  const upcoming = filteredArchive.filter(`,
  );
}

// Make the stats + active filter useful.
if (!archive.includes("Clear filter")) {
  const stats = `<div className="mt-7 flex flex-wrap gap-3">
        <span className="tag !mt-0">{archive.length} total deployments</span>
        <span className="tag !mt-0">{completed.length} completed</span>
        <span className="tag !mt-0">{upcoming.length} future chaos</span>
      </div>`;

  const filteredStats = `<div className="mt-7 flex flex-wrap items-center gap-3">
        <span className="tag !mt-0">
          {activeTag
            ? \`\${filteredArchive.length} matching \${activeTag}\`
            : \`\${archive.length} total deployments\`}
        </span>
        <span className="tag !mt-0">{completed.length} completed</span>
        <span className="tag !mt-0">{upcoming.length} future chaos</span>

        {activeTag ? (
          <Link
            href="/chaos"
            className="rounded-full border border-dusk-aqua/20 bg-dusk-aqua/5 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-dusk-aqua transition hover:bg-dusk-aqua/10"
          >
            Clear filter ×
          </Link>
        ) : null}
      </div>`;

  if (!archive.includes(stats)) {
    fail("Could not locate Chaos archive summary pills.");
  }

  archive = archive.replace(stats, filteredStats);
}

// Friendly empty state.
if (!archive.includes("No incident reports match")) {
  const beforeUpcoming = `      {upcoming.length ? (`;
  const emptyState = `      {activeTag && filteredArchive.length === 0 ? (
        <section className="panel mt-10">
          <div className="eyebrow">Evidence search</div>
          <h2 className="text-2xl font-black">
            No incident reports match “{activeTag}”.
          </h2>
          <p className="mt-3 text-slate-400">
            Try another incident-report tag or clear the filter to reopen the
            entire corporate evidence locker.
          </p>
          <Link href="/chaos" className="button-secondary mt-5 inline-flex">
            CLEAR FILTER →
          </Link>
        </section>
      ) : null}

`;

  if (!archive.includes(beforeUpcoming)) {
    fail("Could not locate Chaos upcoming section.");
  }

  archive = archive.replace(beforeUpcoming, emptyState + beforeUpcoming);
}

fs.writeFileSync(archivePath, archive);

console.log("Patched public incident-report tags.");
console.log("  /chaos/[slug] metadata pills are clickable");
console.log("  /chaos?tag=Q3 filters by quarter");
console.log("  /chaos?tag=Convention filters by primary event tag/type");
