import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const scriptPath = join(dirname(new URL(import.meta.url).pathname), '..', 'process-about-pages.mjs');

// Process-about-pages discovers per-dataset about content from either
// .datasets/<id>/about/ (fetched) OR site-config localPath overrides.
// This spec covers both discovery paths plus the per-group path.
describe('process-about-pages — discovery paths', () => {
  let root;
  let origCwd;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'about-pages-'));
    origCwd = process.cwd();
    process.chdir(root);
    // The script writes to public/pages under CWD.
    mkdirSync(join(root, 'public'), { recursive: true });
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmSync(root, { recursive: true, force: true });
  });

  // Re-import each time with a cache-busting query so main() doesn't
  // auto-run on cached load. The exported main() is invoked explicitly.
  async function runMain() {
    const url = new URL(`file://${scriptPath}?t=${Date.now()}`);
    const mod = await import(url.href);
    return mod.main();
  }

  function writeSiteConfig(datasets) {
    const lines = ['id: test', 'datasets:'];
    for (const d of datasets) {
      lines.push(`  - id: ${d.id}`);
      if (d.localPath) lines.push(`    localPath: ${d.localPath}`);
      lines.push(`    title: "${d.id}"`);
    }
    writeFileSync(join(root, 'site-config.yml'), lines.join('\n') + '\n');
  }

  it('discovers about pages under .datasets/<id>/about/', async () => {
    mkdirSync(join(root, '.datasets', 'foo', 'about'), { recursive: true });
    writeFileSync(
      join(root, '.datasets', 'foo', 'about', 'about.md'),
      '# Foo\n\nThe foo dataset.',
    );

    await runMain();

    const outPath = join(root, 'public', 'pages', 'dataset-foo-about.json');
    expect(existsSync(outPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(parsed.title).toBe('Foo');
    expect(parsed.html).toContain('<h1>Foo</h1>');
  });

  it('discovers about pages via site-config localPath when .datasets/ is absent', async () => {
    const localRoot = mkdtempSync(join(tmpdir(), 'local-ds-'));
    try {
      mkdirSync(join(localRoot, 'about'), { recursive: true });
      writeFileSync(
        join(localRoot, 'about', 'about.md'),
        '# Bar\n\nLocal-path dataset.',
      );
      writeSiteConfig([{ id: 'bar', localPath: localRoot }]);

      await runMain();

      const outPath = join(root, 'public', 'pages', 'dataset-bar-about.json');
      expect(existsSync(outPath)).toBe(true);
      const parsed = JSON.parse(readFileSync(outPath, 'utf8'));
      expect(parsed.title).toBe('Bar');
    } finally {
      rmSync(localRoot, { recursive: true, force: true });
    }
  });

  it('discovers group about pages under site-content/groups/<id>/about/', async () => {
    mkdirSync(join(root, 'site-content', 'groups', 'mygroup', 'about'), { recursive: true });
    writeFileSync(
      join(root, 'site-content', 'groups', 'mygroup', 'about', 'about.md'),
      '# My Group\n\nA group of datasets.',
    );

    await runMain();

    const outPath = join(root, 'public', 'pages', 'group-mygroup-about.json');
    expect(existsSync(outPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(parsed.title).toBe('My Group');
  });

  it('skips silently when no about directories exist', async () => {
    writeSiteConfig([{ id: 'lonely' }]);
    // No .datasets, no localPath about/, no groups. The script runs to
    // completion without throwing and produces no output pages.
    await expect(runMain()).resolves.not.toThrow();
    expect(existsSync(join(root, 'public', 'pages', 'dataset-lonely-about.json'))).toBe(false);
  });
});
