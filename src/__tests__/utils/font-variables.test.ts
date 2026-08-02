import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  buildFontVariables,
  renderFontVariablesInline,
  FONT_SLOTS,
  type BrandingFontsLike,
} from '../../utils/font-variables';

/**
 * Single-source-of-truth contract for branding-driven CSS font variables.
 *
 * Bug history (2026-08-01):
 *   - 0.7.106–0.7.110: brand fonts were silently clobbered for
 *     `--font-serif`/`--font-sans`/`--font-mono` because the tailwind.css
 *     `@theme` block emitted `:root, :host { ... }` declarations into the
 *     CSS bundle, which loaded AFTER Default.astro's inline `<style>` and
 *     overrode the brand values per CSS cascade (equal specificity, later
 *     source order wins).
 *   - 0.7.111 contributor patch fixed `:root` block but missed `@theme`.
 *
 * Post-refactor: `buildFontVariables()` is the only emitter. Both
 * `Default.astro` (build-time inline) and `use-site-config.ts` (runtime
 * overrides) call it. The output is the canonical slot-named shape —
 * no `--font-serif`/`--font-sans` category-named variables that bake in
 * serif↔heading / sans↔body assumptions.
 */

describe('buildFontVariables — shape contract', () => {
  it('returns exactly the four slot-named variables', () => {
    const vars = buildFontVariables(null);
    expect(Object.keys(vars).sort()).toEqual(
      ['--font-body', '--font-heading', '--font-mono', '--font-title'],
    );
  });

  it('FONT_SLOTS constant is the canonical slot list', () => {
    expect(FONT_SLOTS).toEqual(['title', 'heading', 'body', 'mono']);
  });

  it('never emits --font-serif or --font-sans (category-named variables are forbidden)', () => {
    const vars = buildFontVariables({
      title: { family: 'Raleway', category: 'sans-serif' },
    });
    expect(vars).not.toHaveProperty('--font-serif');
    expect(vars).not.toHaveProperty('--font-sans');
  });

  it('never emits --font-header as a separate variable (legacy alias handled by CSS, not JS)', () => {
    const vars = buildFontVariables({ header: { family: 'Raleway' } });
    expect(vars).not.toHaveProperty('--font-header');
  });
});

describe('buildFontVariables — defaults preserve Glossarist visual identity', () => {
  it('falls back to DM Serif Display + DM Sans + JetBrains Mono when no branding', () => {
    const vars = buildFontVariables(null);
    expect(vars['--font-title']).toContain('DM Serif Display');
    expect(vars['--font-heading']).toContain('DM Serif Display');
    expect(vars['--font-body']).toContain('DM Sans');
    expect(vars['--font-mono']).toContain('JetBrains Mono');
  });

  it('keeps working when individual slots are missing', () => {
    const vars = buildFontVariables({ title: { family: 'Raleway' } });
    expect(vars['--font-title']).toContain('Raleway');
    expect(vars['--font-heading']).toContain('DM Serif Display');
    expect(vars['--font-body']).toContain('DM Sans');
  });
});

describe('buildFontVariables — brand overrides', () => {
  const raleway: BrandingFontsLike = {
    title:   { family: 'Raleway', category: 'sans-serif' },
    heading: { family: 'Raleway', category: 'sans-serif' },
    body:    { family: 'Raleway', category: 'sans-serif' },
    mono:    { family: 'Fira Code', category: 'monospace' },
  };

  it('produces Raleway stacks for every text slot when consumer sets all four', () => {
    const vars = buildFontVariables(raleway);
    expect(vars['--font-title']).toBe("'Raleway', system-ui, sans-serif");
    expect(vars['--font-heading']).toBe("'Raleway', system-ui, sans-serif");
    expect(vars['--font-body']).toBe("'Raleway', system-ui, sans-serif");
    expect(vars['--font-mono']).toBe("'Fira Code', ui-monospace, \"JetBrains Mono\", Menlo, Monaco, monospace");
  });

  it('honors `header` legacy alias as input for the heading slot', () => {
    const vars = buildFontVariables({ header: { family: 'Inter', category: 'sans-serif' } });
    expect(vars['--font-heading']).toBe("'Inter', system-ui, sans-serif");
  });

  it('`heading` slot wins over legacy `header` alias when both are set', () => {
    const vars = buildFontVariables({
      heading: { family: 'Heading', category: 'sans-serif' },
      header:  { family: 'Header',  category: 'sans-serif' },
    });
    expect(vars['--font-heading']).toContain('Heading');
    expect(vars['--font-heading']).not.toContain('Header');
  });
});

