// Slug for a domain label. Keeps letters and digits of every script so that
// non-Latin and accented labels stay distinct and readable. Pure-ASCII input
// that contains a letter or digit yields exactly what the earlier ASCII-only
// implementation did, so already-published URLs do not move.

const KEEP = /[^\p{L}\p{N}\p{M}_\s-]/gu;
const HAS_WORD = /[\p{L}\p{N}]/u;

// FNV-1a, 32 bit, over UTF-16 code units. Sync and dependency-free so it runs
// in the browser and in the Node build scripts alike.
function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function slugify(text: string): string {
  if (text === '') return '';
  const folded = text.normalize('NFKC').toLowerCase();
  const slug = folded.replace(KEEP, '').replace(/[\s/]+/g, '-');
  // No letter or digit left (e.g. "()", "---"): a hash keeps such labels
  // from collapsing into one empty node.
  return HAS_WORD.test(slug) ? slug : `x-${shortHash(folded.trim())}`;
}
