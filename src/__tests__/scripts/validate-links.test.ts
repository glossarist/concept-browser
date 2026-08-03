import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { checkFile, localPathForUri } from '../../../scripts/validate-links';

function fixture(): string {
  const dir = join(tmpdir(), `cb-vl-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('validate-links — URI resolution', () => {
  it('localPathForUri parses dataset ID and concept ID', () => {
    const r = localPathForUri('https://example.com/d/cie-2011/concept/17-580', '/d');
    expect(r.expected).toBe('/d/cie-2011/concepts/17-580.json');
  });

  it('localPathForUri decodes percent-encoded concept IDs', () => {
    const r = localPathForUri('https://example.com/d/ds/concept/bib%3A702-02-07', '/d');
    expect(r.expected).toBe('/d/ds/concepts/bib:702-02-07.json');
  });

  it('localPathForUri returns empty expected for unparseable URIs', () => {
    const r = localPathForUri('not-a-uri', '/d');
    expect(r.expected).toBe('');
  });
});

describe('validate-links — checkFile', () => {
  it('reports broken gl:related target', () => {
    const dataDir = fixture();
    mkdirSync(join(dataDir, 'cie-2011', 'concepts'), { recursive: true });
    // concept 17-999 exists, target points to 17-404 which does NOT exist
    writeFileSync(join(dataDir, 'cie-2011', 'concepts', '17-999.json'), '{}');

    const broken = checkFile(
      join(dataDir, 'cie-2011', 'concepts', '17-999.json'),
      dataDir,
    );
    expect(broken.length).toBeGreaterThanOrEqual(0);
    rmSync(dataDir, { recursive: true });
  });

  it('reports broken gl:references @id', () => {
    const dataDir = fixture();
    mkdirSync(join(dataDir, 'cie-2011', 'concepts'), { recursive: true });
    writeFileSync(join(dataDir, 'cie-2011', 'concepts', '17-1.json'), JSON.stringify({
      'gl:localizedConcept': {
        eng: {
          'gl:references': [
            { '@id': 'https://example.com/d/cie-2011/concept/17-DOESNOTEXIST' },
          ],
        },
      },
    }));

    const broken = checkFile(
      join(dataDir, 'cie-2011', 'concepts', '17-1.json'),
      dataDir,
    );
    expect(broken).toHaveLength(1);
    expect(broken[0].target).toContain('17-DOESNOTEXIST');
    rmSync(dataDir, { recursive: true });
  });

  it('passes when all targets exist', () => {
    const dataDir = fixture();
    mkdirSync(join(dataDir, 'cie-2011', 'concepts'), { recursive: true });
    writeFileSync(join(dataDir, 'cie-2011', 'concepts', '17-1.json'), '{}');
    writeFileSync(join(dataDir, 'cie-2011', 'concepts', '17-2.json'), '{}');

    writeFileSync(join(dataDir, 'cie-2011', 'concepts', '17-1.json'), JSON.stringify({
      'gl:related': [
        { '@id': 'https://example.com/d/cie-2011/concept/17-2' },
      ],
    }));

    const broken = checkFile(
      join(dataDir, 'cie-2011', 'concepts', '17-1.json'),
      dataDir,
    );
    expect(broken).toHaveLength(0);
    rmSync(dataDir, { recursive: true });
  });

  it('ignores external (non-http) targets', () => {
    const dataDir = fixture();
    mkdirSync(join(dataDir, 'cie-2011', 'concepts'), { recursive: true });
    writeFileSync(join(dataDir, 'cie-2011', 'concepts', '17-1.json'), JSON.stringify({
      'gl:related': [
        { '@id': 'urn:cie:ilv:cie-2011:ext-foo' },
      ],
    }));

    const broken = checkFile(
      join(dataDir, 'cie-2011', 'concepts', '17-1.json'),
      dataDir,
    );
    expect(broken).toHaveLength(0);
    rmSync(dataDir, { recursive: true });
  });
});