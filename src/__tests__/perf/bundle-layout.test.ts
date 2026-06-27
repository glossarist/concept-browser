import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = 'dist';
const ASSETS_DIR = join(DIST_DIR, 'assets');

function distExists(): boolean {
  return existsSync(ASSETS_DIR);
}

function readAsset(name: string): string {
  return readFileSync(join(ASSETS_DIR, name), 'utf8');
}

function listJsAssets(): string[] {
  return readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'));
}

const MAIN_CHUNK_RE = /^index-[^/]*\.js$/;
const CONCEPT_CHUNK_RE = /^ConceptView-[^/]*\.js$/;

describe.skipIf(!distExists())('bundle: RDF serializer stays out of main chunk', () => {
  it('the main index-* chunk does not embed the RDF emitter', () => {
    const mainChunks = listJsAssets().filter(f => MAIN_CHUNK_RE.test(f));
    expect(mainChunks.length).toBeGreaterThan(0);

    for (const chunk of mainChunks) {
      const text = readAsset(chunk);
      expect(text, `${chunk} should not embed use-rdf-document`).not.toMatch(/use-rdf-document/);
      expect(text, `${chunk} should not emit skosxl:literalForm literals`).not.toMatch(/skosxl:literalForm/);
    }
  });

  it('the ConceptView chunk DOES contain the RDF emitter', () => {
    const conceptChunks = listJsAssets().filter(f => CONCEPT_CHUNK_RE.test(f));
    expect(conceptChunks.length).toBeGreaterThan(0);

    const merged = conceptChunks.map(readAsset).join('\n');
    expect(merged).toMatch(/skosxl:literalForm/);
  });

  it('no chunk emits the legacy `xl:` prefix', () => {
    for (const chunk of listJsAssets()) {
      const text = readAsset(chunk);
      expect(text, `${chunk} should not contain the legacy xl: prefix`).not.toMatch(/\bxl:prefLabel/);
      expect(text, `${chunk} should not contain the legacy xl:altLabel/`).not.toMatch(/\bxl:altLabel/);
    }
  });
});
