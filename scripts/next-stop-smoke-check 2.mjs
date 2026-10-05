import fs from 'node:fs';

const required = [
  'src/lib/next-stop/generate.ts',
  'src/lib/next-stop/compose.ts',
  'src/app/api/events/[id]/next-stop/route.ts',
  'src/components/next-stop/NextStopGeneratorCard.tsx',
  'supabase/migrations/20261001_v26_alpha7_next_stop_generator.sql',
];

let failed = false;
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`MISSING ${file}`);
    failed = true;
  } else {
    console.log(`OK      ${file}`);
  }
}
if (failed) process.exit(1);
console.log('Alpha 7 Next Stop feature files are present.');
