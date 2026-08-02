import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateYaml } from '../../../scripts/validate-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '..', '..', '..', 'data', 'concept-model', 'shapes', 'glossarist.concept.yaml.schema.json');
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

describe('validate-yaml', () => {
  it('accepts a valid concept with termid and localization', () => {
    const yaml = `
termid: '1'
eng:
  terms:
    - designation: measurement unit
      normative_status: preferred
  definition:
    - content: A concept used as a basis for comparison.
`;
    const result = validateYaml(yaml, schema);
    if (!result.valid) console.log('Errors:', result.errors);
    expect(result.valid).toBe(true);
  });

  it('rejects a concept without termid', () => {
    const yaml = `
eng:
  terms:
    - designation: missing id
`;
    const result = validateYaml(yaml, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('termid'))).toBe(true);
  });

  it('accepts managed concept format with underscore fields', () => {
    const yaml = `
termid: '5'
_domains:
  - physics
_status: valid
`;
    const result = validateYaml(yaml, schema);
    if (!result.valid) console.log('Errors:', result.errors);
    expect(result.valid).toBe(true);
  });

  it('accepts partitive relations with MECE axes', () => {
    const yaml = `
termid: '3'
_partitiveRelations:
  - type: hasPart
    members:
      - ref: part-a
        presence: required
        count: exactly_one
`;
    const result = validateYaml(yaml, schema);
    if (!result.valid) console.log('Errors:', result.errors);
    expect(result.valid).toBe(true);
  });

  it('rejects non-string termid', () => {
    const yaml = `
termid: 12345
eng:
  terms:
    - designation: test
`;
    const result = validateYaml(yaml, schema);
    expect(result.valid).toBe(false);
  });
});

