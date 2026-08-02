#!/usr/bin/env node
/**
 * validate-yaml — validate dataset author YAML files against the
 * Glossarist concept JSON Schema.
 *
 * Usage:
 *   npx tsx scripts/validate-yaml.ts <path-to-yaml-or-dir>
 *   npx tsx scripts/validate-yaml.ts .datasets/my-vocab/concepts/
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { cwd } from 'node:process';
import yaml from 'js-yaml';

const SCHEMA_PATH = join(cwd(), 'data', 'concept-model', 'shapes', 'glossarist.concept.yaml.schema.json');

export interface ValidationError { path: string; message: string; }
export interface ValidationResult { valid: boolean; errors: ValidationError[]; }

export function loadSchema(): any {
  if (!existsSync(SCHEMA_PATH)) {
    throw new Error(`Schema not found: ${SCHEMA_PATH}`);
  }
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
}

export function validateValue(value: any, schema: any, path: string, rootSchema: any, errors: ValidationError[]): void {
  if (schema.$ref) {
    const ref = schema.$ref.replace(/^#\/\$defs\//, '');
    validateValue(value, rootSchema.$defs?.[ref] ?? {}, path, rootSchema, errors);
    return;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push({ path, message: `Expected array, got ${typeof value}` });
      return;
    }
    for (let i = 0; i < value.length; i++) {
      validateValue(value[i], schema.items ?? {}, `${path}[${i}]`, rootSchema, errors);
    }
    return;
  }
  if (schema.type && typeof value !== schema.type) {
    errors.push({ path, message: `Expected ${schema.type}, got ${typeof value}` });
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({ path, message: `"${value}" is not one of [${schema.enum.join(', ')}]` });
    return;
  }
  if (schema.type === 'object' && schema.properties) {
    for (const [key, subSchema] of Object.entries(schema.properties) as [string, any][]) {
      if (value[key] !== undefined) {
        validateValue(value[key], subSchema, `${path}.${key}`, rootSchema, errors);
      }
    }
    if (schema.required) {
      for (const req of schema.required) {
        if (!(req in value)) {
          errors.push({ path: `${path}.${req}`, message: `Missing required field: ${req}` });
        }
      }
    }
    if (schema.patternProperties) {
      for (const [pattern, subSchema] of Object.entries(schema.patternProperties) as [string, any][]) {
        const re = new RegExp(pattern);
        for (const key of Object.keys(value)) {
          if (re.test(key) && !(key in (schema.properties ?? {}))) {
            validateValue(value[key], subSchema, `${path}.${key}`, rootSchema, errors);
          }
        }
      }
    }
  }
  if (schema.type === 'array' && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      validateValue(value[i], schema.items ?? {}, `${path}[${i}]`, rootSchema, errors);
    }
  }
}

export function validateYaml(yamlContent: string, schema: any): ValidationResult {
  const data = yaml.load(yamlContent);
  const errors: ValidationError[] = [];
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      validateValue(data[i], schema, `doc[${i}]`, schema, errors);
    }
  } else if (data && typeof data === 'object') {
    validateValue(data, schema, 'root', schema, errors);
  } else {
    errors.push({ path: 'root', message: 'YAML must be an object or array of objects' });
  }
  return { valid: errors.length === 0, errors };
}

function walkYaml(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkYaml(full));
    else if (['.yaml', '.yml'].includes(extname(entry))) out.push(full);
  }
  return out;
}

function main(): void {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: validate-yaml <path-to-yaml-or-dir>');
    process.exit(1);
  }
  const schema = loadSchema();
  const resolvedTarget = resolve(target);
  if (!existsSync(resolvedTarget)) {
    console.error(`Path not found: ${resolvedTarget}`);
    process.exit(1);
  }
  const files = statSync(resolvedTarget).isDirectory() ? walkYaml(resolvedTarget) : [resolvedTarget];
  let totalValid = 0;
  let totalErrors = 0;
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const result = validateYaml(content, schema);
    if (result.valid) {
      totalValid++;
    } else {
      totalErrors += result.errors.length;
      console.error(`FAIL: ${file}`);
      for (const err of result.errors) console.error(`  ${err.path}: ${err.message}`);
    }
  }
  console.log(`\n${totalValid}/${files.length} files valid, ${totalErrors} errors`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPathPath();
function fileURLToPathPath(): string {
  return resolve(new URL(import.meta.url).pathname);
}

if (isDirect) main();
