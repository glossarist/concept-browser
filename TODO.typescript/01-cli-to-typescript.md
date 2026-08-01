# 01 — Convert CLI entrypoint to TypeScript

**Priority:** P0
**Status:** pending
**Blocks:** 02, 03
**Estimated effort:** medium

## Context

`cli/index.mjs` (257 lines) is the concept-browser CLI entrypoint — published as the `concept-browser` bin in `package.json`. It's pure JS with zero type annotations. It dispatches to `scripts/*.mjs` via dynamic `import()` and orchestrates the full build pipeline (fetch → generate → edges → about → vite build).

As part of the TS migration, this becomes `cli/index.ts`. Once compiled, the `bin` field in `package.json` points to `cli/index.js` (compiled output).

## Scope

- Rename `cli/index.mjs` → `cli/index.ts`
- Add TypeScript types to all function signatures, variables, and the command dispatch map
- Type the CLI argument parser (`parseArgs` function)
- Type the `commands` map (each command is an async function returning `Promise<void>`)
- Type the site-config loading result
- Type the build pipeline orchestration (each step's input/output)
- Update `package.json` `bin` field from `"./cli/index.mjs"` → `"./cli/index.js"` (compiled output)
- Ensure `cli/tsconfig.json` (or the root tsconfig) includes `cli/`

## Key files

- `cli/index.mjs` → `cli/index.ts`
- `package.json` — update `bin` field
- `tsconfig.json` — add `cli/**/*.ts` to `include`

## Acceptance criteria

- [ ] `cli/index.ts` compiles with strict TypeScript
- [ ] `npx tsc --noEmit` passes with cli/ included
- [ ] `npx concept-browser --help` still works after compilation
- [ ] `npx concept-browser doctor` still works
- [ ] `npx concept-browser build` still runs the full pipeline
- [ ] No `any` types in the public API surface (internal cast-only `any` acceptable for dynamic import returns)
- [ ] Type the CLI dispatch so unknown commands are a compile error
