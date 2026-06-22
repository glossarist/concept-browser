/**
 * Figure image picker — single SSOT for choosing the best variant from
 * a Figure's image array.
 *
 * Decision order:
 *   1. If user prefers dark color scheme and a dark variant exists, use it.
 *   2. If user prefers light color scheme and a light variant exists, use it.
 *   3. If a vector (SVG) variant exists and the user prefers vector, use it.
 *   4. Otherwise, fall back to the first declared variant.
 *
 * The `print` role is reserved for print stylesheets (selected via CSS
 * @media print in FigureImages.vue), not picked here.
 */
import type { FigureImage } from 'glossarist';

export interface PickOptions {
  prefersDark?: boolean;
  prefersVector?: boolean;
}

export function pickBestImage(images: FigureImage[], opts: PickOptions = {}): FigureImage | null {
  if (images.length === 0) return null;
  if (opts.prefersDark) {
    const dark = images.find(i => i.role === 'dark');
    if (dark) return dark;
  }
  if (!opts.prefersDark) {
    const light = images.find(i => i.role === 'light');
    if (light) return light;
  }
  if (opts.prefersVector) {
    const vector = images.find(i => i.format === 'svg' || i.role === 'vector');
    if (vector) return vector;
  }
  return images[0] ?? null;
}

/**
 * Group image variants by role for the <picture> element. Returns the
 * responsive sources in the order they should appear (most-specific
 * first), plus the default `<img>` source.
 */
export function groupImageVariants(images: FigureImage[]): {
  sources: FigureImage[];
  img: FigureImage | null;
  print: FigureImage | null;
} {
  const print = images.find(i => i.role === 'print') ?? null;
  const dark = images.find(i => i.role === 'dark');
  const light = images.find(i => i.role === 'light');
  const sources: FigureImage[] = [];
  if (dark) sources.push(dark);
  if (light) sources.push(light);
  const img = pickBestImage(images, {}) ?? images[0] ?? null;
  return { sources, img, print };
}
