import { copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'dist');
const indexHtml = join(dist, 'index.html');
const notFoundHtml = join(dist, '404.html');

if (existsSync(indexHtml)) {
  copyFileSync(indexHtml, notFoundHtml);
  console.log('Created dist/404.html for SPA fallback');
} else {
  console.warn('dist/index.html not found — skipping 404.html generation');
}
