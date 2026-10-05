import fs from 'node:fs';

const required = [
  'src/components/alpha71/Alpha71BrandAssetsPanel.tsx',
  'src/app/api/alpha71/brand-assets/route.ts',
  'src/app/api/alpha71/brand-settings/route.ts',
  'src/lib/alpha71/brand-assets.ts',
  'src/lib/alpha71/types.ts',
  'src/lib/next-stop/compose.tsx',
  'src/lib/next-stop/generate.ts',
  'src/lib/next-stop/prompt.ts',
  'src/components/alpha7/Alpha7ConventionOpsDock.tsx',
  'supabase/V26_ALPHA71_BRAND_ASSETS_RUN_THIS.sql',
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

if (failed) process.exit(1);
console.log('\nAlpha 7.1 brand-assets files are present.');
