// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('generate-data standards index', () => {
  it('emits unique authoritative standards per register and preserves source stats', () => {
    const root = mkdtempSync(join(tmpdir(), 'generate-data-standards-'));
    const conceptsDir = join(root, 'source', 'concepts');
    const outputDir = join(root, 'public', 'data', 'fixture');
    const configPath = join(root, 'site-config.yml');
    const generator = resolve('scripts/generate-data.ts');
    const tsx = resolve('node_modules/tsx/dist/loader.mjs');

    try {
      mkdirSync(conceptsDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify({
        id: 'fixture', title: 'Fixture', uri_base: 'https://example.test',
        datasets: [{ id: 'fixture', local_path: 'source', languages: ['eng', 'fra'] }],
      }));
      const writeConcept = (id: string, sources: unknown[], engSources: unknown[] = []) => {
        writeFileSync(join(conceptsDir, `${id}.yaml`), JSON.stringify({
          termid: id,
          _sources: sources,
          eng: {
            terms: [{ designation: `Fixture term ${id}` }],
            sources: engSources,
          },
        }));
      };
      writeConcept('1', [
        { type: 'authoritative', origin: { ref: { source: 'ISO', id: '19165-2:2020', clause: '3.1' } } },
        { type: 'authoritative', origin: { ref: { source: 'ISO', id: '19165-2:2020', clause: '4.2' } } },
        { type: 'authoritative', origin: { ref: { source: 'IEC', id: '17000:2020' } } },
        { type: 'lineage', origin: { ref: { source: 'ISO', id: '704:2022' } } },
      ], [
        { type: 'authoritative', origin: { ref: { source: 'iso', id: '19165-2:2020', clause: '5.1' } } },
      ]);
      writeConcept('2', [
        { type: 'authoritative', origin: { ref: { source: ' ISO ', id: ' 19165-2:2020 ', clause: '6.3' } } },
      ]);
      writeConcept('3', [
        { type: 'lineage', origin: { ref: { source: 'ISO', id: '999:2020' } } },
      ], [
        { type: 'authoritative', origin: { ref: { source: 'ISO', id: '1087:2019' } } },
      ]);

      execFileSync(process.execPath, ['--import', tsx, generator], {
        cwd: root,
        env: { ...process.env, SITE_CONFIG: configPath },
        stdio: 'pipe',
        timeout: 30_000,
      });

      const standards = JSON.parse(readFileSync(join(outputDir, 'standards.json'), 'utf8'));
      expect(standards).toEqual({
        'iso 19165-2:2020': { label: 'ISO 19165-2:2020', conceptIds: ['1', '2'] },
        'iec 17000:2020': { label: 'IEC 17000:2020', conceptIds: ['1'] },
        'iso 1087:2019': { label: 'ISO 1087:2019', conceptIds: ['3'] },
      });

      const stats = JSON.parse(readFileSync(join(outputDir, 'stats.json'), 'utf8'));
      expect(stats.sourceCount).toBe(4);
      expect(stats.sources).toEqual(expect.arrayContaining([
        expect.objectContaining({ ref: 'ISO', conceptCount: 2, conceptIds: ['1', '3'] }),
        expect.objectContaining({ ref: 'IEC', conceptCount: 1, conceptIds: ['1'] }),
      ]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
