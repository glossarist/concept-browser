import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PUBLIC_DATA = path.resolve(__dirname, '../../public/data');

describe('Data integrity', () => {
  const datasets = ['iev', 'isotc211', 'isotc204', 'osgeo'];

  it('has datasets.json at root', () => {
    const file = path.resolve(PUBLIC_DATA, '..', 'datasets.json');
    expect(fs.existsSync(file)).toBe(true);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(data.length).toBe(4);
    expect(data.map((d: any) => d.id).sort()).toEqual(['iev', 'isotc204', 'isotc211', 'osgeo']);
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

        // Every summary has required fields
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

        // Check first, middle, and last concept
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

  describe('IEV specific', () => {
    it('has all 22,228 concepts', () => {
      const idx = JSON.parse(fs.readFileSync(path.join(PUBLIC_DATA, 'iev', 'index.json'), 'utf8'));
      expect(idx.conceptCount).toBe(22228);
    });

    it('has 45 index chunks', () => {
      const idx = JSON.parse(fs.readFileSync(path.join(PUBLIC_DATA, 'iev', 'index.json'), 'utf8'));
      expect(idx.chunks.length).toBe(45);
    });
  });

  describe('TC 211 specific', () => {
    it('has all 1,302 concepts', () => {
      const idx = JSON.parse(fs.readFileSync(path.join(PUBLIC_DATA, 'isotc211', 'index.json'), 'utf8'));
      expect(idx.conceptCount).toBe(1302);
    });
  });

  describe('TC 204 specific', () => {
    it('has all 312 concepts', () => {
      const idx = JSON.parse(fs.readFileSync(path.join(PUBLIC_DATA, 'isotc204', 'index.json'), 'utf8'));
      expect(idx.conceptCount).toBe(312);
    });
  });

  describe('OSGeo specific', () => {
    it('has all 444 concepts', () => {
      const idx = JSON.parse(fs.readFileSync(path.join(PUBLIC_DATA, 'osgeo', 'index.json'), 'utf8'));
      expect(idx.conceptCount).toBe(444);
    });
  });
});
