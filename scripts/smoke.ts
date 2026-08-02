#!/usr/bin/env node
/**
 * Post-build smoke test — deploy gate that catches runtime errors the
 * type-checker and unit tests can't see.
 *
 * WHAT THIS CATCHES
 *   - Hydration TypeError (#171: `r.conceptGenericRelations.length`).
 *   - Dynamic-import resolution failures (the tsx devDep bug).
 *   - Failed resource requests the build itself caused (#174:
 *     bibliography.json / /learn / favicon 404s).
 *   - Config-not-honored regressions (#162/#166: branding.fonts).
 *
 * WHAT THIS DOES NOT DO
 *   - Functional UI testing (use Vitest + @vue/test-utils for that).
 *   - Cross-browser coverage (Chromium only — WebKit/Safari differences
 *     are caught by manual pre-release validation).
 *
 * USAGE
 *   npm run smoke            # assumes dist/ already built
 *   npm run build:full       # build:full pipeline now includes smoke
 *
 * The test serves dist/ on a random localhost port, loads each URL in a
 * headless Chromium, and asserts zero `pageerror` events plus zero 404s
 * on same-origin resources. Any failure exits non-zero so CI/deploy
 * gates fail loudly.
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { statSync, createReadStream } from 'fs';
import { extname, join, normalize, resolve as pathResolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = pathResolve(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function serveDist(root: string): Promise<{ server: ReturnType<typeof createServer>; origin: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
        let filePath = join(root, urlPath);
        // SPA fallback: if no extension and the file doesn't exist as a
        // directory, try .html, then fall back to 200.html / index.html.
        if (!extname(filePath)) {
          if (statSafe(filePath)?.isFile()) {
            return sendFile(res, filePath);
          }
          const candidates = [
            filePath + '.html',
            join(filePath, 'index.html'),
            join(root, '200.html'),
            join(root, 'index.html'),
          ];
          for (const c of candidates) {
            if (statSafe(c)?.isFile()) {
              return sendFile(res, c);
            }
          }
          res.writeHead(404);
          return res.end('Not found');
        }
        if (statSafe(filePath)?.isFile()) {
          return sendFile(res, filePath);
        }
        res.writeHead(404);
        return res.end('Not found');
      } catch (e) {
        res.writeHead(500);
        res.end(String(e ?? 'server error'));
      }
    });
    // Use port 0 to let the OS pick a free port; retrieve it after listen.
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

function statSafe(p) {
  try { return statSync(p); } catch { return null; }
}

function sendFile(res, filePath) {
  const safe = normalize(filePath);
  const ct = MIME[extname(safe)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': ct });
  createReadStream(safe).pipe(res);
}

/**
 * Pages to probe. Use relative paths from the served origin. The smoke
 * test runs AFTER the build, so anything present in dist/ is fair game.
 * The home page always exists; the rest are best-effort (404 → skip).
 */
const PAGE_PATHS = [
  '/',
  '/learn/',
  '/learn/relationships/',
  '/learn/designations/',
  '/learn/statuses/',
];

/**
 * Consumer-provided files that concept-browser's build does NOT emit.
 * The smoke test runs against concept-browser's own dist (no datasets
 * configured), so these will 404. That's not a regression — it's a
 * "consumer hasn't provided data" condition. Listed here so we can
 * filter them out of the failure signal.
 */
const CONSUMER_DATA_FILES = [
  '/datasets.json',
  '/site-config.json',
  '/data/cross-ref-index.json',
];

function isConsumerDataFile(url) {
  try {
    const u = new URL(url);
    return CONSUMER_DATA_FILES.some(f => u.pathname === f || u.pathname.startsWith('/data/'));
  } catch {
    return false;
  }
}

