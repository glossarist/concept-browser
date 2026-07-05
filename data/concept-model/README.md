# data/concept-model — vendored data artifacts from concept-model repo

This directory holds **data-only** artifacts copied from
[glossarist/concept-model](https://github.com/glossarist/concept-model).

concept-model is a *model* repo (TTL, JSON-LD, YAML schemas). It holds no
code, no npm package, no Ruby gem. concept-browser vendors the small set
of data files its build scripts need at runtime. There is no runtime
dependency on concept-model.

## Files

| File | Purpose |
|------|---------|
| `glossarist.context.jsonld` | JSON-LD term map — reference |
| `glossarist.ttl` | OWL ontology — input for `scripts/generate-ontology-schema.mjs` |
| `prefixes.ttl` | Canonical prefix bindings (SSOT) — input for `scripts/generate-prefixes.mjs` |
| `shapes/glossarist.shacl.ttl` | SHACL shapes — input for `scripts/validate-shacl.mjs` (build-time CI gate) |

## Syncing

Update these files from the latest concept-model tag:

```bash
npm run sync:model              # fetches latest from glossarist/concept-model
npm run sync:model -- v3.0.0    # pin to a specific tag
```

## Why vendor instead of `npm install`?

Because concept-model is not an npm package. Treating it as one would
require bolting codegen + packaging onto a repo that should only hold
data. Vendoring the small data files we need keeps the model repo clean
and lets this repo's build scripts evolve independently.
