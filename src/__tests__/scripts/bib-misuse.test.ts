import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkFile } from '../../../scripts/validate-links';

function fixture(conceptJson: object): string {
  const dir = join(tmpdir(), `cb-vl-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, 'cie-2020', 'concepts'), { recursive: true });
  const file = join(dir, 'cie-2020', 'concepts', '17-1.json');
  writeFileSync(file, JSON.stringify(conceptJson));
  return file;
}

describe('validate-links — bib: misuse detection (concept cited as bibliography)', () => {
  it('flags {{bib:id}} when id matches a ConceptSource (should be cite:)', () => {
    const file = fixture({
      'gl:sources': [{ 'gl:id': '702-02-07' }],
      'gl:localizedConcept': {
        eng: {
          'gl:definition': [{
            'gl:content': 'See {{bib:702-02-07, IEV 702-02-07}}',
          }],
        },
      },
    });
    const broken = checkFile(file, join(file, '..', '..', '..'));
    const bibError = broken.find(b => b.field === '{{bib:...}}');
    expect(bibError).toBeDefined();
    expect(bibError!.target).toBe('702-02-07');
    expect(bibError!.reason).toContain('Use {{cite:');
    rmSync(join(file, '..', '..', '..'), { recursive: true });
  });

  it('passes {{bib:id}} when id is in bibliography.json (pure bib record)', () => {
    const dir = join(tmpdir(), `cb-vl-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(dir, 'cie-2020', 'concepts'), { recursive: true });
    writeFileSync(join(dir, 'cie-2020', 'bibliography.json'), JSON.stringify({
      bibliography: { 'iso704_doc': { reference: 'ISO 704:2022' } },
    }));
    const file = join(dir, 'cie-2020', 'concepts', '17-1.json');
    writeFileSync(file, JSON.stringify({
      'gl:localizedConcept': {
        eng: { 'gl:definition': [{ 'gl:content': 'See {{bib:iso704_doc, ISO 704}}' }] },
      },
    }));
    const broken = checkFile(file, dir);
    expect(broken.find(b => b.field === '{{bib:...}}')).toBeUndefined();
    rmSync(dir, { recursive: true });
  });

  it('flags {{bib:id}} when id is not in bibliography and not a source', () => {
    const file = fixture({
      'gl:localizedConcept': {
        eng: { 'gl:definition': [{ 'gl:content': 'See {{bib:nonexistent_ref}}' }] },
      },
    });
    const broken = checkFile(file, join(file, '..', '..', '..'));
    const bibError = broken.find(b => b.field === '{{bib:...}}');
    expect(bibError).toBeDefined();
    expect(bibError!.reason).toContain('bibliography');
    rmSync(join(file, '..', '..', '..'), { recursive: true });
  });

  it('passes {{cite:id}} when id matches a source', () => {
    const file = fixture({
      'gl:sources': [{ 'gl:id': 'iev-702-02-07' }],
      'gl:localizedConcept': {
        eng: { 'gl:definition': [{ 'gl:content': 'See {{cite:iev-702-02-07, IEV}}' }] },
      },
    });
    const broken = checkFile(file, join(file, '..', '..', '..'));
    expect(broken.find(b => b.field === '{{cite:...}}')).toBeUndefined();
    rmSync(join(file, '..', '..', '..'), { recursive: true });
  });
});