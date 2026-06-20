import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

describe('scripts syntax gate', () => {
  it('`npm run check:scripts` exits 0 (every .mjs/.js/.cjs in scripts/ and cli/ parses)', () => {
    const result = spawnSync(
      process.execPath,
      [path.join(repoRoot, 'scripts', 'check-syntax.mjs')],
      { encoding: 'utf8' },
    );

    if (result.status !== 0) {
      throw new Error(
        `check-syntax.mjs failed (exit ${result.status}):\n${result.stdout || ''}${result.stderr || ''}`,
      );
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/syntax OK:/);
  });
});
