# 11 — glossarist-js: review and merge dependabot batch (#50–#54)

## Problem

5 open dependabot PRs against glossarist-js, ranging from patch to
major version bumps. They've been sitting since 2026-07-06 because
the audit work prioritized architectural fixes. Each one needs
review for breaking changes before merge.

## PRs

| PR | Package | Bump | Risk | Notes |
|----|---------|------|------|-------|
| [#54](https://github.com/glossarist/glossarist-js/pull/54) | n3 | 1.26.0 → 2.1.1 | **MAJOR** | RDF/JS library; v2 changed Stream API and several Dataset signatures. All emitters + write-turtle-sync + shacl.js need re-testing. |
| [#50](https://github.com/glossarist/glossarist-js/pull/50) | jsonld | 8.3.3 → 9.0.0 | **MAJOR** | Used by document-writer for JSON-LD serialization. v9 dropped Node 14 support and changed remote-document loading defaults. |
| [#51](https://github.com/glossarist/glossarist-js/pull/51) | rdf-validate-shacl | 0.4.5 → 0.6.5 | MEDIUM | SHACL validator. 0.5+ changed the factory pattern (we already worked around this in `shacl.js`). 0.6 added stricter shape validation. |
| [#52](https://github.com/glossarist/glossarist-js/pull/52) | js-yaml | 5.2.0 → 5.2.1 | PATCH | Bug-fix release. Safe to merge. |
| [#53](https://github.com/glossarist/glossarist-js/pull/53) | @rdfjs/dataset | 2.0.2 → 2.0.3 | PATCH | Bug-fix release. Safe to merge. |

## Plan

Merge in this order (smallest blast radius first):

1. **#52 (js-yaml patch)** — verify `npm test` passes, merge.
2. **#53 (@rdfjs/dataset patch)** — verify, merge.
3. **#51 (rdf-validate-shacl 0.6)** — verify SHACL tests still pass,
   especially the factory cleanup we did. If 0.6 strictness fails
   any current fixture, investigate before merge.
4. **#50 (jsonld 9.0)** — verify document-writer still produces
   equivalent JSON-LD. Run concept-browser's round-trip tests
   against this branch.
5. **#54 (n3 2.x)** — most invasive. Test write-turtle-sync, all
   emitters, shacl.js. If n3 2.x changes the Writer API, the
   async `writeTurtle` may need adjustment.

## Deliverables

- [ ] Merge #52, #53 (low-risk patches)
- [ ] Test #51, merge if SHACL gate passes
- [ ] Test #50 against concept-browser round-trip
- [ ] Test #54 against full emitter suite
- [ ] For each merged PR, bump glossarist-js patch version + release
- [ ] Bump `glossarist` dep in concept-browser package.json

## Tests

For each merge, the full glossarist-js test suite (873 tests) must
pass. For #50 and #54, also run concept-browser's vitest suite to
catch downstream regressions.

## Risk

Patches (#52, #53): near-zero.
Medium (#51): SHACL behavior change could fail fixtures.
Major (#50, #54): API changes could break emitters or writers.
Each PR is gated by tests before merge.
