import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const SCRIPTS_DIR = join(ROOT, 'scripts');

const LIBRARY_SCRIPTS = [
  'load-site-config',
  'validate-yaml',
  'normalize-yaml',
  'extract-source-refs',
  'migrate-v1-to-v3',
];

const PIPELINE_SCRIPTS = [
  'fetch-datasets',
  'generate-data',
  'build-edges',
  'process-about-pages',
  'generate-ontology-data',
  'generate-ontology-schema',
  'doctor',
  'validate-shacl',
  'bridge-to-astro',
  'sync-concept-model',
  'generate-404',
];

function runPlain(args: string[], opts?: Parameters<typeof spawnSync>[2]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('node', args, { encoding: 'utf8', cwd: ROOT, ...opts });
  return {
    status: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout : result.stdout?.toString('utf8') ?? '',
    stderr: typeof result.stderr === 'string' ? result.stderr : result.stderr?.toString('utf8') ?? '',
  };
}

describe('published-package contract — compiled .js scripts load under plain node (no tsx)', () => {
  it('npm run build:scripts produces .js for every script', () => {
    const build = spawnSync('node', [join(ROOT, 'scripts', 'build-scripts.mjs')], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    expect(build.status).toBe(0);

    for (const name of [...LIBRARY_SCRIPTS, ...PIPELINE_SCRIPTS]) {
      const jsPath = join(SCRIPTS_DIR, `${name}.js`);
      expect(existsSync(jsPath)).toBe(true);
    }
  }, 30000);

  it('library scripts export functions under plain node (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING regression)', () => {
    for (const name of LIBRARY_SCRIPTS) {
      const jsPath = `./scripts/${name}.js`;
      const result = runPlain(['--input-type=module', '-e', `import(${JSON.stringify(jsPath)}).then(m => console.log('OK', Object.keys(m).length)).catch(e => { console.error('FAIL', e.message); process.exit(1); })`]);
      expect(result.stderr).not.toContain('ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('OK');
    }
  }, 60000);

  it('pipeline scripts do not throw ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING (may fail on missing config, that is OK)', () => {
    for (const name of PIPELINE_SCRIPTS) {
      const result = runPlain(['--input-type=module', '-e', `import(${JSON.stringify(`./scripts/${name}.js`)}).then(() => console.log('OK')).catch(e => { console.error(e.message); })`]);
      expect(result.stderr).not.toContain('ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING');
    }
  }, 60000);

  it('validate-yaml.js exports validateYaml function', () => {
    const result = runPlain(['--input-type=module', '-e', `
      import { validateYaml } from './scripts/validate-yaml.js';
      const schema = { type: 'object', required: ['termid'], properties: { termid: { type: 'string' } } };
      const r = validateYaml('termid: test', schema);
      console.log('valid=' + r.valid);
    `]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('valid=true');
  });

  it('compiled scripts do not import devDependencies (runtime packaging regression)', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const deps = new Set(Object.keys(pkg.dependencies || {}));
    const devDeps = new Set(Object.keys(pkg.devDependencies || {}));
    for (const name of LIBRARY_SCRIPTS) {
      const jsPath = join(SCRIPTS_DIR, `${name}.js`);
      if (!existsSync(jsPath)) continue;
      const src = readFileSync(jsPath, 'utf8');
      for (const devDep of devDeps) {
        if (deps.has(devDep)) continue;
        expect(src).not.toContain(`from "${devDep}"`);
        expect(src).not.toContain(`from '${devDep}'`);
        expect(src).not.toMatch(new RegExp(`import\\s*\\(\\s*["']${devDep}["']`));
      }
    }
  });
});