describe('renderFontVariablesInline — serialization', () => {
  it('produces a `:root { ... }` block with every slot variable', () => {
    const css = renderFontVariablesInline({ title: { family: 'Raleway', category: 'sans-serif' } });
    expect(css.startsWith(':root{')).toBe(true);
    expect(css.endsWith('}')).toBe(true);
    expect(css).toContain('--font-title:');
    expect(css).toContain('--font-heading:');
    expect(css).toContain('--font-body:');
    expect(css).toContain('--font-mono:');
    expect(css).toContain("'Raleway'");
  });

  it('separates declarations with semicolons (no trailing junk)', () => {
    const css = renderFontVariablesInline(null);
    // Each declaration is `--font-X: value`, separated by `;`.
    const declCount = css.match(/--font-[a-z]+:/g)!.length;
    const sepCount = css.match(/;/g)!.length;
    expect(declCount).toBe(4);
    expect(sepCount).toBe(3); // 4 declarations = 3 separators (no trailing)
    expect(css).not.toMatch(/;;/);
  });

  it('emits only slot-named variables — never --font-serif / --font-sans', () => {
    const css = renderFontVariablesInline(null);
    expect(css).not.toMatch(/--font-serif/);
    expect(css).not.toMatch(/--font-sans/);
    expect(css).not.toMatch(/--font-header/);
  });
});

/**
 * THE LOAD-BEARING REGRESSION TEST.
 *
 * The bundled CSS must NOT contain `:root, :host { --font-... }` declarations
 * for any slot variable. If it does, the bundle loads after the inline
 * `<style>` and clobbers the brand values per CSS cascade.
 *
 * This test scans the built Default.*.css artifact (produced by
 * `npm run build:astro`) and asserts no font variable appears in a
 * `:root` selector. Skipped when dist/ doesn't exist (fresh clone,
 * before first build).
 */
function findBundleDefaultCss(): string | null {
  const astroDir = resolve(process.cwd(), 'dist/_astro');
  if (!existsSync(astroDir)) return null;
  for (const f of readdirSync(astroDir)) {
    if (f.startsWith('Default.') && f.endsWith('.css')) {
      return readFileSync(resolve(astroDir, f), 'utf-8');
    }
  }
  return null;
}

describe('bundle drift regression — Default.*.css must not clobber brand font vars', () => {
  it('bundle has no `:root,:host{...--font-X: <literal>}` declarations', () => {
    // The bundle's `:root, :host { ... }` block (from @theme) is allowed
    // to define font variables as `var()` references to the slot variables
    // — that's an alias, not a literal. A literal value (e.g.,
    // `--font-serif: "DM Serif Display"`) would clobber the inline <style>.
    const css = findBundleDefaultCss();
    if (css == null) {
      console.warn('Skipping bundle drift test — dist/_astro/Default.*.css not found.');
      return;
    }
    // Find any `--font-X: <value>` declaration in a `:root,:host{...}` block.
    // Reject if the value is a literal (not a var() reference).
    // NOTE: --font-weight-* is a Tailwind font-WEIGHT scale, not a
    // font-family variable — excluded from this drift check.
    const rootBlocks = css.match(/:root[^{]*\{([^}]*)\}/g) ?? [];
    const offenders: string[] = [];
    for (const block of rootBlocks) {
      const fontDecls = block.matchAll(/--font-(title|heading|header|body|mono|serif|sans)\s*:\s*([^;}]+)/g);
      for (const m of fontDecls) {
        const name = m[1];
        const value = m[2].trim();
        if (value.startsWith('var(')) continue; // alias — OK
        if (value === 'initial') continue; // explicit disable — OK
        offenders.push(`--font-${name}: ${value}`);
      }
    }
    expect(
      offenders,
      'bundle must not emit literal font-family values at :root (they clobber inline style)',
    ).toEqual([]);
  });

  it('bundle aliases map to slot variables (no category-named sources)', () => {
    const css = findBundleDefaultCss();
    if (css == null) {
      console.warn('Skipping bundle drift test — dist/_astro/Default.*.css not found.');
      return;
    }
    // Verify the alias wiring is in place: --font-serif → --font-heading,
    // --font-sans → --font-body. These ensure Tailwind's default utility
    // names still work in templates that haven't migrated to slot names.
    expect(css).toMatch(/--font-serif:\s*var\(--font-heading\)/);
    expect(css).toMatch(/--font-sans:\s*var\(--font-body\)/);
  });
});
