# 04 — [BLOCKED] Upgrade glossarist to TS-published version

**Priority:** P1
**Status:** BLOCKED on upstream packaging fix
**Blocks:** 05, 06, 07, 08, 09
**Estimated effort:** medium (once unblocked)

## Context

glossarist-js has completed its TypeScript migration. The repo's main branch has:
- 154 `.ts` source files under `src/`
- `main: dist/index.js` (compiled output)
- `prepublishOnly: npm run build && npm run typecheck && npm test`
- Proper subpath exports for `./models`, `./rdf`, `./transforms`, `./validators`, `./diff`

However, the **published** versions 0.4.35–0.4.50 all have a packaging bug:
- `main: src/index.js` — a path that **does not exist** on disk
- Ships `.ts` files only (zero `.js` files)
- Runtime `require()` and `import()` both fail

## Blocker

The glossarist-js team needs to publish a version from their current main branch (which has the correct `main: dist/index.js` + `prepublishOnly: npm run build`). Until then:

- `npm install glossarist@latest` installs a broken package
- Vite cannot resolve `import { Concept } from 'glossarist'` at runtime
- Node `require()` fails

## Verification (to re-run once a fixed version is published)

```bash
# Check if the fix is published
npm view glossarist@latest main types
# Should show: main = 'dist/index.js', types = 'dist/index.d.ts'

# Install and test
mkdir -p /tmp/gls-verify && cd /tmp/gls-verify && npm init -y && npm install glossarist@latest
node -e "const m = require('glossarist'); console.log(Object.keys(m).length, 'exports')"
# Should print a number > 0
```

## Once unblocked

1. Bump `package.json` `glossarist` dependency from `^0.4.34` to `^<fixed-version>`
2. `npm install`
3. Verify Vite dev server starts without errors
4. Verify `npm run build` succeeds
5. Verify `npm test` passes
6. Proceed to TODOs 05–06 (remove augment, update imports)

## Workaround (NOT recommended for production)

If urgent: configure Vite to pre-bundle glossarist with esbuild and resolve `.ts` directly:

```typescript
// vite.config.ts
optimizeDeps: {
  include: ['glossarist'],
  esbuildOptions: {
    // Allow TS from node_modules
    tsconfigRaw: { compilerOptions: { target: 'ES2022' } },
  },
},
resolve: {
  alias: {
    'glossarist': path.resolve(__dirname, 'node_modules/glossarist/src/index.ts'),
  },
},
```

This is fragile, breaks on every glossarist update, and doesn't help Node-side scripts. **Do not use as a long-term solution.**

## Acceptance criteria

- [ ] glossarist-js publishes a version with `main: dist/index.js` and compiled `.js` output
- [ ] `npm install glossarist@<fixed>` resolves at runtime without Vite workarounds
- [ ] concept-browser `package.json` bumped
- [ ] All existing tests pass with the new glossarist version
