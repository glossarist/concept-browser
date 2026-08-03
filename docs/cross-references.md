# Cross-Reference Validation

concept-browser validates **all** cross-references at build time. No xref is silently skipped — every `{{...}}` mention, every `gl:related` target, every partitive/generic member must resolve.

## Validation pipeline

```
generate-data.ts → JSON-LD concepts
       ↓
build-edges.ts → cross-reference edge index
       ↓
validate-links.ts → ALL xrefs checked, build FAILS on any broken link
       ↓
vite build → static SPA
```

Run validation standalone:

```bash
npm run validate:links              # checks public/data/
npx concept-browser validate-links  # same, via CLI
```

## What is validated

### Concept cross-references (structural)

| Field | What's checked |
|-------|---------------|
| `gl:related[].gl:target` | Target concept URI must resolve to an existing concept JSON |
| `gl:related[].@id` | Same |
| `gl:references[].@id` | Same |
| `gl:partitiveRelations.gl:comprehensive` | Same |
| `gl:partitiveRelations.gl:hasPartitive[].gl:ref` | Same |
| `gl:genericRelations.gl:comprehensive` | Same |
| `gl:genericRelations.gl:hasMember[].gl:ref` | Same |

### Inline mentions (in definition/notes/examples text)

Every `{{kind:target}}` mention in text content is validated by kind:

| Kind | Syntax | Validation |
|------|--------|------------|
| `cite` | `{{cite:sourceId}}` | `sourceId` must exist in this concept's `sources[]` — this is for concept citations |
| `bib` | `{{bib:id}}` | `id` must exist in `bibliography.json`. Must NOT be a concept ID — if it matches a `sources[]` entry, the validator flags it as misuse (use `{{cite:...}}` instead) |
| `link` | `{{link:URL}}` | URL must be `http:` or `https:` |
| `image` | `{{image:src}}` | If local path, file must exist in `public/` |
| `urn` | `{{urn:URN}}` | Resolved via deployment routing (not build-time checked) |
| `numeric` | `{{17-21-004}}` | Concept must exist in same dataset |
| `designation` | `{{measurement unit}}` | Concept with that designation must exist in same dataset |

### `bib:` vs `cite:` — critical distinction

| | `{{bib:id}}` | `{{cite:id}}` |
|---|---|---|
| **What it references** | Bibliography entry — NOT a concept | ConceptSource — IS a concept |
| **Where it lives** | `bibliography.yaml` | Concept's `sources[]` array |
| **Use case** | Pure bibliographic records: papers, external documents that are NOT concepts in any dataset | Concept citations: IEV entries, ISO standards with concept IDs |
| **Example correct use** | `{{bib:iso704_doc, ISO 704:2022 §5.5.4}}` | `{{cite:iev-702-02-07, IEV 702-02-07}}` |
| **Example WRONG use** | `{{bib:702-02-07}}` — 702-02-07 IS an IEV concept | N/A — always correct for concept citations |

**Rule:** If the referenced thing IS a concept (IEV entry, ISO term, any dataset entry), use `{{cite:...}}`. `{{bib:...}}` is ONLY for non-concept documents.

## Data / Deployment boundary

Dataset authors write mentions as **deployment-agnostic data**. The deployment (site-config.yml) decides how each resolves at runtime:

| Mention | Data author decides | Deployment decides |
|---------|---|---|
| `{{cite:sourceId}}` | Which source to cite | Internal link (co-deployed), external link (routing), or flat text |
| `{{bib:id}}` | Which bibliography entry | Flat bib record with link, or plain text |
| `{{link:url}}` | The URL | Nothing — URL is canonical |
| `{{image:src}}` | The image path | basePath prefix for local images |
| `{{urn:URN}}` | The URN | Which dataset handles this URN |

**concept-browser never turns a non-concept mention into a concept page URI.** `bib:`, `link:`, `image:` are NOT concepts — they don't appear in `gl:references` and never produce concept page links.

## Resolution cascade (for `cite:` and `urn:` mentions)

At runtime, concept-browser walks this cascade:

1. **uriPatterns** — Is the target in a co-deployed dataset? → internal link
2. **routing[]** — Is there a routing entry in site-config.yml? → external link
3. **citation.link** — Does the source have a canonical link? → flat bib record
4. **unresolved** — plain text

The same `{{cite:iso704}}` renders differently depending on what's co-deployed. The data never changes.

## Fixing broken xrefs

When `validate-links` reports a broken link:

```
public/data/cie-2020/concepts/17-21-008.json
  field:   gl:related[].gl:target
  target:  https://www.glossarist.org/cie-eilv/cie-2011/concept/17-1367
  reason:  local target file missing: public/data/cie-2011/concepts/17-1367.json
```

**For concept cross-references:** the target concept doesn't exist in the dataset. Either:
- Add the missing concept YAML, OR
- Fix the ref in the source YAML (wrong ID), OR
- Remove the ref if it's intentionally dangling

**For `{{cite:sourceId}}`:** the sourceId doesn't match any `id` in the concept's `sources[]`. Fix the source list or the mention.

**For `{{bib:id}}`:** the id isn't in `bibliography.json` or `sources[]`. Add the bibliography entry or use `{{cite:...}}` if it's a source.

**For `{{image:src}}`:** the image file doesn't exist in `public/`. Add the file or fix the path.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | All xrefs valid |
| 1 | Broken xrefs found (build fails) |
| 2 | Data directory missing (run after generate-data) |
