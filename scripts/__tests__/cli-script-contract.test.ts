import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// Verifies every CLI-driven script exports main() and uses a
// direct-invocation guard. This pins the contract documented in
// TODO.bugs/03 and TODO.bugs/05: scripts are testable AND
// auto-run when invoked directly. Without this contract, the CLI
// would need a separate code path per script (some auto-run via
// import side-effect, others need explicit m.main()).

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCRIPT_PATHS = [
  '../../scripts/fetch-datasets.ts',
  '../../scripts/build-edges.ts',
  '../../scripts/process-about-pages.ts',
];

describe('CLI script contract: every script exports main()', () => {
  for (const scriptPath of SCRIPT_PATHS) {
    it(`${scriptPath} exports main as a function`, async () => {
      const mod = await import(scriptPath);
      expect(typeof mod.main).toBe('function');
    });
  }
});

describe('CLI script contract: direct-invocation guard', () => {
  for (const scriptPath of SCRIPT_PATHS) {
    it(`${scriptPath} source uses realpathSync direct-invocation guard`, () => {
      const abs = resolve(__dirname, scriptPath);
      const src = readFileSync(abs, 'utf8');
      expect(src).toMatch(/realpathSync\s*\(\s*process\.argv\[1\]/);
      expect(src).toMatch(/realpathSync\s*\(\s*fileURLToPath\s*\(\s*import\.meta\.url\s*\)\s*\)/);
    });
  }
});
