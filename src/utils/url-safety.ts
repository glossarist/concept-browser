const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const DANGEROUS_TOKEN_RE = /[\s<>"]/;

export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (DANGEROUS_TOKEN_RE.test(url)) return false;

  const trimmed = url.trim();
  if (!trimmed) return false;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      return SAFE_URL_PROTOCOLS.has(u.protocol);
    } catch {
      return false;
    }
  }

  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true;
  }

  return false;
}

export function sanitizeUrl(url: string): string {
  return isSafeUrl(url) ? url : '';
}
