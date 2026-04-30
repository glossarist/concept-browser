# Status: DONE

# 05 — Update scripts/generate-data.mjs

## Context

`generate-data.mjs` has hardcoded paths (lines 11-13), hardcoded cross-ref maps (lines 17-19), and format-variant handling (bare strings in `defsToJsonLd`, inline text scanning in `extractInlineRefs`). Must read from `datasets.yml` + `.datasets/` and handle only the canonical format.

## Task

### Remove

- Hardcoded `IEV_DIR`, `TC211_DIR`, `TC204_DIR` constants (lines 11-13)
- Hardcoded `REF_PREFIX_MAP` and `URN_STANDARD_MAP` (lines 17-19) — inline refs are pre-extracted during harmonization
- Hardcoded `DATASETS` array (lines 309-346)
- Format-variant handling in `defsToJsonLd()` (line 57: `typeof defs === 'string' ? [...] : defs`)
- Format-variant handling in `extractInlineRefs()` (lines 86-91: bare string normalization)
- The entire `extractInlineRefs()` function — references are pre-extracted as `gl:references` during harmonization

### Add

- Read `datasets.yml` for dataset list and configuration
- Read `.datasets/{id}/register.yaml` for metadata (title, description, languages)
- Resolve source dirs from `.datasets/{id}/concepts/` or `DATASET_SOURCE_{ID}` env var
- Merge metadata: `datasets.yml` overrides → `register.yaml` → defaults
- Simplify `defsToJsonLd()` to assume array-of-objects format only

### Keep unchanged

- All JSON-LD conversion logic (`yamlToJsonLd`, `termToDesignation`, `sourcesToJsonLd`)
- `processDataset()` flow (chunking, manifest generation)
- `DS_PALETTE` fallback (used when no color in datasets.yml)

### Simplified `defsToJsonLd`

```js
function defsToJsonLd(defs) {
  if (!defs || !Array.isArray(defs)) return [];
  return defs
    .map(d => ({
      '@type': 'gl:DetailedDefinition',
      'gl:content': d.content || '',
    }))
    .filter(d => d['gl:content']);
}
```

### Main loop reads from datasets.yml

```js
import datasetsConfig from './datasets.yml' with { type: 'yaml' }; // or parse at runtime

for (const ds of datasetsConfig.datasets) {
  const dir = process.env[`DATASET_SOURCE_${ds.id.toUpperCase()}`]
    || path.join(ROOT, '.datasets', ds.id, 'concepts');
  if (!fs.existsSync(dir)) {
    console.warn(`Skipping ${ds.id}: source not found (${dir})`);
    continue;
  }
  // Read register.yaml for metadata
  const registerYaml = readYaml(path.join(ROOT, '.datasets', ds.id, 'register.yaml'));
  processDataset(dir, ds.id, {
    title: ds.title || registerYaml.name,
    description: ds.description || registerYaml.description,
    owner: ds.owner,
    languages: ds.languages || Object.keys(registerYaml.subregisters || {}),
    color: ds.color || DS_PALETTE[idx % DS_PALETTE.length],
    sourceRepo: ds.sourceRepo,
    existingSiteUrl: ds.existingSiteUrl,
    tags: ds.tags,
  });
}
```

## Files

- Modify: `scripts/generate-data.mjs`

## Verification

- `npm run generate-data` works with datasets from `.datasets/`
- `npm run generate-data` works with `DATASET_SOURCE_IEV` env var
- No hardcoded dataset paths remain
- `defsToJsonLd` does not handle bare strings
- `extractInlineRefs` removed
- All 4 datasets generate successfully (iev, isotc211, isotc204, osgeo)
