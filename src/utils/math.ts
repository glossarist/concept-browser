import katex from 'katex';

/**
 * Cross-reference resolver: given register, concept ID, and display term,
 * returns HTML (typically a clickable link).
 */
export type XrefResolver = (registerId: string, conceptId: string, term: string) => string;

// URN standard number → register ID (from datasets.yml crossReferences.urnStandardMap)
const URN_STANDARD_MAP: Record<string, string> = {
  "14812": "isotc204",
};

/**
 * Convert `* item` lines into <ul><li> blocks.
 * Must run after stem:[...] processing so math inside list items is already rendered.
 * Lines starting with *stem:[ are bold-math, not list bullets — skip those.
 */
function convertLists(text: string): string {
  // Match one or more bullet lines (possibly separated by blank lines)
  return text.replace(/(?:^|\n\n)((?:[ \t]*\* [^\n]+)(?:\n\n[ \t]*\* [^\n]+)*)/g, (_, block) => {
    if (/^\*stem:\[/.test(block.trimStart())) return _;
    const items: string[] = [];
    const re = /[ \t]*\* ([^\n]+)/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      items.push(m[1].trim());
    }
    if (!items.length) return _;
    const lis = items.map(item => `<li>${item}</li>`).join('');
    return `<ul class="concept-list">${lis}</ul>`;
  });
}

/**
 * Render stem:[...] math notation to KaTeX HTML.
 * Also handles cross-references ({{term, IEV:xxx}} and {{urn:iso:...,term}}).
 *
 * The stem:[...] notation is AsciiMath-like. We pass it to KaTeX in text mode
 * as a fallback — many IEV expressions are simple enough for this to work well.
 */
export function renderMath(text: string, xrefResolver?: XrefResolver): string {
  if (!text) return '';
  let result = text;

  // Replace stem:[...] blocks with KaTeX-rendered spans
  // Handle *stem:[...]* (bold wrapper around math)
  result = result.replace(/\*stem:\[([^\]]*)\]\*/g, (_, math) => {
    return renderKatexSpan(math, true);
  });

  // Handle standalone stem:[...]
  result = result.replace(/stem:\[([^\]]*)\]/g, (_, math) => {
    return renderKatexSpan(math, false);
  });

  // Convert * item lines to <ul><li> (after math, before italic)
  result = convertLists(result);

  // Handle italic markup *text* (non-math)
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Handle subscript ~text~
  result = result.replace(/~([^~]+)~/g, '<sub>$1</sub>');

  // Handle URN inline refs FIRST (double-braced {{urn:...}})
  // Pattern: {{urn:iso:std:iso:NNN:conceptId,term}}
  result = result.replace(/\{\{urn:iso:std:iso:(\d+):([^,}]+),([^}]+)\}\}/g, (_, stdNum, conceptId, term) => {
    const registerId = URN_STANDARD_MAP[stdNum];
    if (xrefResolver && registerId) {
      return xrefResolver(registerId, conceptId, term.trim());
    }
    return term.trim();
  });

  // Handle single-braced URN inline refs (legacy format)
  // Pattern: {urn:iso:std:iso:NNN:conceptId,term}
  result = result.replace(/\{urn:iso:std:iso:(\d+):([^,}]+),([^}]+)\}/g, (_, stdNum, conceptId, term) => {
    const registerId = URN_STANDARD_MAP[stdNum];
    if (xrefResolver && registerId) {
      return xrefResolver(registerId, conceptId, term.trim());
    }
    return term.trim();
  });

  // Handle IEV inline refs
  // Pattern: {{term, IEV:conceptId}}
  result = result.replace(/\{\{([^,}]+),\s*IEV:([^}]+)\}\}/g, (_, term, conceptId) => {
    if (xrefResolver) {
      return xrefResolver('iev', conceptId.trim(), term.trim());
    }
    return term.trim();
  });

  // Handle any remaining {{...}} refs (fallback: show term before comma)
  result = result.replace(/\{\{([^,}]+)(?:,\s*[^}]+)?\}\}/g, '$1');

  return result;
}

function renderKatexSpan(math: string, bold: boolean): string {
  try {
    const html = katex.renderToString(math, {
      throwOnError: false,
      displayMode: false,
      output: 'html',
    });
    return `<span class="math-inline${bold ? ' math-bold' : ''}">${html}</span>`;
  } catch {
    // Fallback: show raw math text
    return `<code class="math-fallback">${escapeHtml(math)}</code>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Clean content for plain text display (no math rendering).
 */
export function cleanContent(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*stem:\[([^\]]*)\]\*/g, '$1')
    .replace(/stem:\[([^\]]*)\]/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~([^~]+)~/g, '_$1')
    .replace(/\n[ \t]*\* /g, '; ')
    .replace(/\{\{urn:iso:std:iso:\d+:([^,}]+),([^}]+)\}\}/g, '$2')
    .replace(/\{urn:iso:std:iso:\d+:([^,}]+),([^}]+)\}/g, '$2')
    .replace(/\{\{([^,}]+),\s*IEV:([^}]+)\}\}/g, '$1')
    .replace(/\{\{([^,}]+)(?:,\s*[^}]+)?\}\}/g, '$1');
}
