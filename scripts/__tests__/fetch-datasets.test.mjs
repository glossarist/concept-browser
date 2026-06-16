import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { assertLocalPathSafe } from '../lib/local-path-safety.mjs';

function makeTmpTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-fetch-'));
  const datasetsDir = path.join(root, '.datasets');
  const sourceDir = path.join(root, 'source-data');
  fs.mkdirSync(datasetsDir);
  fs.mkdirSync(path.join(sourceDir, 'concepts'), { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'concepts', 'a.yaml'), 'termid: 1\n');
  return { root, datasetsDir, sourceDir };
}

describe('assertLocalPathSafe', () => {
  let tree;

  beforeEach(() => { tree = makeTmpTree(); });
  afterEach(() => {
    fs.rmSync(tree.root, { recursive: true, force: true });
  });

  it('returns resolved path for a safe external location', () => {
    const resolved = assertLocalPathSafe('foo', tree.sourceDir, {
      root: tree.root,
      datasetsDir: tree.datasetsDir,
    });
    // Returns the realpath (symlinks resolved); on macOS tmpdir resolves
    // /var → /private/var, so compare against realpath, not path.resolve.
    expect(resolved).toBe(fs.realpathSync(path.resolve(tree.root, tree.sourceDir)));
  });

  it('throws when localPath does not exist', () => {
    expect(() =>
      assertLocalPathSafe('foo', path.join(tree.root, 'nope'), {
        root: tree.root,
        datasetsDir: tree.datasetsDir,
      })
    ).toThrow(/does not exist/);
  });

  it('throws when localPath equals .datasets/<id>', () => {
    const staged = path.join(tree.datasetsDir, 'foo');
    fs.mkdirSync(staged, { recursive: true });
    expect(() =>
      assertLocalPathSafe('foo', staged, {
        root: tree.root,
        datasetsDir: tree.datasetsDir,
      })
    ).toThrow(/same physical location/);
  });

  it('throws when localPath is nested inside .datasets/<id>', () => {
    const staged = path.join(tree.datasetsDir, 'foo');
    fs.mkdirSync(path.join(staged, 'subdir'), { recursive: true });
    expect(() =>
      assertLocalPathSafe('foo', path.join(staged, 'subdir'), {
        root: tree.root,
        datasetsDir: tree.datasetsDir,
      })
    ).toThrow(/nested inside/);
  });

  it('throws when localPath contains .datasets/<id> (parent-of-staging hazard)', () => {
    // localPath = root itself, datasetsDir = root/.datasets — staging ops
    // (rm -rf .datasets/<id>) would touch files inside localPath.
    expect(() =>
      assertLocalPathSafe('foo', tree.root, {
        root: tree.root,
        datasetsDir: tree.datasetsDir,
      })
    ).toThrow(/contains .datasets/);
  });

  it('throws when localPath is a symlink to .datasets/<id> (the reported bug)', () => {
    const staged = path.join(tree.datasetsDir, 'foo');
    fs.mkdirSync(staged, { recursive: true });
    const symlinkPath = path.join(tree.root, 'evil-link');
    fs.symlinkSync(staged, symlinkPath);
    expect(() =>
      assertLocalPathSafe('foo', symlinkPath, {
        root: tree.root,
        datasetsDir: tree.datasetsDir,
      })
    ).toThrow(/same physical location/);
  });

  it('does NOT modify the source directory (regression for data-loss bug)', () => {
    const sentinel = path.join(tree.sourceDir, 'concepts', 'SENTINEL.yaml');
    fs.writeFileSync(sentinel, 'termid: sentinel\n');
    const beforeMtime = fs.statSync(sentinel).mtimeMs;

    assertLocalPathSafe('foo', tree.sourceDir, {
      root: tree.root,
      datasetsDir: tree.datasetsDir,
    });

    // Source directory must be completely untouched after the safety check.
    expect(fs.existsSync(sentinel)).toBe(true);
    expect(fs.statSync(sentinel).mtimeMs).toBe(beforeMtime);
    expect(fs.readdirSync(path.join(tree.sourceDir, 'concepts'))).toContain('SENTINEL.yaml');
  });
});
