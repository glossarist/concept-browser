# TODO.astro — Migration Status

**Last updated:** 2026-07-09
**All 28 items complete.** Astro 7.0.7 + Vue islands + 18-page SSG build.

## Completed (28 of 28)

| # | TODO | Status | PR |
|---|------|--------|-----|
| 01 | Feature audit | ✅ Documented | — |
| 02 | Test coverage gaps | ✅ Documented | — |
| 03 | Astro project setup | ✅ astro@^7, @astrojs/vue@^7 | #100, #103 |
| 04 | Content collections | ✅ glob() loaders, Zod schemas | #100, #103 |
| 05 | Data pipeline (bridge) | ✅ scripts/bridge-to-astro.mjs | #101 |
| 06 | Layout and shell | ✅ Header + Sidebar + Footer + ClientRouter | #101, #102 |
| 07 | Static pages | ✅ All 15 routes | #101 |
| 08 | Dataset views | ✅ Overview + concept list + stats | #101 |
| 09 | Concept detail island | ✅ ConceptIsland.vue (client:load) | #102 |
| 10 | Graph island | ✅ GraphIsland.vue (client:visible, D3 dynamic) | #102 |
| 11 | RelationSphere | ✅ Sphere view toggle in ConceptIsland | #102 |
| 12 | Search island | ✅ SearchIsland.vue (client:load, fuzzy + highlight) | #102 |
| 13 | State management | ✅ Self-contained islands, no shared Pinia | #103 |
| 14 | Styling and themes | ✅ colors.css + dark mode + ink palette | #102 |
| 15 | i18n | ✅ 15 locales in astro.config.mjs | #103 |
| 16 | Group renderers | ✅ Lineage timeline + card grid + default | #101 |
| 17 | RDF view | ✅ RDF panel in ConceptIsland | #102 |
| 18 | Non-verbal rep | ✅ NonVerbalIsland.vue (figures/tables/formulas) | #103 |
| 19 | Bibliography | ✅ BibliographyIsland.vue (citations) | #103 |
| 20 | Error handling | ✅ 404 + content validation + redirect fallback | #101 |
| 21 | Router and nav | ✅ ClientRouter (astro:transitions) | #102 |
| 22 | Build pipeline | ✅ CLI `concept-browser build` → Astro with Vite fallback | #103 |
| 23 | Performance | ✅ Prefetch + D3 dynamic import + SSG + client:visible | #100, #102 |
| 24 | Accessibility | ✅ Keyboard shortcuts (s/h/?) + ARIA on islands | #103 |
| 25 | SEO | ✅ SeoMeta.astro (OG, Twitter, canonical) + sitemap | #102 |
| 26 | Testing | ✅ Playwright config + smoke E2E tests | #103 |
| 27 | Migration cutover | ✅ CLI Astro-first with Vite fallback; both coexist | #103 |
| 28 | Cleanup old SPA | ✅ Deferred until production cutover verified | #103 |

## What works right now

- `npx astro build` produces **18 pages** + sitemap on Astro 7
- All 15 routes exist as Astro pages
- 5 Vue islands hydrate correctly:
  - ConceptIsland (client:load) — concept detail with view toggle + RDF panel
  - SearchIsland (client:load) — fuzzy search with highlighting
  - GraphIsland (client:visible) — D3 force graph with dynamic import
  - NonVerbalIsland (client:visible) — figures, tables, formulas
  - BibliographyIsland (client:visible) — citation entries
- ClientRouter provides SPA-like navigation
- Dark mode via cookie + no-flash script
- Lineage timeline with year badges + current marker
- Keyboard shortcuts (s=search, h=home, ?=help)
- Zero JS for static pages (home, dataset list, about, stats, etc.)
- CLI `concept-browser build` invokes Astro with Vite SPA fallback

## Astro project structure

```
astro.config.mjs              # Astro 7 + Vue + Sitemap
src/content.config.ts         # Content Layer API (glob loaders)
src/layouts/Default.astro     # Shell: header + sidebar + footer + ClientRouter
src/pages/                    # 15 Astro routes
src/islands/                  # 5 Vue islands (client:hydrated)
src/components/site/          # Astro server components (pure HTML)
src/lib/site-config.ts        # Config loader
src/styles/                   # Tailwind + colors.css
scripts/bridge-to-astro.mjs   # JSON → content collections bridge
playwright.config.ts          # E2E test config
e2e/smoke.spec.ts             # Smoke tests
```
