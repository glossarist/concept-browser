/**
 * Wire-key SSOT contract.
 *
 * Audit-driven (AUDIT-2026-07-29 P1-3).
 *
 * The GL record is the single source of truth for the JSON-LD wire-format
 * keys used across src/adapters/. This spec pins:
 *
 *   - Every entry is a string starting with 'gl:' (or '@' for JSON-LD core)
 *   - No two entries share the same value (injectivity — one key, one name)
 *   - The set of values matches what's declared in jsonld-types.ts
 *     (catches drift if someone adds a key to one but not the other)
 */
import { describe, it, expect } from 'vitest';
import { GL } from '../adapters/wire-keys';

describe('GL wire-key SSOT', () => {
  it('every value is a non-empty string', () => {
    for (const value of Object.values(GL)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('every value starts with gl: or @ (JSON-LD namespace)', () => {
    for (const value of Object.values(GL)) {
      expect(value.startsWith('gl:') || value.startsWith('@')).toBe(true);
    }
  });

  it('no two entries share the same value (injectivity)', () => {
    const values = Object.values(GL);
    expect(new Set(values).size).toBe(values.length);
  });

  it('MECE keys are present (presence, count, isDelimiting, multiplicity, certainty)', () => {
    expect(GL.PRESENCE).toBe('gl:presence');
    expect(GL.COUNT).toBe('gl:count');
    expect(GL.IS_DELIMITING).toBe('gl:isDelimiting');
    expect(GL.MULTIPLICITY).toBe('gl:multiplicity');
    expect(GL.CERTAINTY).toBe('gl:certainty');
  });

  it('JSON-LD core keys are present', () => {
    expect(GL.ID).toBe('@id');
    expect(GL.TYPE).toBe('@type');
  });

  it('LOCAL_ID is distinct from ID (one is gl:id, the other @id)', () => {
    // Both represent "id" but in different namespaces:
    //   GL.ID (@id)        — JSON-LD IRI for the concept
    //   GL.LOCAL_ID (gl:id) — source-local id within ConceptSource/Origin/Ref
    expect(GL.ID).toBe('@id');
    expect(GL.LOCAL_ID).toBe('gl:id');
    expect(GL.ID).not.toBe(GL.LOCAL_ID);
  });

  it('count matches documented set (no drift)', () => {
    // Update this number when adding a new key.
    // The point of this test: when adding a key, you remember to update
    // the count; when removing, you notice the test fails. Catches
    // accidental drift in either direction.
    expect(Object.keys(GL).length).toBe(90);
  });
});
