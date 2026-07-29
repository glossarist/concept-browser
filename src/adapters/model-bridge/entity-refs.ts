/**
 * Non-verbal entity reference normalization.
 *
 * Normalizes JSON-LD structural entity refs (`gl:figureRef` /
 * `gl:tableRef` / `gl:formulaRef`) into the shape
 * `NonVerbalReference.fromJSON` expects.
 *
 * Accepts three wire forms:
 *   - bare string ID
 *   - `{ "@id": "../kind/foo" }`
 *   - `{ "@id": "../kind/foo", "gl:display": "Figure 3" }`
 *
 * Emits the canonical `{ ref, display? }` shape. The path's last
 * segment is the entity id; the field name (`figureRef` vs `tableRef`
 * vs `formulaRef`) is the kind discriminator upstream.
 */
import { GL } from '../wire-keys';

export function normalizeEntityRefs(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeOneEntityRef).filter((v): v is Record<string, string> => v !== null);
}

function normalizeOneEntityRef(entry: unknown): Record<string, string> | null {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed ? { ref: trimmed } : null;
  }
  if (!entry || typeof entry !== 'object') return null;
  const obj = entry as Record<string, unknown>;
  const atId = typeof obj['@id'] === 'string' ? (obj['@id'] as string) : null;
  const explicitRef = typeof obj.ref === 'string' ? obj.ref
    : typeof obj.entityId === 'string' ? obj.entityId
    : typeof obj.entity_id === 'string' ? obj.entity_id
    : null;
  const entityId = (atId ? lastPathSegment(atId) : null) ?? explicitRef;
  if (!entityId) return null;
  const out: Record<string, string> = { ref: entityId };
  const displayRaw = obj[GL.DISPLAY] ?? obj['gloss:display'] ?? obj.display;
  if (typeof displayRaw === 'string') out.display = displayRaw;
  return out;
}

function lastPathSegment(p: string): string | null {
  const cleaned = p.replace(/[?#].*$/, '').replace(/\/+$/, '');
  const segments = cleaned.split('/');
  const last = segments[segments.length - 1];
  return last ? decodeURIComponent(last) : null;
}
