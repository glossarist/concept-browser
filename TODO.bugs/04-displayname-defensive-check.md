# 04 — Defensive `typeof === 'function'` check (duck typing + DRY violation)

## Problem (audit of contributed fix a6ac0df)

`scripts/generate-data.mjs:1188-1196` contains this fallback:

```js
const regDisplayName = typeof reg?.displayName === 'function'
  ? reg.displayName(defaultLang)
  : (reg?.name && typeof reg.name === 'object'
      ? (reg.name[defaultLang] || Object.values(reg.name)[0])
      : undefined);
```

This was added in `a6ac0df` (Bug 3 fix) to unblock deployment when
the running glossarist-js (v0.4.12) doesn't yet have
`Register.displayName`. The upstream feature shipped in
glossarist-js PR #55 (pending release as of 2026-07-06).

## Why this is wrong

1. **Duck typing**. `typeof obj.method === 'function'` is the JS
   equivalent of Ruby's `respond_to?(:method)` — explicitly
   forbidden by the global CLAUDE.md rules. Type checks should use
   `instanceof` or a contract assertion, not feature-sniffing.

2. **Duplicated fallback chain**. The `else` branch manually does
   `name[lang] || Object.values(name)[0]`, which is exactly what
   `displayName` would have returned. If `displayName`'s fallback
   logic changes, this copy drifts. DRY violation.

3. **Silent regression risk**. Once glossarist-js ships `displayName`,
   the `else` branch becomes dead code that's never exercised in
   tests but stays in the codebase forever as latent drift.

4. **Comment doesn't say "remove when..."**. The fix is framed as
   permanent defensive code, not as a temporary shim with a sunset.

## Fix

**Option A (preferred): release + bump.** Cut a glossarist-js patch
release with PR #55 (`Register.name` + `BibliographyData` bare-array),
then bump `@glossarist/concept-browser`'s `glossarist` dependency.
The defensive check becomes unreachable and can be deleted.

**Option B (if release is blocked): version-gated contract check.**
Replace duck typing with a version check:

```js
import { version as glossaristVersion } from 'glossarist';
const HAS_DISPLAY_NAME = semver.gte(glossaristVersion, '0.4.13');
if (!HAS_DISPLAY_NAME) {
  throw new Error(
    `concept-browser requires glossarist >= 0.4.13 (got ${glossaristVersion}). ` +
    `Run: npm install glossarist@latest`
  );
}
```

This fails loudly with a remediation hint instead of silently
degrading.

## Deliverables

- [ ] Release glossarist-js v0.4.13 with PR #55
- [ ] Bump `glossarist` dep in concept-browser package.json
- [ ] Delete the `typeof === 'function'` check in generate-data.mjs
- [ ] Replace with `reg?.displayName(defaultLang)` (no fallback)
- [ ] Add a test that the resolved title uses `displayName` directly

## Tests

- Unit test on `firstNonEmpty(reg?.displayName('eng'), ds.title, reg?.ref, ds.id)`
- Integration test: a register with `name: { eng: 'X' }` produces
  manifest title 'X' (no fallback to ds.title)

## Risk

Low. The defensive check was always meant to be temporary. Removing
it once the upstream feature lands is the entire point of the shim.
