# ADR 0005: SHACL validation gate in the data pipeline

- **Status**: Accepted
- **Date**: 2026-06-27

## Context

Glossarist concept data flows through several transformations:

```
source repos → fetch-datasets → harmonized YAML → generate-data → JSON-LD/Turtle in public/data/
```

Each transformation can drift from the canonical schema (extra
fields, missing required fields, malformed dates, language codes
that are not BCP-47). Without a gate, these drifts reach the deployed
site and surface as runtime UI bugs that are tedious to trace back
to a data issue.

The concept-model repo (data-only) maintains a SHACL shapes file at
`shapes/glossarist.shacl.ttl` describing the canonical concept
shape. This is the same vocabulary that other Glossarist consumers
(Ruby gem, JS library) validate against — the single source of
truth for "what a valid concept looks like."

## Decision

Add `scripts/validate-shacl.mjs` and wire it into the data pipeline
as a mandatory gate. It walks every `.ttl` file under `public/data/`
(or a caller-supplied directory), parses each with `n3`, and runs
`rdf-validate-shacl` against the vendored shapes file. The script
exits non-zero on any violation, failing the build.

The shapes file is vendored at
`data/concept-model/shapes/glossarist.shacl.ttl` (synced from
glossarist/concept-model). `SHAPES_PATH` or `--shapes <path>`
overrides the default location.

```mjs
// scripts/validate-shacl.mjs
const dataset = createDataset(...);
const validator = await ShaclValidatorCtor.fromShapes(shapesDataset);
const report = validator.validate(dataDataset);
if (!report.conforms) {
  // pretty-print violations and exit(1)
}
```

## Consequences

**Positive**

- Data shape errors are caught at build time, not at runtime in the
  browser. The error message points at the offending concept and the
  violated constraint.
- The shapes file is shared with other Glossarist consumers — the
  browser cannot silently drift from the canonical schema.
- The gate is idempotent and fast (~seconds for thousands of
  concepts) so it can run on every build.

**Negative**

- Adds `n3`, `@rdfjs/dataset`, and `rdf-validate-shacl` to the
  build-time dependency set. They are devDependencies (not shipped
  to browsers), so the runtime bundle is unaffected.
- The shapes file must be kept in sync with concept-model. A
  shapes-vs-data mismatch surfaces as a false-positive validation
  failure; the fix is to bump the vendored shapes, not to weaken
  the validator.

**Watch for**

- If a shape needs to be relaxed (e.g., a new optional field is
  added), the fix happens in concept-model first, then the
  vendored copy is synced. Never edit the vendored shapes file
  in-place — it will be overwritten on the next sync.
