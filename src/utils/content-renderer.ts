/**
 * Content renderer: transforms Glossarist inline content notation to HTML.
 *
 * Handles ALL inline rendering — mentions, cross-references, citations,
 * math placeholders, tables, lists, and text formatting. This is the single
 * source of truth for content rendering in the browser.
 *
 * Unified mention syntax: {{kind:target[, label]}}
 * Every inline reference is a typed mention with a kind prefix:
 *
 *   - {{cite:key[, label]}}    → citeResolver (concept source citation)
 *   - {{urn:...[, label]}}     → xrefResolver (URN routing)
 *   - {{fig:id[, label]}}      → nonVerbalRefResolver (figure)
 *   - {{table:id[, label]}}    → nonVerbalRefResolver (table)
 *   - {{formula:id[, label]}}  → nonVerbalRefResolver (formula)
 *   - {{bib:id[, label]}}      → bibResolver (bibliography entry, case-3-only)
 *   - {{link:URL[, label]}}    → linkResolver (external URL)
 *   - {{image:src[, alt]}}     → imageResolver (inline image embed)
 *   - {{designation[, label]}} → conceptRefResolver (designation match)
 *   - {{numeric_id[, label]}}  → conceptRefResolver (numeric ID match)
 *
 * Legacy `<<ref,title>>` (AsciiDoc xref) is deprecated; emits a console
 * warning and renders as plain text. Migrate to {{kind:target}} syntax.
 *
 * Math-specific helpers (replaceBracketed, mathPlaceholder) are internal.
 * The v-math directive upgrades the placeholders to Plurimath at runtime.
 */
import { escapeHtml, escapeAttr } from './escape';
import { sanitizeUrl, isSafeUrl } from './url-safety';
import { parseMention } from 'glossarist';
import type { NonVerbalKind } from '../adapters/non-verbal/types';
import { entityKindFromMentionKind } from '../adapters/non-verbal/kind';

// ── Resolver types ────────────────────────────────────────────────────────

export type XrefResolver = (uri: string, term: string) => string;
export type BibResolver = (refId: string, title: string) => string;
export type CiteResolver = (key: string, label: string | null) => string;
export type ConceptRefResolver = (conceptId: string, term: string) => string;
export type NonVerbalRefResolver = (kind: NonVerbalKind, entityId: string, display?: string) => string;
export type LinkResolver = (url: string, label: string) => string;
export type ImageResolver = (src: string, alt: string) => string;

export interface RenderOptions {
  xrefResolver?: XrefResolver;
  bibResolver?: BibResolver;
  conceptRefResolver?: ConceptRefResolver;
  citeResolver?: CiteResolver;
  nonVerbalRefResolver?: NonVerbalRefResolver;
  linkResolver?: LinkResolver;
  imageResolver?: ImageResolver;
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

/**
 * AsciiDoc table attribute line, e.g.
 *   [cols="3", options="noheader,unnumbered"]
 *   [format="dsv"]
 * Lives immediately before the `|===` opener. The renderer does not honour
 * these attributes (no column sizing, no header suppression), so we strip
 * them to avoid leaking as literal text in the output.
 */
const ASCII_DOC_TABLE_ATTR_RE = /\n?\[[^\]\n]+\]\s*\n(?=\n?\|===)/g;

/**
 * Pre-row span/alignment modifier prefix that can appear before a leading
 * pipe:
 *   .2+        → cell spans 2 columns
 *   .3+        → cell spans 3 columns
 *   2+         → cell spans 2 rows
 *   a>         → horizontal alignment
 * The renderer does not honour spans, so we strip the modifier.
 */
const ASCII_DOC_LEADING_SPAN_PIPE_RE = /^[.\d+]+[+>]+\s*\|/;

/**
 * Cell-span modifier prefix that can appear inside a cell (after the pipe):
 *   .2+ cell content   →   cell content
 * Kept separate from ASCII_DOC_LEADING_SPAN_PIPE_RE because the leading
 * variant consumes the pipe whereas this one only consumes the modifier.
 */
const ASCII_DOC_CELL_SPAN_RE = /^[.]\d+[+]|[.]\d+>[>]?\s*/g;

/**
 * Trailing cell-continuation marker ` +` at the end of a row line means
 * "the next physical line continues this cell". The renderer joins such
 * lines into the same cell with a `<br>` separator.
 */
const ASCII_DOC_CELL_CONTINUATION_RE = /\s\+\s*$/;

