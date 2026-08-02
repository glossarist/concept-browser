import fs from 'fs';
import path from 'path';

/**
 * Assert that a dataset's `localPath` is safe to use as an in-place source.
 *
 * "Safe" means: the resolved physical location of `localPath` is disjoint
 * from the staging directory (`.datasets/<id>`). If they overlap, staging
 * operations (rm, extract, clone) would destroy the user's source data —
 * the data-loss bug reported in v0.7.43.
 *
 * Returns the resolved absolute path on success; throws on any hazard.
 *
 * @param {string} datasetId
 * @param {string} localPath - relative to `root` (or absolute)
 * @param {{ root?: string, datasetsDir?: string }} [opts]
 * @returns {string} resolved absolute path
 */
/**
 * Compute the canonical physical path of `p`, resolving symlinks on the
 * existing prefix. If `p` itself exists, this is just `realpathSync(p)`.
 * If not, we walk up to the nearest existing ancestor, realpath it, and
 * re-append the non-existent tail. This is needed because macOS tmpdir
 * (`/var/folders/...`) is a symlink to `/private/var/folders/...`; without
 * this, prefix comparisons across the symlink boundary silently fail.
 */
function physicalPath(p: string): string {
  if (fs.existsSync(p)) return fs.realpathSync(p);
  const parent = path.dirname(p);
  const parentReal = fs.existsSync(parent) ? fs.realpathSync(parent) : physicalPath(parent);
  return path.join(parentReal, path.basename(p));
}

export function assertLocalPathSafe(
  datasetId: string,
  localPath: string,
  { root = process.cwd(), datasetsDir }: { root?: string; datasetsDir?: string } = {},
): string {
  const datasetsRoot = datasetsDir || path.join(root, '.datasets');
  const localResolved = path.resolve(root, localPath);

  if (!fs.existsSync(localResolved)) {
    throw new Error(`localPath for ${datasetId} does not exist: ${localResolved}`);
  }

  const localReal = fs.realpathSync(localResolved);
  const stagedAbs = path.join(datasetsRoot, datasetId);
  const stagedReal = physicalPath(stagedAbs);

  if (localReal === stagedReal) {
    throw new Error(
      `localPath for ${datasetId} resolves to the same physical location as .datasets/${datasetId} ` +
      `(${localReal}). Refusing to operate — source and staging would clobber. ` +
      `Use a path outside .datasets/.`
    );
  }
  if (localReal.startsWith(stagedReal + path.sep)) {
    throw new Error(
      `localPath for ${datasetId} is nested inside .datasets/${datasetId}. ` +
      `Refusing to operate — staging operations would destroy source data. ` +
      `Use a path outside .datasets/.`
    );
  }
  if (stagedReal.startsWith(localReal + path.sep)) {
    throw new Error(
      `localPath for ${datasetId} contains .datasets/${datasetId}. ` +
      `Refusing to operate — staging operations would destroy source data. ` +
      `Use a path outside localPath.`
    );
  }
  return localReal;
}
