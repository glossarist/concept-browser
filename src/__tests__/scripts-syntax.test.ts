import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

describe('scripts syntax gate', () => {
  it('`npm run check:scripts` exits 0 (every .ts/.mjs/.js/.cjs in scripts/ and cli/ parses)', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', path.join(repoRoot, 'scripts', 'check-syntax.ts')],
      { encoding: 'utf8', timeout: 60000 },
    );

    if (result.status !== 0) {
      throw new Error(
        `check-syntax.mjs failed (exit ${result.status}):\n${result.stdout || ''}${result.stderr || ''}`,
      );
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/syntax OK:/);
  }, 120000);
});
