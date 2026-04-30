# Status: DONE

# 08 — SPA Deployment Configuration

## Context

The browser needs to deploy as an SPA to GitHub Pages at https://www.geolexica.org. This requires:
- Base path configuration in Vite and Vue Router
- SPA fallback (404.html) for client-side routing
- GitHub Actions CI/CD pipeline

## Task

### vite.config.ts

Add `base` option:

```typescript
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  // ... rest unchanged
})
```

### src/router/index.ts (line 34)

```typescript
history: createWebHistory(import.meta.env.BASE_URL),
```

### scripts/generate-404.js

Copy `dist/index.html` → `dist/404.html` for GitHub Pages SPA fallback.

```js
import { copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'dist');
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
console.log('Created dist/404.html for SPA fallback');
```

### package.json scripts

Add:
```json
{
  "fetch-datasets": "node scripts/fetch-datasets.mjs",
  "build:full": "npm run fetch-datasets && npm run generate-data && node scripts/build-edges.js && npm run build",
  "postbuild": "node scripts/generate-404.js"
}
```

### .github/workflows/deploy.yml

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run fetch-datasets
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: npm run generate-data
      - run: node scripts/build-edges.js
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Files

- Modify: `vite.config.ts`
- Modify: `src/router/index.ts`
- Modify: `package.json`
- Create: `scripts/generate-404.js`
- Create: `.github/workflows/deploy.yml`

## Verification

- `npm run build` creates `dist/404.html`
- SPA routes work with direct URL access (404.html fallback)
- GitHub Actions workflow runs on push to main
