# Status: DONE

# 10 — Glossarist Gem: upgrade, package, validate Commands

## Context

The glossarist-ruby gem (`/Users/mulgogi/src/glossarist/glossarist-ruby/`) currently has only `generate_latex`. Three new commands are needed to support the GCR workflow. This is a **separate repo and separate effort** from the browser.

Reference implementations from `lutaml-xsd`:
- `schema_repository_package.rb` — ZIP read/write logic
- `package_builder.rb` — serialization orchestration
- `schema_repository_metadata.rb` — metadata model with extensibility
- `package_configuration.rb` — strategy configuration
- `commands/package_command.rb` — CLI build/validate/info commands

## Task

### `glossarist harmonize <source_dir> -o <output_dir>`

Reads a source concept repository (any format variant), normalizes to canonical format.

Harmonization rules (from `docs/dataset-schema.md`):
- Definitions: bare string → `[{content: "text"}]`
- Sources: `authoritative_source` → `sources` array
- Dates: scalar → `dates` array
- Entry status: `"Standard"` → `"valid"`
- Terms: `abbrev: true` → `type: abbreviation`
- Inline refs: `{{term, IEV:xxx}}` → structured `references`
- `_revisions`: stripped
- `termid`: cast to string

### `glossarist package <harmonized_dir> -o <output.gcr>`

Creates a `.gcr` ZIP file:
1. Read harmonized YAML directory
2. Generate `metadata.yaml` (from `register.yaml` + computed statistics)
3. Compute statistics (concept count, languages, concepts with definitions/sources)
4. Assemble ZIP with `metadata.yaml`, `register.yaml`, `concepts/*.yaml`

### `glossarist validate <path>`

Validates a source directory or `.gcr` file:
- `metadata.yaml` exists and parses
- `concepts/` directory with ≥1 YAML file
- Each concept has `termid` (string)
- Each concept has ≥1 language block with ≥1 term
- No duplicate `termid` values
- Format compliance (canonical format rules)
- Cross-reference integrity (optional)

### Implementation approach

1. Add `Glossarist::CLI` Thor commands in `lib/glossarist/cli.rb`
2. Add `Glossarist::Package` module with `GcrPackage`, `GcrMetadata`, `GcrBuilder` classes
3. Use `rubyzip` gem for ZIP creation/extraction
4. Reuse `ManagedConceptCollection.load_from_files()` for reading concepts
5. Statistics computed from loaded collection

## Files (in glossarist-ruby repo)

- Modify: `lib/glossarist/cli.rb`
- Create: `lib/glossarist/package/`
- Create: `lib/glossarist/package/gcr_package.rb`
- Create: `lib/glossarist/package/gcr_metadata.rb`
- Create: `lib/glossarist/package/gcr_builder.rb`
- Modify: `glossarist.gemspec` — add `rubyzip` dependency

## Verification

- `glossarist harmonize` produces canonical YAML from any source format
- `glossarist package` creates a valid `.gcr` file
- `glossarist validate` catches format violations
- Browser pipeline can read `.gcr` output
