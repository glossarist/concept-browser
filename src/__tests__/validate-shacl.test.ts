import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', '..', 'scripts', 'validate-shacl.ts');
const FIXTURES = join(__dirname, '..', '__fixtures__', 'shacl');
const SHAPES = join(__dirname, '..', '__fixtures__', 'concept-shape.ttl');

interface RunResult { code: number; stdout: string; stderr: string }
interface RunOptions { env?: NodeJS.ProcessEnv; shapes?: string }
interface ExecException extends Error {
  status?: number;
  stdout?: Buffer | string;
  stderr?: Buffer | string;
}

function execCaught(cmd: string, args: string[], opts: Parameters<typeof execFileSync>[2] = {}): RunResult {
  try {
    const stdout = execFileSync(cmd, args, { encoding: 'utf8', ...opts }) as string;
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as ExecException;
    return {
      code: err.status ?? 1,
      stdout: typeof err.stdout === 'string' ? err.stdout : (err.stdout?.toString() ?? ''),
      stderr: typeof err.stderr === 'string' ? err.stderr : (err.stderr?.toString() ?? ''),
    };
  }
}

function runValidate(dataDir: string, { env, shapes }: RunOptions = {}): RunResult {
  return execCaught('node', ['--import', 'tsx', SCRIPT, '--shapes', shapes ?? SHAPES, dataDir], {
    env: { ...process.env, ...env },
  });
}

function runValidateRaw(args: string[], { env }: RunOptions = {}): RunResult {
  return execCaught('node', ['--import', 'tsx', SCRIPT, ...args], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('validate-shacl.mjs', () => {
  it('passes when a fixture conforms to the shapes', () => {
    const goodDir = join(FIXTURES, 'good');
    const result = runValidate(goodDir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('SHACL validation passed');
  });

  it('fails when a fixture has missing language tags', () => {
    const badDir = join(FIXTURES, 'bad');
    const result = runValidate(badDir);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('SHACL validation FAILED');
    expect(result.stderr).toContain('concept.ttl');
    expect(result.stderr.toLowerCase()).toContain('langstring');
  });

  it('aggregates violations across multiple files', () => {
    const result = runValidate(FIXTURES);
    expect(result.code).not.toBe(0);
    expect(result.stderr).not.toContain('good/concept.ttl');
    expect(result.stderr).toContain('bad/concept.ttl');
  });

  it('exits cleanly when no .ttl files are found', () => {
    const emptyDir = join(FIXTURES, 'empty');
    const result = runValidate(emptyDir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('No .ttl files');
  });

  it('errors clearly when --shapes path does not exist', () => {
    const result = runValidate(FIXTURES, { shapes: '/does/not/exist.ttl' });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Failed to load SHACL shapes');
  });

  it('accepts SHAPES_PATH env var as fallback when --shapes is omitted', () => {
    const result = runValidate(join(FIXTURES, 'good'), {
      env: { SHAPES_PATH: SHAPES },
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('SHACL validation passed');
  });

  it('uses the vendored shapes by default when no override is given', () => {
    const result = runValidateRaw([join(FIXTURES, 'good')], {
      env: { SHAPES_PATH: '' },
    });
    // The vendored shapes live at data/concept-model/shapes/glossarist.shacl.ttl
    // and ship with the repo. The good fixture conforms to them.
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('SHACL validation passed');
  });
});
