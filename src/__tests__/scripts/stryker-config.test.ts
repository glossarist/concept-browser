import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STRYKER_CONFIG = join(process.cwd(), 'stryker.config.mjs');

describe('WS P2 — stryker mutation testing setup', () => {
  it('ships a stryker config file', () => {
    expect(existsSync(STRYKER_CONFIG)).toBe(true);
  });

  it('config scopes mutation to the three highest-value emitter files', () => {
    const content = readFileSync(STRYKER_CONFIG, 'utf8');
    expect(content).toContain('src/components/concept-rdf/concept-emitter.ts');
    expect(content).toContain('src/components/concept-rdf/dataset-emitter.ts');
    expect(content).toContain('src/components/concept-rdf/bibliography-emitter.ts');
  });

  it('config declares a break threshold (build fails if mutation score drops)', () => {
    const content = readFileSync(STRYKER_CONFIG, 'utf8');
    expect(content).toMatch(/break:\s*\d+/);
  });

  it('config uses vitest as the test runner', () => {
    const content = readFileSync(STRYKER_CONFIG, 'utf8');
    expect(content).toMatch(/testRunner:\s*['"]vitest['"]/);
  });

  it('package.json exposes npm run mutation:test', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['mutation:test']).toMatch(/^stryker run/);
  });
});