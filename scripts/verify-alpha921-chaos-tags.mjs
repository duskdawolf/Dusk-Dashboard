// Alpha v31.1 moved these features to /deployments and retained Chaos redirects.
import fs from "node:fs";
import assert from "node:assert/strict";
const read = (file) => fs.readFileSync(file, "utf8");
const checks = [
  [
    "src/components/DeploymentFilterLink.tsx",
    "?tag=",
    "filter link destination",
  ],
  [
    "src/app/deployments/[slug]/page.tsx",
    "value={event.tag}",
    "event tag link",
  ],
  [
    "src/app/deployments/[slug]/page.tsx",
    "value={event.eventType}",
    "event type link",
  ],
  [
    "src/app/deployments/[slug]/page.tsx",
    "value={event.quarter.toUpperCase()}",
    "quarter link",
  ],
  ["src/app/deployments/past/page.tsx", "params.tag", "active tag parsing"],
  [
    "src/lib/deployment-archive.ts",
    ".filter((item) => matchesTag(item, tag))",
    "archive filtering",
  ],
  [
    "src/lib/deployment-archive.ts",
    "item.event.quarter.toUpperCase()",
    "quarter match",
  ],
  [
    "src/components/DeploymentArchivePage.tsx",
    "Clear filter",
    "clear-filter control",
  ],
  [
    "src/app/chaos/page.tsx",
    "encodeURIComponent(raw.trim())",
    "legacy archive preserves filter",
  ],
  [
    "src/app/chaos/[slug]/page.tsx",
    "redirect(`/deployments/",
    "legacy detail redirect",
  ],
];
for (const [file, needle, label] of checks) {
  assert.ok(read(file).includes(needle), label);
  console.log("PASS", label);
}
console.log("Alpha 9.2.1 tag filtering retained on current deployment routes.");
