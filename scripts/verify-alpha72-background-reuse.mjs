import fs from 'node:fs';

const required = [
  'src/lib/next-stop/types.ts',
  'src/lib/next-stop/copy.ts',
  'src/lib/next-stop/prompt.ts',
  'src/lib/next-stop/compose.tsx',
  'src/lib/next-stop/persist.ts',
  'src/lib/next-stop/state.ts',
  'src/lib/next-stop/generate.ts',
  'src/app/api/events/[id]/next-stop/route.ts',
  'src/components/next-stop/NextStopGeneratorCard.tsx',
  'supabase/V26_ALPHA72_BACKGROUND_REUSE_RUN_THIS.sql',
];

let failed = false;
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error('MISSING', file);
    failed = true;
  } else {
    console.log('OK     ', file);
  }
}

const route = fs.readFileSync('src/app/api/events/[id]/next-stop/route.ts', 'utf8');
if (!route.includes('generate_card_from_background') || !route.includes('refresh_all')) {
  console.error('Route does not include background reuse actions.');
  failed = true;
}

if (failed) process.exit(1);
console.log('\nAlpha 7.2 background-reuse files are present.');
