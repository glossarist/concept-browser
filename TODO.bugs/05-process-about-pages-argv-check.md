# 05 — `process-about-pages.mjs`: argv-based direct-invocation check is fragile

## Problem (audit of contributed fix fd52976)

`scripts/process-about-pages.mjs:184-186`:

```js
const isDirectInvocation = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectInvocation) {
  main();
}
```

This is the standard Node.js pattern for "run main() only when
invoked directly, not when imported." But it has known edge cases:

1. **Symlinks**. If `node` is invoked via a symlinked path (e.g.,
   `npx concept-browser` → `/usr/local/lib/node_modules/.../cli.js`),
   `process.argv[1]` is the symlink path while `import.meta.url` is
   the real path. `resolve()` doesn't dereference symlinks, so the
   comparison fails.

2. **Workspaces / monorepos**. When the script is hoisted to
   `node_modules/@glossarist/concept-browser/scripts/...`, the
   `process.argv[1]` path is the workspace's resolution, which may
   not string-match the `import.meta.url` of the actual file.

3. **Windows path separators**. `resolve()` uses the platform
   separator; `fileURLToPath()` normalizes to forward slashes on
   Windows. Comparison can fail.

The current `process-about-pages.test.mjs` works because vitest
calls `main()` explicitly; it doesn't exercise the
`isDirectInvocation` check.

## Why this matters

If the check fails on a deployment's `node` invocation, `main()`
silently doesn't run. About pages aren't compiled. Same bug class
as Bug 1 from the contributor's report — silent failure, build
succeeds, runtime 404.

## Fix

Use `node:module`'s `isMainThread` pattern, or compare via
`realpathSync` to dereference symlinks:

```js
import { realpathSync } from 'node:fs';

const isDirectInvocation = process.argv[1]
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
```

`realpathSync` dereferences symlinks and normalizes the path. Both
sides of the comparison see the canonical filesystem path.

Alternative (more robust): expose `main()` and always require the
caller to invoke it explicitly. No auto-run heuristic. The CLI does
this already (PR #96). The standalone `node scripts/process-about-pages.mjs`
form becomes `node -e "import('./scripts/process-about-pages.mjs').then(m => m.main())"`.

Recommend the realpath fix (keeps the CLI invocation ergonomics).

## Deliverables

- [ ] Replace `resolve()` with `realpathSync()` in the
      `isDirectInvocation` check
- [ ] Add a test that simulates a symlinked invocation (create a
      symlink, run via the symlink, verify main() runs)

## Tests

- Unit test on the `isDirectInvocation` boolean logic with various
  path inputs (direct, symlinked, relative, absolute)
- Integration test: create symlink to the script, invoke via
  symlink, assert output produced
