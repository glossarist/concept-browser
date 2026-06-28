# ADR 0002: Escape `/` in Turtle prefixed local names

- **Status**: Accepted
- **Date**: 2026-06-27

## Context

Concept status, normative status, relationship types, and entry-status
values are emitted as IRIs in the `gloss:` namespace:

```
gloss:hasStatus      gloss:status/valid
gloss:normativeStatus gloss:norm/preferred
gloss:hasEntryStatus  gloss:entstatus/valid
```

The Turtle 1.1 grammar (PN_LOCAL rule) permits `/` inside a prefixed
local name **only when escaped as `\/`**. Unescaped `gloss:status/valid`
is not a valid prefixed name — a strict parser must treat it as a
syntax error or as three tokens (`gloss:status`, `/`, `valid`).

The v0.7.51 emitter wrote these IRIs unescaped. The regex-based test
suite asserted the substring `gloss:status/valid` was present, which
passed — but `n3` (and any spec-compliant Turtle reader) rejected the
document. Anyone consuming the `.ttl` output downstream was getting
broken RDF.

## Decision

`formatIri()` in `turtle-writer.ts` escapes `/` in the local-name
portion of a prefixed name:

```ts
function formatIri(value: string): string {
  if (!isPrefixedName(value)) return `<${value}>`;
  const colonIdx = value.indexOf(':');
  const prefix = value.slice(0, colonIdx + 1);
  const local = value.slice(colonIdx + 1);
  const escaped = local.replace(/([/])/g, '\\$1');
  return prefix + escaped;
}
```

So `gloss:status/valid` becomes `gloss:status\/valid` in the output.
Absolute IRIs (http/https/urn/file/mailto/ftp schemes) and relative
paths without a colon are still wrapped in `<>` as before.

A round-trip test (`src/__tests__/concept-rdf/round-trip.test.ts`)
parses every emitted Turtle document through `n3` and asserts quads
on the resulting store. A regression of this kind cannot ship again
without turning that test red.

## Consequences

**Positive**

- Emitted `.ttl` is now spec-compliant; any Turtle 1.1 reader can
  parse it without post-processing.
- The escape is localized to one function — predicates with no `/`
  are unaffected.

**Negative**

- The escaped form `gloss:status\/valid` is slightly less readable
  in raw diffs than the unescaped form. Tools that understand
  Turtle render it back as `gloss:status/valid`.

**Watch for**

- PN_LOCAL also requires escaping for several other characters
  (`(`, `)`, `[`, `]`, etc.). The current emitter does not produce
  such characters in local names; if it ever does, extend the
  regex in `formatIri()` rather than adding ad-hoc escapes at
  call sites.
