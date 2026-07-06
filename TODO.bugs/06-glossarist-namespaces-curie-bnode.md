# 06 — glossarist-js: unified namespaces + CURIE helpers + bnode ID strategy (TODO 32)

## Problem

Across glossarist-js's 8 specialized emitters, the same namespace
IRIs and helper functions are redeclared locally:

| Constant/function | Re-declared in |
|-------------------|----------------|
| `FOAF_NS = 'http://xmlns.com/foaf/0.1/'` | bibliography-emitter, agents-emitter, build-activity-emitter, image-variant-emitter |
| `DCAT_NS = 'http://www.w3.org/ns/dcat#'` | dataset-emitter, group-emitter, image-variant-emitter |
| `DCTERMS_NS`, `SKOS_NS`, `PROV_NS`, `GLOSS_NS`, `XSD_NS` | dataset-emitter (full set); others partial |
| RDF_TYPE = `'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'` | every emitter |
| `deterministicId(...)` (local FNV-1a hash) | dataset-emitter, image-variant-emitter; differs from `deterministic-id.js` |
| `resolveIri(iri)` (CURIE resolver) | vocabulary-emitter (private); needed by other emitters that accept CURIE inputs |

~30 duplicate declarations across 7 files. Three DRY violations:

1. **Same constants, many sites** — namespace IRIs are stringly typed
2. **Two bnode ID strategies** — `deterministicId` (node:crypto MD5)
   and the local FNV-1a hash produce different IDs for the same
   logical bnode
3. **CURIE resolver is private** — `resolveIri` is exported from
   `vocabulary-emitter` but isn't reachable from emitters that
   consume CURIEs (e.g., group-emitter accepts `kind: 'lineage'`
   but doesn't resolve CURIE-typed IRIs)

## Fix

### namespaces.js — single source for IRIs

```js
// src/rdf/namespaces.js
export const NS = Object.freeze({
  rdf:      'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs:     'http://www.w3.org/2000/01/rdf-schema#',
  owl:      'http://www.w3.org/2002/07/owl#',
  xsd:      'http://www.w3.org/2001/XMLSchema#',
  skos:     'http://www.w3.org/2004/02/skos/core#',
  skosxl:   'http://www.w3.org/2008/05/skos-xl#',
  dcterms:  'http://purl.org/dc/terms/',
  prov:     'http://www.w3.org/ns/prov#',
  dcat:     'http://www.w3.org/ns/dcat#',
  foaf:     'http://xmlns.com/foaf/0.1/',
  gloss:    'https://www.glossarist.org/ontologies/',
});

export const RDF_TYPE = `${NS.rdf}type`;
```

### curie.js — CURIE ↔ IRI conversion

```js
// src/rdf/curie.js
import { NS } from './namespaces.js';

const SCHEMES = new Set(['http', 'https', 'urn', 'file', 'mailto', 'ftp']);

export function isAbsoluteIri(s) {
  if (typeof s !== 'string' || s.length === 0) return false;
  if (s.startsWith('urn:')) return true;
  const colon = s.indexOf(':');
  if (colon < 1) return false;
  return SCHEMES.has(s.slice(0, colon));
}

export function resolveIri(iri) {
  if (isAbsoluteIri(iri)) return iri;
  const colon = iri.indexOf(':');
  if (colon < 1) return iri;
  const prefix = iri.slice(0, colon);
  const local = iri.slice(colon + 1);
  const base = NS[prefix];
  return base ? `${base}${local}` : iri;
}

export function compactIri(iri, prefixes = NS) {
  let best = null, bestLen = 0;
  for (const [prefix, base] of Object.entries(prefixes)) {
    if (iri.startsWith(base) && base.length > bestLen) {
      best = `${prefix}:${iri.slice(base.length)}`;
      bestLen = base.length;
    }
  }
  return best ?? iri;
}
```

### bnode-id.js — single deterministic ID strategy

```js
// src/rdf/bnode-id.js
import { createHash } from 'node:crypto';

// Pure-JS fallback when node:crypto isn't available (browser bundle).
function fnv1a(...parts) {
  const seed = parts.filter(p => p != null).join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function deterministicBnodeId(...parts) {
  // Browser-safe path: FNV-1a only.
  // Node path: prefer MD5 (matches glossarist-ruby's deterministic-id).
  if (typeof createHash === 'function') {
    return createHash('md5')
      .update(parts.filter(p => p != null).join('|'))
      .digest('hex')
      .slice(0, 12);
  }
  return fnv1a(...parts);
}
```

### Update all emitters

Each emitter:
- Removes local `*_NS` constants
- Imports `NS`, `RDF_TYPE` from `./namespaces.js`
- Imports `deterministicBnodeId` from `./bnode-id.js` where needed
- Uses `NS.dcat`, `NS.foaf`, etc. in `namedNode()` construction

## Deliverables

- [ ] `src/rdf/namespaces.js`
- [ ] `src/rdf/curie.js` (move resolveIri from vocabulary-emitter)
- [ ] `src/rdf/bnode-id.js`
- [ ] Re-export from `src/rdf/index.js`
- [ ] Type declarations in `src/rdf/index.d.ts`
- [ ] Update 8 emitters to consume the new modules
- [ ] Drift test: assert namespace IRIs match concept-model/prefixes.ttl

## Tests

- Each `NS.*` matches the corresponding prefix in `prefixes.ttl`
- `resolveIri('gloss:Concept')` → `'https://www.glossarist.org/ontologies/Concept'`
- `resolveIri('https://example.org/x')` → unchanged
- `resolveIri('unknown:x')` → unchanged
- `compactIri('https://www.glossarist.org/ontologies/Concept')` → `'gloss:Concept'`
- Longest-match wins when prefixes overlap
- `deterministicBnodeId('a', 'b')` is stable across calls and restarts
- All existing emitter tests still pass (no behavior change)
