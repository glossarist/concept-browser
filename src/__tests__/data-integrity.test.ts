import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PUBLIC_DATA = path.resolve(__dirname, '../../public/data');
const DATASETS_JSON = path.resolve(PUBLIC_DATA, '..', 'datasets.json');

const hasData = fs.existsSync(DATASETS_JSON);
const datasets: string[] = hasData
  ? JSON.parse(fs.readFileSync(DATASETS_JSON, 'utf8')).map((d: any) => d.id)
  : [];

describe.skipIf(!hasData || datasets.length === 0)('Data integrity', () => {
  it('has valid datasets.json', () => {
    const data = JSON.parse(fs.readFileSync(DATASETS_JSON, 'utf8'));
    expect(data.length).toBeGreaterThan(0);
    for (const d of data) {
      expect(d.id).toBeTruthy();
      expect(d.manifestUrl).toBeTruthy();
    }
  });

  for (const ds of datasets) {
    describe(`${ds}`, () => {
      const dsDir = path.join(PUBLIC_DATA, ds);

      it('has manifest.json with required fields', () => {
        const file = path.join(dsDir, 'manifest.json');
        expect(fs.existsSync(file)).toBe(true);
        const m = JSON.parse(fs.readFileSync(file, 'utf8'));
        expect(m.id).toBe(ds);
        expect(m.title).toBeTruthy();
        expect(m.conceptCount).toBeGreaterThan(0);
        expect(m.languages.length).toBeGreaterThan(0);
        expect(m.chunkSize).toBe(500);
        expect(m.baseUrl).toBe(`/data/${ds}`);
      });

      it('has index.json with valid summary entries', () => {
        const file = path.join(dsDir, 'index.json');
        expect(fs.existsSync(file)).toBe(true);
        const idx = JSON.parse(fs.readFileSync(file, 'utf8'));
        expect(idx.registerId).toBe(ds);
        expect(idx.conceptCount).toBe(idx.concepts.length);
        expect(idx.chunkSize).toBe(500);
        expect(idx.chunks.length).toBeGreaterThan(0);

        for (const c of idx.concepts) {
          expect(c.id).toBeTruthy();
          expect(typeof c.eng).toBe('string');
          expect(c.status).toBeTruthy();
        }
      });

      it('concept count matches files on disk', () => {
        const conceptsDir = path.join(dsDir, 'concepts');
        expect(fs.existsSync(conceptsDir)).toBe(true);
        const files = fs.readdirSync(conceptsDir).filter(f => f.endsWith('.json'));
        const idx = JSON.parse(fs.readFileSync(path.join(dsDir, 'index.json'), 'utf8'));
        expect(files.length).toBe(idx.conceptCount);
      });

      it('sample concepts are valid JSON-LD', () => {
        const conceptsDir = path.join(dsDir, 'concepts');
        const files = fs.readdirSync(conceptsDir).filter(f => f.endsWith('.json'));

        const samples = [
          files[0],
          files[Math.floor(files.length / 2)],
          files[files.length - 1],
        ];

        for (const file of samples) {
          const data = JSON.parse(fs.readFileSync(path.join(conceptsDir, file), 'utf8'));
          expect(data['@context']).toBe('https://glossarist.org/ns/context.jsonld');
          expect(data['@id']).toContain(`/concept/`);
          expect(data['@type']).toBe('gl:Concept');
          expect(data['gl:identifier']).toBeTruthy();
          expect(data['gl:localizedConcept']).toBeTruthy();
          expect(Object.keys(data['gl:localizedConcept']).length).toBeGreaterThan(0);
        }
      });

      it('index chunk files exist and have correct counts', () => {
        const idx = JSON.parse(fs.readFileSync(path.join(dsDir, 'index.json'), 'utf8'));
        const chunksDir = path.join(dsDir, 'chunks');
        expect(fs.existsSync(chunksDir)).toBe(true);

        let totalFromChunks = 0;
        for (const chunk of idx.chunks) {
          const chunkFile = path.join(chunksDir, chunk.file);
          expect(fs.existsSync(chunkFile)).toBe(true);
          const chunkData = JSON.parse(fs.readFileSync(chunkFile, 'utf8'));
          expect(chunkData.concepts.length).toBe(chunk.count);
          totalFromChunks += chunk.count;
        }
        expect(totalFromChunks).toBe(idx.conceptCount);
      });
    });
  }
});
