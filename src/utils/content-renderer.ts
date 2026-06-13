/**
 * Content renderer: transforms Glossarist inline content notation to HTML.
 *
 * Handles ALL inline rendering — mentions, cross-references, citations,
 * math placeholders, tables, lists, and text formatting. This is the single
 * source of truth for content rendering in the browser.
 *
 * Math-specific helpers (replaceBracketed, mathPlaceholder) are internal.
 * The v-math directive upgrades the placeholders to KaTeX at runtime.
 */
import { escapeHtml, escapeAttr } from './escape';
import { parseMention } from 'glossarist';

// ── Resolver types ────────────────────────────────────────────────────────

export type XrefResolver = (uri: string, term: string) => string;
export type BibResolver = (refId: string, title: string) => string;
export type FigResolver = (figId: string) => string;
export type CiteResolver = (key: string, label: string | null) => string;
export type ConceptRefResolver = (conceptId: string, term: string) => string;
export type UrnRefResolver = (uri: string, term: string) => string;

export interface RenderOptions {
  xrefResolver?: XrefResolver;
  bibResolver?: BibResolver;
  figResolver?: FigResolver;
  conceptRefResolver?: ConceptRefResolver;
  citeResolver?: CiteResolver;
  urnRefResolver?: UrnRefResolver;
}

// ── Math placeholders ────────────────────────────────────────────────────

function replaceBracketed(text: string, prefix: string, handler: (content: string, bold: boolean) => string): string {
  let result = '';
  let i = 0;
  const boldPrefix = '*' + prefix;
  while (i < text.length) {
    if (text.startsWith(boldPrefix + '[', i)) {
      i += boldPrefix.length + 1;
      let j = i;
      let d = 1;
      while (j < text.length && d > 0) {
        if (text[j] === '[') d++;
        else if (text[j] === ']') d--;
        j++;
      }
      const content = text.slice(i, j - 1);
      let end = j;
      if (end < text.length && text[end] === '*') end++;
      result += handler(content, true);
      i = end;
    } else if (text.startsWith(prefix + '[', i)) {
      i += prefix.length + 1;
      let j = i;
      let d = 1;
      while (j < text.length && d > 0) {
        if (text[j] === '[') d++;
        else if (text[j] === ']') d--;
        j++;
      }
      const content = text.slice(i, j - 1);
      result += handler(content, false);
      i = j;
    } else {
      result += text[i];
      i++;
    }
  }
  return result;
}

function mathPlaceholder(expr: string, format: string, bold: boolean): string {
  return `<span class="math-pending${bold ? ' math-bold' : ''}" data-expr="${escapeAttr(expr)}" data-format="${format}">${escapeAttr(expr)}</span>`;
}

// ── Block transforms ─────────────────────────────────────────────────────

function convertAsciiDocTables(text: string): string {
  return text.replace(/\n?\|===\n([\s\S]*?)\n\|===/g, (_: string, body: string) => {
    const rows: string[] = body.split('\n').filter((line: string) => line.trim() !== '');
    if (!rows.length) return '';

    const parsedRows: string[][] = rows.map((row: string) => {
      const cellText = row.replace(/^\s*\|/, '').trim();
      const cells = cellText.split(/\s*\|\s*/).map((c: string) => c.trim()).filter((c: string) => c !== '');
      return cells;
    }).filter((r: string[]) => r.length > 0);

    if (!parsedRows.length) return '';

    const maxCols = Math.max(...parsedRows.map((r: string[]) => r.length));
    const normalized = parsedRows.map((r: string[]) => {
      while (r.length < maxCols) r.push('');
      return r;
    });

    const thead = normalized[0].map((c: string) => `<th>${escapeHtml(c)}</th>`).join('');
    const tbody = normalized.slice(1).map((r: string[]) =>
      `<tr>${r.map((c: string) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
    ).join('');

    return `\n<table class="concept-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
  });
}

function convertLists(text: string): string {
  let result = text.replace(/(?:^|\n)((?:[ \t]*\* [^\n]+)(?:\n[ \t]*\* [^\n]+)*)/g, (_, block) => {
    if (/^\*stem:\[/.test(block.trimStart())) return _;
    const items: string[] = [];
    const re = /[ \t]*\* ([^\n]+)/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      items.push(m[1].trim());
    }
    if (!items.length) return _;
    const lis = items.map(item => `<li>${item}</li>`).join('');
    return `\n<ul class="concept-list">${lis}</ul>`;
  });

  result = result.replace(/(?:^|\n)((?:[ \t]*\d+[).][ \t]+[^\n]+)(?:\n[ \t]*\d+[).][ \t]+[^\n]+)*)/g, (_, block) => {
    const items: string[] = [];
    const re = /[ \t]*\d+[).][ \t]+([^\n]+)/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      items.push(m[1].trim());
    }
    if (!items.length) return _;
    const lis = items.map(item => `<li>${item}</li>`).join('');
    return `\n<ol class="concept-list concept-list-ordered">${lis}</ol>`;
  });

  return result;
}

