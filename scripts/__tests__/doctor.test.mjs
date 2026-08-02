import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runDoctor, formatResults, CHECKS, NODE_MIN_MAJOR } from '../doctor';

function makeTmpProject() {
  const dir = mkdtempSync(join(tmpdir(), 'doctor-'));
  return dir;
}

function writeDatasetsYml(root, ids) {
  const entries = ids.map((id) => `  - id: ${id}\n    title: "${id}"\n    sourceRepo: "https://example.com/${id}"`).join('\n');
  writeFileSync(join(root, 'datasets.yml'), `datasets:\n${entries}\n`);
}

function stubGenerated(root, ids) {
  for (const id of ids) {
    mkdirSync(join(root, 'public', 'data', id), { recursive: true });
    writeFileSync(join(root, 'public', 'data', id, 'manifest.json'), '{}');
  }
  writeFileSync(join(root, 'public', 'datasets.json'), JSON.stringify(ids.map((id) => ({ id }))));
}

function stubFetched(root, ids) {
  for (const id of ids) {
    mkdirSync(join(root, '.datasets', id, 'concepts'), { recursive: true });
  }
}

describe('doctor — unit checks', () => {
  it('exposes NODE_MIN_MAJOR as a positive integer', () => {
    expect(NODE_MIN_MAJOR).toBeGreaterThanOrEqual(18);
    expect(Number.isInteger(NODE_MIN_MAJOR)).toBe(true);
  });

  it('registers exactly eight independent checks', () => {
    expect(CHECKS).toHaveLength(8);
    const ids = CHECKS.map((c) => c.name ?? c.toString());
    expect(new Set(ids).size).toBe(8);
  });
});

describe('doctor — runDoctor on synthetic projects', () => {
  let root;

  beforeEach(() => {
    root = makeTmpProject();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('fails on missing datasets.yml', async () => {
    const { results } = await runDoctor(root);
    const ymlCheck = results.find((r) => r.id === 'datasets-yml');
    expect(ymlCheck.status).toBe('warn');
  });

  it('fails on malformed datasets.yml', async () => {
    writeFileSync(join(root, 'datasets.yml'), 'datasets: [this is broken');
    const { results, exitCode } = await runDoctor(root);
    const ymlCheck = results.find((r) => r.id === 'datasets-yml');
    expect(ymlCheck.status).toBe('fail');
    expect(exitCode).toBe(1);
  });

  it('passes datasets-yml when the file parses and lists entries', async () => {
    writeDatasetsYml(root, ['foo', 'bar']);
    const { results } = await runDoctor(root);
    const ymlCheck = results.find((r) => r.id === 'datasets-yml');
    expect(ymlCheck.status).toBe('pass');
    expect(ymlCheck.label).toContain('2 dataset(s)');
  });

  it('fails when registered datasets are not fetched', async () => {
    writeDatasetsYml(root, ['foo']);
    const { results, exitCode } = await runDoctor(root);
    const fetched = results.find((r) => r.id === 'datasets-fetched');
    expect(fetched.status).toBe('fail');
    expect(fetched.detail).toContain('foo');
    expect(exitCode).toBe(1);
  });

  it('passes when registered datasets exist under .datasets/{id}/concepts', async () => {
    writeDatasetsYml(root, ['foo']);
    stubFetched(root, ['foo']);
    const { results } = await runDoctor(root);
    const fetched = results.find((r) => r.id === 'datasets-fetched');
    expect(fetched.status).toBe('pass');
  });

  it('fails when public/data manifest is missing', async () => {
    writeDatasetsYml(root, ['foo']);
    stubFetched(root, ['foo']);
    const { results, exitCode } = await runDoctor(root);
    const gen = results.find((r) => r.id === 'datasets-generated');
    expect(gen.status).toBe('fail');
    expect(gen.detail).toContain('foo');
    expect(exitCode).toBe(1);
  });

  it('passes when manifests are present', async () => {
    writeDatasetsYml(root, ['foo']);
    stubFetched(root, ['foo']);
    stubGenerated(root, ['foo']);
    const { results } = await runDoctor(root);
    const gen = results.find((r) => r.id === 'datasets-generated');
    expect(gen.status).toBe('pass');
  });

  it('fails when public/datasets.json is missing', async () => {
    writeDatasetsYml(root, ['foo']);
    stubFetched(root, ['foo']);
    mkdirSync(join(root, 'public', 'data', 'foo'), { recursive: true });
    writeFileSync(join(root, 'public', 'data', 'foo', 'manifest.json'), '{}');
    const { results, exitCode } = await runDoctor(root);
    const j = results.find((r) => r.id === 'public-datasets-json');
    expect(j.status).toBe('fail');
    expect(exitCode).toBe(1);
  });

  it('does not crash when datasets.yml lists zero datasets', async () => {
    writeFileSync(join(root, 'datasets.yml'), 'datasets: []\n');
    const { results } = await runDoctor(root);
    const ymlCheck = results.find((r) => r.id === 'datasets-yml');
    expect(ymlCheck.status).toBe('warn');
  });
});

describe('doctor — formatting', () => {
  it('renders a pass/fail/warn glyph per result and a summary line', () => {
    const out = formatResults([
      { id: 'a', label: 'A is good', status: 'pass' },
      { id: 'b', label: 'B is broken', status: 'fail', detail: 'because', hint: 'fix it' },
      { id: 'c', label: 'C is suspect', status: 'warn' },
    ]);
    expect(out).toContain('✓ A is good');
    expect(out).toContain('✗ B is broken');
    expect(out).toContain('    because');
    expect(out).toContain('→ fix it');
    expect(out).toContain('! C is suspect');
    expect(out).toMatch(/1 passed, 1 failed, 1 warnings \(3 total\)/);
  });
});
