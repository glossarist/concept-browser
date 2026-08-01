import { describe, it, expect } from 'vitest';
import {
  fontStack,
  DEFAULT_FONTS,
  DEFAULT_CATEGORY,
  type FontConfigLike,
} from '../../utils/font-stack';

/**
 * Font stack builder — guarantees that NO slot dictates a category.
 * Consumers can pick serif, sans-serif, or monospace for title, heading,
 * body, or mono independently.
 */
describe('font-stack', () => {
  describe('fontStack', () => {
    it('returns undefined when font is null/undefined/empty', () => {
      expect(fontStack(null, 'serif')).toBeUndefined();
      expect(fontStack(undefined, 'serif')).toBeUndefined();
      expect(fontStack({ family: '' }, 'serif')).toBeUndefined();
    });

    it('uses declared category for the fallback chain', () => {
      const font: FontConfigLike = { family: 'Inter', category: 'sans-serif' };
      expect(fontStack(font, 'serif')).toBe("'Inter', system-ui, sans-serif");
    });

    it('falls back to defaultCategory when category is omitted (backward compat)', () => {
      const font: FontConfigLike = { family: 'Inter' };
      // Default category is serif (header slot's prior behavior).
      expect(fontStack(font, 'serif')).toBe("'Inter', Georgia, serif");
    });

    it('lets a sans-serif font be installed in the title slot', () => {
      // The whole point of the redesign: titles don't have to be serif.
      const font: FontConfigLike = { family: 'Inter', category: 'sans-serif' };
      expect(fontStack(font, DEFAULT_CATEGORY.title)).toBe("'Inter', system-ui, sans-serif");
    });

    it('lets a serif font be installed in the body slot', () => {
      const font: FontConfigLike = { family: 'Merriweather', category: 'serif' };
      expect(fontStack(font, DEFAULT_CATEGORY.body)).toBe("'Merriweather', Georgia, serif");
    });

    it('supports monospace category for any slot', () => {
      const font: FontConfigLike = { family: 'JetBrains Mono', category: 'monospace' };
      expect(fontStack(font, DEFAULT_CATEGORY.mono)).toBe(
        "'JetBrains Mono', ui-monospace, \"JetBrains Mono\", Menlo, Monaco, monospace",
      );
    });
  });

  describe('DEFAULT_FONTS', () => {
    it('preserves the Glossarist visual identity (serif title + serif heading + sans body + mono)', () => {
      // These defaults are NOT a dictate — consumers can override any slot
      // to any category. They exist so existing deployments don't change
      // appearance on upgrade.
      expect(DEFAULT_FONTS.title).toContain('DM Serif Display');
      expect(DEFAULT_FONTS.heading).toContain('DM Serif Display');
      expect(DEFAULT_FONTS.body).toContain('DM Sans');
      expect(DEFAULT_FONTS.mono).toContain('JetBrains Mono');
    });

    it('every default stack includes the appropriate fallback category', () => {
      expect(DEFAULT_FONTS.title).toMatch(/Georgia, serif/);
      expect(DEFAULT_FONTS.heading).toMatch(/Georgia, serif/);
      expect(DEFAULT_FONTS.body).toMatch(/system-ui, sans-serif/);
      expect(DEFAULT_FONTS.mono).toMatch(/monospace/);
    });
  });

  describe('DEFAULT_CATEGORY', () => {
    it('does NOT force title to be serif — it is only the default', () => {
      // The default for title IS serif (visual identity), but consumers
      // can override to any category. The default is just a fallback
      // when `category` is omitted on the FontConfig.
      expect(DEFAULT_CATEGORY.title).toBe('serif');
      expect(DEFAULT_CATEGORY.heading).toBe('serif');
      expect(DEFAULT_CATEGORY.body).toBe('sans-serif');
      expect(DEFAULT_CATEGORY.mono).toBe('monospace');
    });
  });

  describe('regression — every slot can be every category', () => {
    // Pin the contract: the consumer can install any category in any slot.
    // This is the answer to "What do you have to dictate that headers must
    // be serif?" — nothing, anymore.
    const categories: Array<['serif' | 'sans-serif' | 'monospace', RegExp]> = [
      ['serif', /Georgia, serif/],
      ['sans-serif', /system-ui, sans-serif/],
      ['monospace', /monospace/],
    ];
    const slots = ['title', 'heading', 'body', 'mono'] as const;

    for (const slot of slots) {
      for (const [category, expectedFallback] of categories) {
        it(`slot=${slot} with category=${category} → fallback matches`, () => {
          const font: FontConfigLike = { family: 'TestFont', category };
          const stack = fontStack(font, DEFAULT_CATEGORY[slot])!;
          expect(stack).toContain("'TestFont'");
          expect(stack).toMatch(expectedFallback);
        });
      }
    }
  });
});