// ── Inline reference resolution ──────────────────────────────────────────

function resolveBibRefs(text: string, opts: RenderOptions): string {
  return text.replace(/<<([^,>]+),([^>]+)>>/g, (_, refId, title) => {
    if (opts.bibResolver) {
      return opts.bibResolver(refId.trim(), title.trim());
    }
    return `<span class="bib-ref">${escapeHtml(title.trim())}</span>`;
  });
}

function resolveFigRefs(text: string, opts: RenderOptions): string {
  return text.replace(/<<(fig_[^>]+)>>/g, (_, figId) => {
    if (opts.figResolver) {
      return opts.figResolver(figId.trim());
    }
    return `<span class="fig-ref">${escapeHtml(figId.trim())}</span>`;
  });
}

function resolveUrnRefs(text: string, opts: RenderOptions): string {
  // Double-brace URN refs: {{urn:...,term}} or {{urn:...,term,display}}
  // Note: glossarist ≥ 0.3.7 parseMention handles these as 'urn-ref', but we
  // keep this handler for when parseMention returns 'unresolved' (glossarist < 0.3.7)
  let result = text.replace(/\{\{(urn:[^,}]+),([^,}]+)(?:,([^}]+))?\}\}/g, (_, uri, term, display) => {
    const t = (display || term).trim();
    if (opts.xrefResolver) {
      return opts.xrefResolver(uri, t);
    }
    return t;
  });

  // Single-brace URN refs: {urn:...,term} or {urn:...,term,display}
  result = result.replace(/\{(urn:[^,}]+),([^,}]+)(?:,([^}]+))?\}/g, (_, uri, term, display) => {
    const t = (display || term).trim();
    if (opts.xrefResolver) {
      return opts.xrefResolver(uri, t);
    }
    return t;
  });

  return result;
}

