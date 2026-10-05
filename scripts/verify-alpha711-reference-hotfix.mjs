import fs from "node:fs";

const required = [
  "src/lib/next-stop/compose.tsx",
  "src/lib/next-stop/generate.ts",
  "src/lib/next-stop/prompt.ts",
];

let failed = false;

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error("MISSING", file);
    failed = true;
  } else {
    console.log("OK     ", file);
  }
}

const compose = fs.readFileSync(
  "src/lib/next-stop/compose.tsx",
  "utf8",
);

if (!compose.includes("buildTextOverlay")) {
  console.error("compose.tsx does not contain the 7.1.1 renderer.");
  failed = true;
}

const generate = fs.readFileSync(
  "src/lib/next-stop/generate.ts",
  "utf8",
);

if (!generate.includes("client.images.edit")) {
  console.error("generate.ts is not reference-aware.");
  failed = true;
}

if (failed) process.exit(1);
console.log("\nAlpha 7.1.1 reference hotfix is present.");
