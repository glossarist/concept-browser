/**
 * End-to-end consumer simulation test.
 *
 * Simulates what a real consumer experiences: creates a temp "consumer
 * project" with the compiled package in node_modules, then runs scripts
 * with plain node. Catches packaging bugs that dev-mode tests miss.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync, writeFileSync, cpSync, rmSync, existsSync, readFileSync, readdirSync,
} from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const SCRIPTS_DIR = join(ROOT, 'scripts');
const CONSUMER_DIR = join(ROOT, '.tmp-consumer-test');

describe('end-to-end consumer simulation — compiled package works under plain node', () => {
  beforeAll(() => {
    const build = spawnSync('node', [join(ROOT, 'scripts', 'build-scripts.mjs')], {
      encoding: 'utf8', cwd: ROOT,
    });
    expect(build.status).toBe(0);

    rmSync(CONSUMER_DIR, { recursive: true, force: true });
    const pkgDest = join(CONSUMER_DIR, 'node_modules', '@glossarist', 'concept-browser');
    mkdirSync(pkgDest, { recursive: true });
    cpSync(join(ROOT, 'scripts'), join(pkgDest, 'scripts'), { recursive: true });
    cpSync(join(ROOT, 'data'), join(pkgDest, 'data'), { recursive: true });
    cpSync(join(ROOT, 'cli'), join(pkgDest, 'cli'), { recursive: true });
    writeFileSync(join(pkgDest, 'package.json'), JSON.stringify({
      name: '@glossarist/concept-browser', version: '0.0.0-test', type: 'module',
      bin: { 'concept-browser': './cli/index.mjs' },
    }));
  }, 60000);

  afterAll(() => {
    rmSync(CONSUMER_DIR, { recursive: true, force: true });
  });

  it('compiled scripts can find package data files from node_modules location', () => {
    const scriptDir = join(CONSUMER_DIR, 'node_modules', '@glossarist', 'concept-browser', 'scripts');
    const pathFromBundled = join(scriptDir, '..', 'data', 'glossarist-vocab.json');
    expect(existsSync(pathFromBundled)).toBe(true);
  });

  it('compiled scripts list matches source scripts (no missing outputs)', () => {
    const sourceTs = readdirSync(SCRIPTS_DIR)
      .filter(f => f.endsWith('.ts') && !f.includes('__tests__') && f !== 'smoke.ts')
      .map(f => f.replace(/\.ts$/, ''));
    const compiledJs = readdirSync(SCRIPTS_DIR)
      .filter(f => f.endsWith('.js'))
      .map(f => f.replace(/\.js$/, ''));
    for (const name of sourceTs) {
      expect(compiledJs).toContain(name);
    }
  });

  it('validate-yaml.js validates against the shipped schema from node_modules', () => {
    const consumerPkg = join(CONSUMER_DIR, 'node_modules', '@glossarist', 'concept-browser');
    const scriptPath = join(consumerPkg, 'scripts', 'validate-yaml.js');
    const schemaPath = join(consumerPkg, 'data', 'concept-model', 'shapes', 'glossarist.concept.yaml.schema.json');
    const code = [
      'import { validateYaml } from ' + JSON.stringify(scriptPath) + ';',
      'import { readFileSync } from "fs";',
      'const schema = JSON.parse(readFileSync(' + JSON.stringify(schemaPath) + ', "utf8"));',
      'const r = validateYaml("termid: test", schema);',
      'console.log("valid=" + r.valid);',
    ].join('\n');
    const result = spawnSync('node', ['--input-type=module', '-e', code], {
      encoding: 'utf8', cwd: ROOT,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('valid=true');
  });

  it('no compiled script references a devDependency-only package', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const deps = new Set(Object.keys(pkg.dependencies || {}));
    const devDeps = new Set(Object.keys(pkg.devDependencies || {}));
    const violations: string[] = [];
    for (const file of readdirSync(SCRIPTS_DIR).filter(f => f.endsWith('.js'))) {
      const src = readFileSync(join(SCRIPTS_DIR, file), 'utf8');
      const importRe = new RegExp('(?:from\\s+|import\\s*\\(\\s*)["\']([^"\'./@][^"\']*)["\']', 'g');
      let m;
      while ((m = importRe.exec(src)) !== null) {
        const name = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
        if (name.startsWith('node:') || name === 'node') continue;
        if (devDeps.has(name) && !deps.has(name)) violations.push(file + ' -> ' + name);
      }
    }
    expect(violations).toEqual([]);
  });
});
