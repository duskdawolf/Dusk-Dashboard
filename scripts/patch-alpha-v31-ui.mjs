import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const src = path.join(root, "src");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && /\.(tsx|ts|md)$/.test(entry.name)
      ? [full]
      : [];
  });
}

for (const file of walk(src)) {
  let text = fs.readFileSync(file, "utf8");
  const original = text;

  text = text
    .replaceAll("Convention Ops", "Deployment Ops")
    .replaceAll("Convention workspace", "Deployment workspace")
    .replaceAll("convention workspace", "deployment workspace");

  if (text !== original) {
    fs.writeFileSync(file, text);
    console.log("renamed visible Ops language in", path.relative(root, file));
  }
}

// Public incident report page: if it exposes report.lifecycle, make future/past
// wording explicit without changing the route.
const incidentPath = path.join(root, "src/app/chaos/[slug]/page.tsx");

if (fs.existsSync(incidentPath)) {
  let text = fs.readFileSync(incidentPath, "utf8");

  if (
    text.includes("const { event, caseStudy, media, posts } = report;")
  ) {
    text = text.replace(
      "const { event, caseStudy, media, posts } = report;",
      "const { event, caseStudy, media, posts, lifecycle } = report;",
    );
  }

  text = text.replaceAll(
    "Dusk Industries Incident Report",
    "{lifecycle === \"case_study\" ? \"Dusk Industries Case Study\" : \"Dusk Industries Tactical Deployment Plan\"}",
  );

  // Don't show a completed-event "analysis pending" panel merely because the
  // draft case study hasn't been published yet.
  text = text.replace(
    "{caseStudy ? (",
    '{lifecycle === "case_study" && caseStudy ? (',
  );

  fs.writeFileSync(incidentPath, text);
}
