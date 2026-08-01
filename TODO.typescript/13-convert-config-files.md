# 13 — Convert config files to TypeScript

**Priority:** P3
**Status:** pending
**Estimated effort:** small

## Context

Three config files are JavaScript:
- `astro.config.mjs` (56 lines) — Astro build config
- `tailwind.config.js` (48 lines) — Tailwind theme
- `vite.config.ts` (189 lines) — already TypeScript ✓

## Scope

- `astro.config.mjs` → `astro.config.ts` (Astro supports TS configs)
- `tailwind.config.js` → `tailwind.config.ts` (Tailwind v4 supports TS configs)
- Verify all tools that read these configs support TS

## Acceptance criteria

- [ ] No `.mjs` or `.js` config files at root level
- [ ] `npm run dev`, `npm run build`, `npm run build:astro` all work
