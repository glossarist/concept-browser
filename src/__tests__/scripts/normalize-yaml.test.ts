import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeYaml } from '../../../scripts/normalize-yaml.mjs';

const NFC_STRING = 'café';
const NON_NFC_STRING = 'café';

function makeTempDataset() {
  const dir = mkdtempSync(join(tmpdir(), 'glossarist-nfc-'));
  return dir;
}

describe('normalizeYaml', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDataset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('detects non-NFC YAML files in check mode without modifying them', () => {
    const file = join(dir, 'concept.yaml');
    writeFileSync(file, `term: "${NON_NFC_STRING}"\n`, 'utf8');

    const { checked, nonNfc, fixed, check } = normalizeYaml({ root: dir, check: true, paths: ['.'] });

    expect(checked).toBe(1);
    expect(nonNfc).toBe(1);
    expect(fixed).toHaveLength(1);
    expect(check).toBe(true);

    const after = readFileSync(file, 'utf8');
    expect(after).toContain(NON_NFC_STRING);
    expect(after).not.toContain(NFC_STRING);
  });

  it('normalizes non-NFC YAML files in fix mode', () => {
    const file = join(dir, 'concept.yaml');
    writeFileSync(file, `term: "${NON_NFC_STRING}"\n`, 'utf8');

    const { checked, nonNfc, fixed } = normalizeYaml({ root: dir, check: false, paths: ['.'] });

    expect(checked).toBe(1);
    expect(nonNfc).toBe(1);
    expect(fixed).toHaveLength(1);

    const after = readFileSync(file, 'utf8');
    expect(after).toContain(NFC_STRING);
    expect(after).not.toContain(NON_NFC_STRING);
  });

  it('passes through already-NFC files without changes', () => {
    writeFileSync(join(dir, 'a.yaml'), `term: "${NFC_STRING}"\n`, 'utf8');
    writeFileSync(join(dir, 'b.yaml'), `term: "hello"\n`, 'utf8');

    const { checked, nonNfc, fixed } = normalizeYaml({ root: dir, check: true, paths: ['.'] });

    expect(checked).toBe(2);
    expect(nonNfc).toBe(0);
    expect(fixed).toHaveLength(0);
  });

  it('walks subdirectories recursively', () => {
    const subDir = join(dir, 'concepts', 'sub');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, 'deep.yaml'), `text: "${NON_NFC_STRING}"\n`, 'utf8');
    writeFileSync(join(dir, 'top.yaml'), `text: "ok"\n`, 'utf8');

    const { checked, nonNfc } = normalizeYaml({ root: dir, check: true, paths: ['.'] });

    expect(checked).toBe(2);
    expect(nonNfc).toBe(1);
  });

  it('skips node_modules and dist directories', () => {
    mkdirSync(join(dir, 'node_modules'), { recursive: true });
    mkdirSync(join(dir, 'dist'), { recursive: true });
    writeFileSync(join(dir, 'node_modules', 'dep.yaml'), `x: "${NON_NFC_STRING}"\n`, 'utf8');
    writeFileSync(join(dir, 'dist', 'out.yaml'), `x: "${NON_NFC_STRING}"\n`, 'utf8');
    writeFileSync(join(dir, 'good.yaml'), `x: "${NFC_STRING}"\n`, 'utf8');

    const { checked, nonNfc } = normalizeYaml({ root: dir, check: true, paths: ['.'] });

    expect(checked).toBe(1);
    expect(nonNfc).toBe(0);
  });

  it('handles empty or nonexistent search directories gracefully', () => {
    const result = normalizeYaml({ root: '/nonexistent/path', check: true });
    expect(result.checked).toBe(0);
    expect(result.nonNfc).toBe(0);
  });
});
