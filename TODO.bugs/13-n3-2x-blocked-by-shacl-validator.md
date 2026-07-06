# 13 — n3 2.x upgrade blocked by rdf-validate-shacl compatibility

## Problem

Attempted to merge `dependabot/npm_and_yarn/n3-2.1.1` (PR #54) into
the batch. Tests failed:

```
TypeError: this.factory.clownface is not a function
    at new SHACLValidator (node_modules/rdf-validate-shacl/index.js:22:37)
```

n3 2.x changed the DataFactory API in a way that's incompatible with
rdf-validate-shacl 0.6.5 (the latest available). The validator depends
on `clownface` via its `factory` argument; n3 2.x's factory no longer
exposes the `clownface` method the validator expects.

## Why this matters

n3 is the core RDF library used across glossarist-js (parsing,
writing, DataFactory). v2 brings performance improvements and bug
fixes, but the SHACL gate depends on rdf-validate-shacl, which can't
be upgraded to a compatible version (no newer release exists).

## Options

### Option A: Hold n3 at 1.x until rdf-validate-shacl releases a fix

- Close PR #54 for now
- Document the blocker in package.json comments
- Re-evaluate quarterly

### Option B: Replace rdf-validate-shacl with another validator

- Evaluate alternatives: `@rdfjs/shacl-checksum`, custom SHACL runner
- Risk: SHACL is complex; a different validator may produce different
  results on edge cases

### Option C: Patch shacl.js to provide a clownface-compatible factory

- Wrap n3 2.x's DataFactory with a clownface shim
- Risk: fragile, breaks on next validator release

## Recommendation

**Option A.** n3 1.x works fine; 2.x is a nice-to-have, not a need.
The SHACL gate is a critical feature. Hold until upstream catches up.

## Deliverable

- [ ] Close PR #54 with a comment pointing to this TODO
- [ ] Pin n3 to ^1.17.0 in package.json (already done)
- [ ] Revisit when rdf-validate-shacl publishes a release mentioning
      n3 2.x compatibility

## Status

DEFERRED — waiting on upstream `rdf-validate-shacl` release that
supports n3 2.x.