function stripAsciiDocTableAttributes(text: string): string {
  return text.replace(ASCII_DOC_TABLE_ATTR_RE, '\n');
}

function convertAsciiDocTables(text: string): string {
  const prepared = stripAsciiDocTableAttributes(text);
  return prepared.replace(/\n?\|===\n([\s\S]*?)\n\|===/g, (_: string, body: string) => {
    const lines: string[] = body.split('\n');
    if (!lines.some((l: string) => l.trim() !== '')) return '';

    // State machine for joining `+` continuation lines into the same cell
    // and grouping cells into rows. Two formats are supported:
    //
    //   1. Simple one-row-per-line:
    //        | a | b | c
    //        | d | e | f
    //      Each leading `|` starts a new row.
    //
    //   2. Continuation-based multi-cell rows (used by VIM and other
    //      bilingual sources):
    //        | english-line +
    //        french line | next-cell +
    //        more of next-cell
    //      A `|` at the start of a line, AFTER the current row has used
    //      a `+` continuation, starts a new CELL in the SAME row.
    //
    // The disambiguation state is `rowHasContinuation`: once any line in
    // the current row has used `+`, subsequent leading `|` lines are new
    // cells in that row. Otherwise (simple format), they are new rows.
    const rows: string[][] = [];
    let currentRow: string[] | null = null;
    let rowHasContinuation = false;
    let prevLineEndedWithContinuation = false;

    const flushRow = () => {
      if (currentRow !== null && currentRow.length > 0) rows.push(currentRow);
      currentRow = null;
      rowHasContinuation = false;
      prevLineEndedWithContinuation = false;
    };

    for (const line of lines) {
      if (line.trim() === '') {
        flushRow();
        continue;
      }

      const startsWithPipe = ASCII_DOC_LEADING_SPAN_PIPE_RE.test(line) || /^\s*\|/.test(line);
      const endsWithContinuation = ASCII_DOC_CELL_CONTINUATION_RE.test(line);
      const cleaned = line
        .replace(ASCII_DOC_LEADING_SPAN_PIPE_RE, '|')
        .replace(ASCII_DOC_CELL_CONTINUATION_RE, '')
        .trim();

      if (startsWithPipe && !rowHasContinuation) {
        // New row in simple format.
        flushRow();
        const cellText = cleaned.replace(/^\s*\|/, '').trim();
        const newCells = cellText.split(/\s*\|\s*/).map(stripCellSpanModifier).filter(c => c !== '');
        currentRow = newCells;
      } else if (startsWithPipe && rowHasContinuation) {
        // New cell in the same row (continuation format).
        if (currentRow === null) currentRow = [];
        const cellText = cleaned.replace(/^\s*\|/, '').trim();
        const newCells = cellText.split(/\s*\|\s*/).map(stripCellSpanModifier).filter(c => c !== '');
        currentRow.push(...newCells);
      } else if (currentRow !== null && prevLineEndedWithContinuation) {
        // Continuation of the previous cell — append with <br>.
        // The continuation line may itself contain `|`-separated cells,
        // so split it; the first piece joins the last cell, the rest
        // become new cells in the same row.
        const pieces = cleaned.split(/\s*\|\s*/).map(stripCellSpanModifier).filter(c => c !== '');
        if (pieces.length > 0 && currentRow.length > 0) {
          currentRow[currentRow.length - 1] = `${currentRow[currentRow.length - 1]}<br>${pieces[0]}`;
          if (pieces.length > 1) currentRow.push(...pieces.slice(1));
        } else if (pieces.length > 0) {
          currentRow.push(pieces[0]);
          if (pieces.length > 1) currentRow.push(...pieces.slice(1));
        }
      } else {
        // Stray non-pipe line outside any continuation — treat as a new
        // single-cell row so the content is not lost.
        flushRow();
        currentRow = [cleaned];
      }

      if (endsWithContinuation) {
        rowHasContinuation = true;
        prevLineEndedWithContinuation = true;
      } else {
        prevLineEndedWithContinuation = false;
      }
    }
    flushRow();

    const parsedRows: string[][] = rows.filter((r: string[]) => r.length > 0);
    if (!parsedRows.length) return '';

    const maxCols = Math.max(...parsedRows.map((r: string[]) => r.length));
    const normalized = parsedRows.map((r: string[]) => {
      while (r.length < maxCols) r.push('');
      return r;
    });

    // Cells may already contain rendered math spans (from stage 1) and
    // inline formatting (italic, subscript) from stage 3. escapeHtml
    // would double-escape the angle brackets inside those spans and
    // cause the browser to render them as literal text. Pass cell
    // content through unchanged.
    const thead = normalized[0].map((c: string) => `<th>${c}</th>`).join('');
    const tbody = normalized.slice(1).map((r: string[]) =>
      `<tr>${r.map((c: string) => `<td>${c}</td>`).join('')}</tr>`
    ).join('');

    return `\n<table class="concept-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
  });
}

function stripCellSpanModifier(cell: string): string {
  return cell.replace(ASCII_DOC_CELL_SPAN_RE, '').trim();
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
    const lis = items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
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
    const lis = items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    return `\n<ol class="concept-list concept-list-ordered">${lis}</ol>`;
  });

  return result;
}

// ── Inline reference resolution ──────────────────────────────────────────

/**
 * Deprecated AsciiDoc xref syntax: <<refId, title>>
 *
 * This was historically overloaded for:
 *   1. Non-concept entity xrefs (should use {{fig/table/formula:id, label}})
 *   2. Bibliography lookups (should use {{bib:id}} or {{cite:id}})
 *   3. Concept citations (should use {{cite:id}})
 *
 * All three uses are wrong. This function emits a deprecation warning and
 * renders the title as plain text. Datasets should migrate to the unified
 * {{kind:target}} syntax.
 */
function resolveLegacyXref(text: string): string {
  return text.replace(/<<([^,>]+),([^>]+)>>/g, (_, refId, title) => {
    const rid = refId.trim();
    const lbl = title.trim();
    if (typeof console !== 'undefined') {
      console.warn(
        `[glossarist] <<${rid},${lbl}>> is deprecated. ` +
        `Use {{fig/table/formula:${rid}, ${lbl}}} for non-concept entities, ` +
        `{{cite:${rid}}} for concept citations, or {{bib:${rid}}} for bibliography.`,
      );
    }
    return `<span class="legacy-xref" title="Deprecated: use {{kind:target}} syntax">${escapeHtml(lbl)}</span>`;
  });
}

function resolveUrnRefs(text: string, opts: RenderOptions): string {
  // Double-brace URN refs: {{urn:...,term}} or {{urn:...,term,display}}
  // These bypass parseMention because the three-arg form has different
  // semantics in the renderer (display shown, not term) vs. cleanContent
  // (term shown for search indexing).
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
  return text.replace(/\{\{([^{}]+?)\}\}/g, (_orig, body) => {

    // ── New kinds: link, image, bib (pre-parsed before parseMention) ──
    // These follow the same {{kind:target[, label]}} convention as
    // fig/table/formula but are handled here because glossarist's
    // parseMention doesn't recognize them yet. When glossarist-js adds
    // support (per PROMPT-NOW.md), these pre-parse cases can be removed
    // and the switch below will handle them natively.

    const linkMatch = body.match(/^link:(.+)$/i);
    if (linkMatch) {
      const rest = linkMatch[1];
      const commaIdx = rest.indexOf(',');
      const url = (commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim());
      const label = commaIdx > 0 ? rest.slice(commaIdx + 1).trim() : url;
      if (opts.linkResolver) return opts.linkResolver(url, label);
      const safeUrl = sanitizeUrl(url);
      if (!safeUrl) return escapeHtml(label);
      return `<a href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener" class="ext-link">${escapeHtml(label)}</a>`;
    }

    const imageMatch = body.match(/^image:(.+)$/i);
    if (imageMatch) {
      const rest = imageMatch[1];
      const commaIdx = rest.indexOf(',');
      const src = (commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim());
      const alt = commaIdx > 0 ? rest.slice(commaIdx + 1).trim() : '';
      if (opts.imageResolver) return opts.imageResolver(src, alt);
      if (!isSafeUrl(src)) return escapeHtml(alt || src);
      return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" class="inline-image" />`;
    }

    const bibMatch = body.match(/^bib:(.+)$/i);
    if (bibMatch) {
      const rest = bibMatch[1];
      const commaIdx = rest.indexOf(',');
      const id = (commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim());
      const label = commaIdx > 0 ? rest.slice(commaIdx + 1).trim() : id;
      if (opts.bibResolver) return opts.bibResolver(id, label);
      return `<span class="bib-ref">${escapeHtml(label)}</span>`;
    }

    // ── Existing kinds: handled by glossarist's parseMention ──
    const parsed = parseMention(body);
    const p = parsed as unknown as Record<string, unknown>;

    switch (p.kind) {
      case 'fig-ref':
      case 'table-ref':
      case 'formula-ref': {
        const nvKind = entityKindFromMentionKind(p.kind as string) as NonVerbalKind;
        const entityId = p.key as string;
        const display = (p.label as string) ?? undefined;
        if (opts.nonVerbalRefResolver) {
          return opts.nonVerbalRefResolver(nvKind, entityId, display);
        }
        const label = display ?? entityId;
        return `<span class="nv-ref nv-ref--${nvKind}">${escapeHtml(label)}</span>`;
      }

      case 'cite-ref': {
        const key = p.key as string;
        const label = (p.label as string) ?? null;
        if (opts.citeResolver) return opts.citeResolver(key, label);
        return `<span class="bib-ref">${escapeHtml(label ?? key)}</span>`;
      }

      case 'urn-ref': {
        const uri = p.uri as string;
        const label = (p.label as string) ?? uri;
        if (opts.xrefResolver) return opts.xrefResolver(uri, label);
        return escapeHtml(label);
      }

      case 'numeric': {
        const id = p.id as string;
        const label = p.label as string | null;
        if (label && opts.conceptRefResolver) {
          return opts.conceptRefResolver(id, label);
        }
        return `<span class="gl-mention">${escapeHtml(id)}</span>`;
      }

      case 'designation': {
        const designation = p.id as string;
        const label = (p.label as string) ?? designation;
        if (opts.conceptRefResolver) {
          return opts.conceptRefResolver(designation, label);
        }
        return escapeHtml(label);
      }

      default: {
        const commaIdx = body.indexOf(',');
        if (commaIdx > 0) {
          const id = body.slice(0, commaIdx).trim();
          const display = body.slice(commaIdx + 1).trim();
          if (opts.conceptRefResolver) return opts.conceptRefResolver(id, display);
          return escapeHtml(display);
        }
        return `<span class="gl-mention">${escapeHtml(body.trim())}</span>`;
      }
    }
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
 * 5. Legacy AsciiDoc xrefs (<<ref,title>> → deprecated, renders as plain text)
 * 6. URN inline references ({urn:...})
 * 7. Mention dispatcher — link/image/bib (pre-parsed), then parseMention
 *    (fig/table/formula, cite-ref, urn-ref, numeric, designation)
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
  result = resolveLegacyXref(result);
  result = resolveUrnRefs(result, opts);

  // Stage 5: Mention dispatcher (non-verbal first, then parseMention SSOT)
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
    // Legacy xrefs first (before HTML tag stripping eats <<)
    .replace(/<<([^,>]+),([^>]+)>>/g, '$2')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/~([^~]+)~/g, '_$1')
    .replace(/\n[ \t]*\* /g, '; ')
    // Entity mentions: {{fig:id, display}} → display; {{fig:id}} → id
    .replace(/\{\{(?:fig|figure|table|tbl|formula|eq):([^,}]+),\s*([^}]+)\}\}/g, '$2')
    .replace(/\{\{(?:fig|figure|table|tbl|formula|eq):([^}]+)\}\}/g, '$1')
    // Link mentions: {{link:URL, label}} → label; {{link:URL}} → URL
    .replace(/\{\{link:([^,}]+),\s*([^}]+)\}\}/gi, '$2')
    .replace(/\{\{link:([^}]+)\}\}/gi, '$1')
    // Image mentions: {{image:src, alt}} → alt; {{image:src}} → empty
    .replace(/\{\{image:[^,}]+,\s*([^}]+)\}\}/gi, '$1')
    .replace(/\{\{image:([^}]+)\}\}/gi, '')
    // Bib mentions: {{bib:id, label}} → label; {{bib:id}} → id
    .replace(/\{\{bib:([^,}]+),\s*([^}]+)\}\}/gi, '$2')
    .replace(/\{\{bib:([^}]+)\}\}/gi, '$1')
    // URN refs — show render term (second part for two-arg, third part for three-arg)
    .replace(/\{\{urn:[^,}]+,([^,}]+),([^}]+)\}\}/g, '$1')
    .replace(/\{\{urn:[^,}]+(?:,([^}]+))?\}\}/g, (_, label) => label ? label.trim() : '')
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
