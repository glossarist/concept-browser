import katex from 'katex';

export type XrefResolver = (uri: string, term: string) => string;

/**
 * Convert `* item` lines into <ul><li> blocks.
 */
function convertLists(text: string): string {
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
 * Also handles cross-reference inline patterns (URN refs).
 */
export function renderMath(text: string, xrefResolver?: XrefResolver): string {
  if (!text) return '';
  let result = text;

  result = result.replace(/\*stem:\[([^\]]*)\]\*/g, (_, math) => {
    return renderKatexSpan(math, true);
  });

  result = result.replace(/stem:\[([^\]]*)\]/g, (_, math) => {
    return renderKatexSpan(math, false);
  });

  result = convertLists(result);

  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  result = result.replace(/~([^~]+)~/g, '<sub>$1</sub>');

  // Handle URN inline refs: {{urn:...,term}} (double-braced)
  result = result.replace(/\{\{(urn:[^,}]+),([^}]+)\}\}/g, (_, uri, term) => {
    if (xrefResolver) {
      return xrefResolver(uri, term.trim());
    }
    return term.trim();
  });

  // Handle URN inline refs: {urn:...,term} (single-braced)
  result = result.replace(/\{(urn:[^,}]+),([^}]+)\}/g, (_, uri, term) => {
    if (xrefResolver) {
      return xrefResolver(uri, term.trim());
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
    .replace(/\{\{urn:[^,}]+,([^}]+)\}\}/g, '$1')
    .replace(/\{urn:[^,}]+,([^}]+)\}/g, '$1')
    .replace(/\{\{([^,}]+)(?:,\s*[^}]+)?\}\}/g, '$1');
}
