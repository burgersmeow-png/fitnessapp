// Builds the browser version of the app into a folder, ready to sit next to the landing page.
//   node scripts/build-web.mjs <output folder> [base path]
// e.g. node scripts/build-web.mjs _site/app /fitnessapp/app
import { spawnSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [out = 'dist-web', base = '/fitnessapp/app'] = process.argv.slice(2);
const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', out], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, WEB_BASE_URL: base },
});
if (r.status !== 0) process.exit(r.status ?? 1);
// GitHub Pages has no server-side routing: unknown paths get 404.html. Making that the app's own
// page lets links like /app/try?w=... open the right screen.
copyFileSync(join(out, 'index.html'), join(dirname(out), '404.html'));
console.log(`Built the browser app into ${out} (base path ${base}).`);