function resolveMentions(text: string, opts: RenderOptions): string {
  // Single-pass {{...}} mention dispatcher via parseMention (SSOT)
  return text.replace(/\{\{([^{}]+?)\}\}/g, (_orig, body) => {
    const parsed = parseMention(body);

    // cite:key[,render term] — bibliography citation
    if (parsed.kind === 'cite-ref') {
      const key = parsed.key!;
      const label = parsed.label ?? null;
      if (opts.citeResolver) return opts.citeResolver(key, label);
      return `<span class="bib-ref">${escapeHtml(label ?? key)}</span>`;
    }

    // urn:...[,render term] — URN cross-reference (glossarist ≥ 0.3.7)
    const anyParsed = parsed as Record<string, unknown>;
    if ((anyParsed.kind as string) === 'urn-ref') {
      const uri = anyParsed.uri as string;
      const label = (anyParsed.label as string) ?? uri;
      if (opts.urnRefResolver) return opts.urnRefResolver(uri, label);
      if (opts.xrefResolver) return opts.xrefResolver(uri, label);
      return escapeHtml(label);
    }

    // numeric_id[,render term] — local concept ID
    if (parsed.kind === 'numeric') {
      const id = parsed.id!;
      const label = parsed.label;
      if (label && opts.conceptRefResolver) {
        return opts.conceptRefResolver(id, label);
      }
      return `<span class="gl-mention">${escapeHtml(id)}</span>`;
    }

    // designation[,render term] — designation matching (glossarist ≥ 0.3.7)
    if ((anyParsed.kind as string) === 'designation') {
      const designation = anyParsed.id as string;
      const label = (anyParsed.label as string) ?? designation;
      if (opts.conceptRefResolver) {
        return opts.conceptRefResolver(designation, label);
      }
      return escapeHtml(label);
    }

    // Fallback for unresolved: handle two-arg form or render as plain text
    // This handles cases where parseMention doesn't recognize the kind
    // (e.g. glossarist < 0.3.7 before urn-ref/designation kinds were added)
    const commaIdx = body.indexOf(',');
    if (commaIdx > 0) {
      const id = body.slice(0, commaIdx).trim();
      const display = body.slice(commaIdx + 1).trim();
      if (opts.conceptRefResolver) return opts.conceptRefResolver(id, display);
      return escapeHtml(display);
    }

    return `<span class="gl-mention">${escapeHtml(body.trim())}</span>`;
  });
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Render Glossarist inline content notation to HTML.
 *
 * Pipeline stages (in order):
 * 1. Math placeholders (stem:, latexmath:)
 * 2. AsciiDoc tables
 * 3. Bullet and numbered lists
 * 4. Text formatting (bold, italic, subscript)
 * 5. Bibliography cross-references (<<ref,title>>)
 * 6. Figure references (<<fig_...>>)
 * 7. Single-brace URN inline references ({urn:...})
 * 8. Mention dispatcher via parseMention (cite-ref, urn-ref, numeric, designation)
 */
export function renderContent(text: string, xrefResolverOrOpts?: XrefResolver | RenderOptions): string {
  if (!text) return '';
  let result = text;

  const opts: RenderOptions = typeof xrefResolverOrOpts === 'function'
    ? { xrefResolver: xrefResolverOrOpts }
    : (xrefResolverOrOpts ?? {});

  // Stage 1: Math expressions → placeholders for v-math directive
  result = replaceBracketed(result, 'stem:', (expr, bold) => mathPlaceholder(expr, 'asciimath', bold));
  result = replaceBracketed(result, 'latexmath:', (expr, bold) => mathPlaceholder(expr, 'latex', bold));

  // Stage 2: Block structures
  result = convertAsciiDocTables(result);
  result = convertLists(result);

  // Stage 3: Inline formatting
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  result = result.replace(/~([^~]+)~/g, '<sub>$1</sub>');

  // Stage 4: Reference resolution
  result = resolveBibRefs(result, opts);
  result = resolveFigRefs(result, opts);
  result = resolveUrnRefs(result, opts);

  // Stage 5: Mention dispatcher (parseMention SSOT)
  result = resolveMentions(result, opts);

  return result;
}

/**
 * Strip all inline notation to produce plain text.
 * Used for search indexing, previews, and accessibility.
 */
export function cleanContent(text: string): string {
  if (!text) return '';
  let result = text
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/~([^~]+)~/g, '_$1')
    .replace(/\n[ \t]*\* /g, '; ')
    .replace(/<<([^,>]+),([^>]+)>>/g, '$2')
    .replace(/<<(fig_[^>]+)>>/g, '$1')
    // URN refs — show render term (second part for two-arg, third part for three-arg)
    .replace(/\{\{urn:[^,}]+,([^,}]+),([^}]+)\}\}/g, '$1')  // three-arg: {{urn:...,term,display}} → term
    .replace(/\{\{urn:[^,}]+(?:,([^}]+))?\}\}/g, (_, label) => label ? label.trim() : '')  // two-arg or bare
    .replace(/\{urn:[^,}]+,([^,}]+)(?:,[^}]+)?\}/g, '$1')
    // Cite refs — show render term (or empty if bare)
    .replace(/\{\{cite:[^,}]+(?:,([^}]+))?\}\}/g, (_, label) => label ? label.trim() : '')
    // Two-arg mentions: show render term (second part)
    .replace(/\{\{([^,}]+),\s*([^}]+)\}\}/g, '$2')
    // One-arg mentions: show the identifier
    .replace(/\{\{([^,}]+)\}\}/g, '$1')
    .replace(/(?:\*?)stem:\[([^\]]*)\]/g, '$1')
    .replace(/(?:\*?)latexmath:\[([^\]]*)\]/g, '$1');
  return result;
}