async function probePage(browser, origin, path) {
  const url = new URL(path, origin).toString();
  const page = await browser.newPage();
  const errors = [];
  const failedRequests = [];

  page.on('pageerror', (e) => {
    errors.push({ kind: 'pageerror', message: e.message, stack: e.stack ?? '' });
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Browser consoles emit a generic "Failed to load resource: ... 404"
    // message for every network 404 — the URL is NOT in the text, so we
    // can't filter by file here. We track real 404s via the response
    // event below and discard the generic console message to avoid
    // double-counting noise.
    if (/Failed to load resource/i.test(text)) return;
    // Cross-origin font CDN warnings are out of our control.
    if (/fonts\.g(oogle|static)\.com/.test(text)) return;
    errors.push({ kind: 'console.error', message: text });
  });
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (u.startsWith(origin) && !isConsumerDataFile(u)) {
      failedRequests.push({ url: u, failure: req.failure()?.errorText ?? 'failed' });
    }
  });
  page.on('response', (resp) => {
    const u = resp.url();
    if (u.startsWith(origin) && resp.status() >= 400 && !isConsumerDataFile(u)) {
      failedRequests.push({ url: u, status: resp.status() });
    }
  });

  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 });
    if (resp && resp.status() >= 400) {
      // 404 on a non-home page = the build didn't emit it. Treat as
      // skip, not fail (the home page is the load-bearing probe).
      return { path, url, status: resp.status(), bodyLen: 0, errors, failedRequests, skipped: path !== '/' };
    }
    // Wait a beat for any deferred hydration effect to fire.
    await page.waitForTimeout(500);
    const bodyLen = await page.evaluate(() => document.body?.innerText?.length ?? 0);
    return { path, url, status: resp?.status() ?? 0, bodyLen, errors, failedRequests, skipped: false };
  } catch (e) {
    errors.push({ kind: 'navigation', message: String(e) });
    return { path, url, status: 0, bodyLen: 0, errors, failedRequests, skipped: false };
  } finally {
    await page.close();
  }
}

function formatFindings(results) {
  const lines = [];
  for (const r of results) {
    if (r.skipped) {
      lines.push(`\n  ${r.path}  (HTTP ${r.status} — skipped, not in this build)`);
      continue;
    }
    if (r.errors.length === 0 && r.failedRequests.length === 0 && r.bodyLen > 0) continue;
    lines.push(`\n  ${r.path}  (HTTP ${r.status}, body ${r.bodyLen} chars)`);
    for (const e of r.errors) {
      lines.push(`    [${e.kind}] ${e.message}`);
    }
    for (const f of r.failedRequests) {
      lines.push(`    [request] ${f.status ?? f.failure}  ${f.url}`);
    }
  }
  return lines.join('\n');
}

async function ensureDist() {
  if (!statSafe(DIST)?.isDirectory()) {
    console.error(`smoke: dist/ not found at ${DIST}`);
    console.error(`       run \`npm run build\` first, or use \`npm run build:full\`.`);
    process.exit(2);
  }
  if (!statSafe(join(DIST, 'index.html'))?.isFile()) {
    console.error(`smoke: dist/index.html missing — build did not complete.`);
    process.exit(2);
  }
}

async function main() {
  await ensureDist();
  const { server, origin } = await serveDist(DIST);

  let exitCode = 0;
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const path of PAGE_PATHS) {
      // Skip paths the build didn't emit (e.g. /learn/* if page-types
      // config doesn't synthesize them). 404 on the navigation itself
      // is recorded; the probe still runs to catch prefetch 404s.
      const r = await probePage(browser, origin, path);
      results.push(r);
    }

    const anyFail = results.some(r =>
      !r.skipped && (r.errors.length > 0 || r.failedRequests.length > 0 || r.bodyLen === 0)
    );
    const findings = formatFindings(results);

    if (anyFail) {
      exitCode = 1;
      console.error(`\n  FAIL  smoke test found problems:${findings}\n`);
    } else {
      const skipped = results.filter(r => r.skipped).length;
      console.log(`\n  OK    smoke test passed (${results.length - skipped} pages, ${skipped} skipped, 0 errors).`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error('smoke: fatal error', e);
  process.exit(1);
});
