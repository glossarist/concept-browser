# ADR 0003: Cardinality-based JSON-LD emission

- **Status**: Accepted
- **Date**: 2026-06-27

## Context

The Turtle writer naturally handles multi-valued predicates by
repeating the predicate (`ex:predicate "a", "b", "c"`). JSON-LD,
when no `@container: @set` is declared in the context, distinguishes
between:

- `{"predicate": "value"}` — single value, scalar
- `{"predicate": ["a", "b"]}` — multiple values, array

If the emitter always writes an array, consumers that destructure
`obj.predicate` as a string break. If it always writes a scalar,
multi-valued predicates lose data.

The v0.7.51 JSON-LD writer was inconsistent — some predicates always
emitted scalars, others always arrays, and the choice was not driven
by the actual data.

## Decision

The JSON-LD writer (`jsonld-writer.ts`) groups triples by predicate
within each subject and picks the shape **based on the count**:

```ts
function valuesFor(predicate: string, triples: RdfTriple[]): RdfTerm[] {
  return triples.filter(t => t.predicate === predicate).map(t => t.object);
}

// in writeResource:
for (const [predicate, objs] of grouped) {
  const jsonValues = objs.map(termToJson);
  obj[predicate] = objs.length === 1 ? jsonValues[0] : jsonValues;
}
```

- One triple → scalar.
- Multiple triples → array.
- Zero triples → predicate omitted (no empty arrays).

The JSON-LD context (`glossarist.context.jsonld`) deliberately does
**not** declare `@container: @set` for these predicates. This makes
the common single-valued case ergonomic for consumers; multi-valued
predicates require consumers to normalize.

## Consequences

**Positive**

- Output mirrors what a hand-written JSON-LD author would produce —
  no gratuitous arrays for single values.
- Smaller payload in the common case (one definition, one
  prefLabel per language).

**Negative**

- Consumers must defensively normalize `Array.isArray(x) ? x : [x]`
  when iterating. This is standard JSON-LD practice but is easy to
  forget. Documented in [data-consumers.md](../data-consumers.md).

**Alternatives considered**

- **Always arrays (`@container: @set`)** — predictable shape at the
  cost of awkward scalar access. Rejected because most predicates in
  this domain are single-valued per language.
- **Per-predicate declaration in context** — exact control but
  requires the context to track every predicate's cardinality.
  Rejected as too brittle for now; revisit if consumers push back.
