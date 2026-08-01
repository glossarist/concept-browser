# 03 — Update tsconfig + package.json for TS scripts

**Priority:** P0
**Status:** pending
**Depends on:** 01, 02
**Estimated effort:** small

## Context

The current `tsconfig.json` only includes `src/**/*.ts` — scripts and CLI are excluded from type checking entirely. The `package.json` `bin` field points to `./cli/index.mjs`. The `scripts` in `package.json` invoke scripts via `node scripts/*.mjs`.

Once scripts are TypeScript (TODOs 01, 02), the project config needs to:
1. Include `cli/` and `scripts/` in the tsconfig `include`
2. Compile them to JS for runtime
3. Update package.json to invoke compiled output

## Scope

### tsconfig changes

Option A — **single tsconfig** (simplest):
```json
{
  "include": ["src/**/*.ts", "src/**/*.vue", "cli/**/*.ts", "scripts/**/*.ts", "env.d.ts"]
}
```
Add `cli` and `scripts` to `include`. Keep `strict: true`, `noEmit: true`. vue-tsc then typechecks everything.

Option B — **project references** (cleaner separation):
```json
// tsconfig.json (solution)
{
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.scripts.json" }
  ]
}
// tsconfig.app.json — src/ + .vue (noEmit, typecheck only)
// tsconfig.scripts.json — cli/ + scripts/ (emit to dist/, or noEmit + tsx for runtime)
```

**Recommend Option A** for now. Option B is a follow-up if compile times become an issue.

### package.json changes

- `bin`: `"./cli/index.mjs"` → `"./cli/index.js"` (if compiling cli/) OR keep `.mjs` and use `tsx` for runtime
- `scripts.prebuild`: `node scripts/check-syntax.mjs` → `tsc --noEmit` (or keep check-syntax as a fast pre-gate)
- `scripts.check:scripts`: same
- All `scripts.*` fields that invoke `node scripts/*.mjs` → update extension if compiling, or use `tsx` if running TS directly

### Runtime strategy

Two options for running TS scripts:

**Option 1 — `tsx` (zero-config TS runner, recommended)**
- Install `tsx` as a devDependency
- Scripts stay as `.ts`, invoked via `tsx scripts/generate-data.ts`
- No compilation step needed
- `bin` field: `"./cli/index.mjs"` → a thin `.mjs` shim that calls `tsx cli/index.ts`
- Or: compile cli/ only, run scripts via tsx

**Option 2 — `tsc` compile step**
- `tsc` compiles cli/ + scripts/ to `dist/`
- `bin` field: `"./dist/cli/index.js"`
- All script invocations use `node dist/scripts/generate-data.js`
- Adds a build step but produces standard JS

**Recommend Option 1 (tsx)** — simpler, no dist/ to manage, concept-browser is a SPA not a server, the CLI is developer tooling.

### Files

- `tsconfig.json` — update `include`
- `package.json` — update `bin`, `scripts`
- `cli/index.ts` — ensure it works with tsx
- New: `cli/index.mjs` (thin shim for the published bin that calls tsx, if needed)

## Acceptance criteria

- [ ] `npx vue-tsc --noEmit` typechecks src/ + cli/ + scripts/
- [ ] `npm run build` still produces the SPA
- [ ] `npx concept-browser build` still works end-to-end
- [ ] `npm test` still works
- [ ] No runtime `.js` or `.mjs` files in scripts/ or cli/ (except the bin shim if needed)
