// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface Chunk {
  file: string;
  count: number;
  hash: string;
}

describe('generate-data chunk hashes', () => {
  it('writes content hashes to both indexes and changes only the hash of modified chunks', () => {
    const root = mkdtempSync(join(tmpdir(), 'generate-data-hashes-'));
    const conceptsDir = join(root, 'source', 'concepts');
    const outputDir = join(root, 'public', 'data', 'fixture');
    const configPath = join(root, 'site-config.yml');
    const generator = resolve('scripts/generate-data.ts');
    const tsx = resolve('node_modules/tsx/dist/loader.mjs');

    const writeConcept = (id: number, designation: string) => {
      writeFileSync(join(conceptsDir, `${id}.yaml`), JSON.stringify({
        termid: String(id),
        eng: { terms: [{ designation }], entry_status: 'valid' },
      }));
    };
    const generate = () => {
      execFileSync(process.execPath, ['--import', tsx, generator], {
        cwd: root,
        env: { ...process.env, SITE_CONFIG: configPath },
        stdio: 'pipe',
        // Three sequential full generations run in this test; each
        // subprocess pays tsx startup, worker-pool spin-up, and aggregate
        // emission. The suite runs tests in parallel, so leave generous
        // headroom for CPU contention.
        timeout: 120_000,
      });
      const indexes = ['index.json', 'index-meta.json'].map(file =>
        JSON.parse(readFileSync(join(outputDir, file), 'utf8')),
      );
      for (const index of indexes) {
        expect(index.conceptCount).toBe(501);
        expect(index.chunks.map((chunk: Chunk) => chunk.count)).toEqual([500, 1]);
        for (const chunk of index.chunks as Chunk[]) {
          expect(chunk.hash).toMatch(/^[a-f0-9]{12}$/);
          const content = readFileSync(join(outputDir, 'chunks', chunk.file));
          expect(chunk.hash).toBe(createHash('sha256').update(content).digest('hex').slice(0, 12));
        }
      }
      expect(indexes[1].chunks).toEqual(indexes[0].chunks);
      return indexes[0].chunks as Chunk[];
    };

    try {
      mkdirSync(conceptsDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify({
        id: 'fixture', title: 'Fixture', uri_base: 'https://example.test',
        datasets: [{ id: 'fixture', local_path: 'source', languages: ['eng'] }],
      }));
      for (let id = 1; id <= 501; id++) writeConcept(id, `Term ${id}`);

      const initial = generate();
      expect(generate()).toEqual(initial);

      writeConcept(1, 'Updated term');
      const changed = generate();
      expect(changed[0]!.hash).not.toBe(initial[0]!.hash);
      expect(changed[1]).toEqual(initial[1]);
      const chunk = JSON.parse(readFileSync(join(outputDir, 'chunks', changed[0]!.file), 'utf8'));
      expect(chunk.concepts[0].designations.eng).toBe('Updated term');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 300_000);
});
