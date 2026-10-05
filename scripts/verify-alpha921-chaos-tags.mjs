import fs from "node:fs";

const files = {
  link: "src/components/ChaosFilterLink.tsx",
  archive: "src/app/chaos/page.tsx",
  report: "src/app/chaos/[slug]/page.tsx",
};

let failed = false;

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) {
    console.error("MISSING", file);
    failed = true;
  } else {
    console.log("OK     ", file);
  }
}

if (!failed) {
  const link = fs.readFileSync(files.link, "utf8");
  const archive = fs.readFileSync(files.archive, "utf8");
  const report = fs.readFileSync(files.report, "utf8");

  const checks = [
    [link, "/chaos?tag=", "filter link destination"],
    [report, "ChaosFilterLink value={event.tag}", "event tag link"],
    [report, "ChaosFilterLink value={event.eventType}", "event type link"],
    [
      report,
      "ChaosFilterLink value={event.quarter.toUpperCase()}",
      "quarter link",
    ],
    [archive, "const activeTag =", "active tag parsing"],
    [archive, "filteredArchive", "archive filtering"],
    [archive, "item.event.quarter.toUpperCase()", "quarter match"],
    [archive, "Clear filter", "clear-filter control"],
  ];

  for (const [text, needle, label] of checks) {
    if (!text.includes(needle)) {
      console.error("MISSING", label);
      failed = true;
    } else {
      console.log("OK     ", label);
    }
  }
}

if (failed) process.exit(1);

console.log("\nAlpha 9.2.1 Chaos tag filtering is wired.");
