# TODO.astro — Migration Status

**Last updated:** 2026-07-09

## Completed (20 of 28)

| # | TODO | Status | PR |
|---|------|--------|-----|
| 01 | Feature audit | ✅ Documented | — |
| 02 | Test coverage gaps | ✅ Documented | — |
| 03 | Astro project setup | ✅ Implemented | #100 |
| 04 | Content collections | ✅ Implemented | #100 |
| 05 | Data pipeline (bridge) | ✅ `scripts/bridge-to-astro.mjs` | #101 |
| 06 | Layout and shell | ✅ Header + Sidebar + Footer | #101 |
| 07 | Static pages | ✅ All 15 routes | #101 |
| 08 | Dataset views | ✅ Overview + concept list | #101 |
| 09 | Concept detail island | ✅ ConceptIsland.vue (client:load) | #102 |
| 10 | Graph island | ✅ GraphIsland.vue (client:visible, D3 dynamic import) | #102 |
| 11 | (merged into 10) | ✅ | #102 |
| 12 | Search island | ✅ SearchIsland.vue (client:load, fuzzy + highlight) | #102 |
| 14 | Styling and themes | ✅ colors.css + dark mode + ClientRouter | #102 |
| 16 | Group renderers | ✅ Lineage timeline in group/[id]/index.astro | #101 |
| 17 | RDF view | ✅ RDF panel in ConceptIsland | #102 |
| 20 | Error handling | ✅ 404 page + content collection validation | #101 |
| 21 | Router and nav | ✅ ClientRouter (astro:transitions) | #102 |
| 23 | Performance | ✅ Prefetch + D3 dynamic import + SSG | #100, #102 |
| 25 | SEO | ✅ SeoMeta.astro (OG, Twitter, canonical) | #102 |

## Remaining (8)

| # | TODO | Status | Blocker |
|---|------|--------|---------|
| 13 | State management | Deferred — islands are self-contained; no shared Pinia needed yet |
| 15 | i18n routing | Config exists (15 locales in astro.config.mjs); per-locale page generation not wired |
| 18 | Non-verbal rep | ConceptIsland has placeholders; figures/tables/formulas need dedicated island components |
| 19 | Bibliography | Needs bibliography content collection + citation rendering in concept detail |
| 22 | Build pipeline | Bridge script exists; CLI `concept-browser build` doesn't invoke Astro yet |
| 24 | Accessibility | ARIA on islands; keyboard shortcuts and screen reader testing needed |
| 26 | Testing | Playwright E2E + Astro container API tests not started |
| 27-28 | Cutover + cleanup | Blocked on 15, 18, 19, 22 completion |

## What works right now

- `npx astro build` produces 13 pages + sitemap
- All 15 routes exist as Astro pages
- Vue islands hydrate correctly (concept detail, search, graph)
- ClientRouter provides SPA-like navigation
- Dark mode works via cookie + no-flash script
- Search is fully functional (client-side fuzzy)
- Lineage timeline renders for groups
- Zero JS shipped for static pages (home, dataset list, about, stats, etc.)
