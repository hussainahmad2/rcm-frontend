/**
 * Static smoke: ensure critical marketing + app route modules resolve.
 * Run: npm run test:smoke
 */
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'src/App.tsx',
  'src/pages/home/HomePage.tsx',
  'src/pages/login/LoginPage.tsx',
  'src/pages/workspace/WorkspacePage.tsx',
  'src/pages/demo/DemoPage.tsx',
  'src/lib/auth.tsx',
  'src/lib/api.ts',
];

let failed = 0;
for (const rel of required) {
  const path = resolve(root, rel);
  if (!existsSync(path)) {
    console.error(`MISSING ${rel}`);
    failed += 1;
  } else {
    console.log(`ok ${rel}`);
  }
}

if (failed) {
  console.error(`Smoke failed: ${failed} missing`);
  process.exit(1);
}
console.log('Smoke routes passed');
