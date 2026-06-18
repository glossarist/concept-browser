/**
 * Image asset pipeline — pure Node, no shell commands.
 *
 * Copies image bytes from the source directory to the runtime data
 * directory, validates magic bytes for known formats, parses intrinsic
 * dimensions for raster formats, and emits `images-manifest.json` with
 * SHA-256 hashes + dimensions.
 *
 * If the source directory contains its own `manifest.json`, that file is
 * reused as the SSOT (single source of truth) and only missing entries
 * are computed. This lets glossarist-ruby ship a manifest if it wants to.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';

/** @typedef {{ src: string, format: string, sha256: string, width?: number, height?: number, bytes: number }} ImageManifestEntry */

export const SUPPORTED_FORMATS = new Set(['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif']);

const MAGIC_BYTES = {
  png:  [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  jpg:  [0xFF, 0xD8, 0xFF],
  gif:  [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46], // "RIFF" — full match needs bytes 8-11 = "WEBP"
};

const FILENAME_RE = /^[a-z0-9._-]+$/i;

/**
 * Validate the file's magic bytes against its declared extension.
 * Returns the canonical format (e.g. "jpg" for ".jpeg"), or null if
 * validation fails.
 *
 * @param {Buffer} buf
 * @param {string} ext
 * @returns {string | null}
 */
export function detectFormat(buf, ext) {
  const e = ext.toLowerCase();
  if (e === 'svg') return buf.includes('<svg') || buf.includes('<SVG') ? 'svg' : null;
  if (e === 'png' || e === 'jpg' || e === 'jpeg' || e === 'gif' || e === 'webp') {
    const png = MAGIC_BYTES.png;
    if (e === 'png' && buf.length >= png.length && png.every((b, i) => buf[i] === b)) return 'png';
    const jpg = MAGIC_BYTES.jpg;
    if ((e === 'jpg' || e === 'jpeg') && buf.length >= jpg.length && jpg.every((b, i) => buf[i] === b)) return 'jpg';
    const gif = MAGIC_BYTES.gif;
    if (e === 'gif' && buf.length >= gif.length && gif.every((b, i) => buf[i] === b)) return 'gif';
    if (e === 'webp' && buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  }
  // Unknown formats (avif, etc.) — accept on trust; authors are responsible.
  if (SUPPORTED_FORMATS.has(e)) return e;
  return null;
}

/**
 * Parse intrinsic dimensions for PNG/JPEG. Returns null for unknown formats.
 * WebP/AVIF parsing is intentionally V1-light — authors declare via YAML.
 *
 * @param {Buffer} buf
 * @param {string} format
 * @returns {{ width?: number, height?: number }}
 */
export function readIntrinsicDimensions(buf, format) {
  if (format === 'png' && buf.length >= 24) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (format === 'jpg' || format === 'jpeg') {
    return readJpegDimensions(buf);
  }
  return {};
}

function readJpegDimensions(buf) {
  // Scan JPEG markers for SOFn (0xFFC0–0xFFCF, excluding 0xFFC4, 0xFFC8, 0xFFCC).
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xC0 && marker <= 0xCF &&
        marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    const segLen = buf.readUInt16BE(i + 2);
    i += 2 + segLen;
  }
  return {};
}

/**
 * Sanitize an image filename per the wire-format rule
 * `[a-z0-9._-]+`. Returns the sanitized name (lowercased, with unsafe
 * characters replaced by `-`).
 *
 * @param {string} name
 * @returns {string}
 */
export function sanitizeImageFilename(name) {
  const lowered = name.toLowerCase();
  const sanitized = lowered.replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-');
  return sanitized.replace(/^-+|-+$/g, '');
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Copy image assets from srcDir into destDir, validate, and emit
 * images-manifest.json. Reuses upstream manifest if present.
 *
 * @param {string} srcDir   Absolute path to source images/
 * @param {string} destDir  Absolute path to public/data/{ds}/images/
 * @returns {Promise<{ count: number, manifest: Record<string, ImageManifestEntry>, skipped: string[] }>}
 */
export async function copyImageAssets(srcDir, destDir) {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });

  // Reuse upstream manifest if present (SSOT).
  const upstreamManifestPath = path.join(srcDir, 'manifest.json');
  let upstream = null;
  try {
    const st = await stat(upstreamManifestPath);
    if (st.isFile()) {
      upstream = JSON.parse(await readFile(upstreamManifestPath, 'utf8'));
    }
  } catch { /* no upstream manifest — compute fresh */ }

  /** @type {Record<string, ImageManifestEntry>} */
  const manifest = {};
  const skipped = [];
  let count = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name === 'manifest.json') continue;

    const safeName = sanitizeImageFilename(entry.name);
    if (!FILENAME_RE.test(safeName)) {
      skipped.push(entry.name);
      continue;
    }
    const ext = path.extname(safeName).slice(1);
    if (!ext || !SUPPORTED_FORMATS.has(ext)) {
      skipped.push(entry.name);
      continue;
    }

    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, safeName);
    const buf = await readFile(src);

    const format = detectFormat(buf, ext);
    if (!format) {
      skipped.push(`${entry.name} (format mismatch)`);
      continue;
    }

    await copyFile(src, dest);

    /** @type {ImageManifestEntry} */
    let entry_record;
    if (upstream && upstream[safeName]) {
      entry_record = { ...upstream[safeName], src: safeName, format };
    } else {
      const dims = readIntrinsicDimensions(buf, format);
      entry_record = {
        src: safeName,
        format,
        sha256: sha256(buf),
        bytes: buf.length,
        ...dims,
      };
    }
    manifest[safeName] = entry_record;
    count++;
  }

  await mkdir(destDir, { recursive: true });
  await writeFile(
    path.join(destDir, '..', 'images-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  return { count, manifest, skipped };
}
