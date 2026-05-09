import Plurimath from '@plurimath/plurimath';

type MathFormat = 'asciimath' | 'latex' | 'mathml' | 'html' | 'mahtml' | 'omml';

function renderMathSpan(math: string, format: MathFormat, bold: boolean): string {
  try {
    const p = new Plurimath(math, format);
    const mathml = p.toMathml();
    return `<span class="math-inline${bold ? ' math-bold' : ''}">${mathml}</span>`;
  } catch {
    return `<code class="math-fallback">${escapeHtml(math)}</code>`;
  }
}

export type XrefResolver = (uri: string, term: string) => string;
export type BibResolver = (refId: string, title: string) => string;
export type FigResolver = (figId: string) => string;

export interface RenderOptions {
  xrefResolver?: XrefResolver;
  bibResolver?: BibResolver;
  figResolver?: FigResolver;
}

/**
 * Convert `* item` lines into <ul><li> blocks.
 * Also handles `1)` and `1.` numbered items into ordered lists.
 */
function convertLists(text: string): string {
  // Unordered: * item (separated by \n or \n\n)
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

  // Ordered: 1) item or 1. item (numbered items)
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

/**
 * Replace `prefix:[content]` where content may contain nested brackets.
 * Handles `*prefix:[content]*` (bold) too.
 */
function replaceBracketed(
  text: string,
  prefix: string,
  render: (math: string, bold: boolean) => string,
): string {
  let result = '';
  let i = 0;
  const boldPrefix = '*' + prefix;
  while (i < text.length) {
    // Check for bold variant: *prefix:[...]
    if (text.startsWith(boldPrefix + '[', i)) {
      const start = i;
      i += boldPrefix.length + 1; // skip *prefix:[
      const depth = 1;
      let j = i;
      let d = 1;
      while (j < text.length && d > 0) {
        if (text[j] === '[') d++;
        else if (text[j] === ']') d--;
        j++;
      }
      const content = text.slice(i, j - 1);
      // Check for closing *
      let end = j;
      if (end < text.length && text[end] === '*') end++;
      result += render(content, true);
      i = end;
    }
    // Check for normal variant: prefix:[...]
    else if (text.startsWith(prefix + '[', i)) {
      i += prefix.length + 1;
      let j = i;
      let d = 1;
      while (j < text.length && d > 0) {
        if (text[j] === '[') d++;
        else if (text[j] === ']') d--;
        j++;
      }
      const content = text.slice(i, j - 1);
      result += render(content, false);
      i = j;
    } else {
      result += text[i];
      i++;
    }
  }
  return result;
}

/**
 * Render stem:[...] math notation to KaTeX HTML.
 * Also handles cross-reference inline patterns (URN refs, bibliography, figures).
 */
export function renderMath(text: string, xrefResolverOrOpts?: XrefResolver | RenderOptions): string {
  if (!text) return '';
  let result = text;

  const opts: RenderOptions = typeof xrefResolverOrOpts === 'function'
    ? { xrefResolver: xrefResolverOrOpts }
    : (xrefResolverOrOpts ?? {});

  result = replaceBracketed(result, 'stem:', (math, bold) => renderMathSpan(math, 'asciimath', bold));
  result = replaceBracketed(result, 'latexmath:', (math, bold) => renderMathSpan(math, 'latex', bold));

  result = convertLists(result);

  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  result = result.replace(/~([^~]+)~/g, '<sub>$1</sub>');

  // Handle AsciiDoc bibliography xrefs: <<ref_XX,title>>
  result = result.replace(/<<([^,>]+),([^>]+)>>/g, (_, refId, title) => {
    if (opts.bibResolver) {
      return opts.bibResolver(refId.trim(), title.trim());
    }
    return `<span class="bib-ref">${escapeHtml(title.trim())}</span>`;
  });

  // Handle AsciiDoc figure xrefs: <<fig_XX>>
  result = result.replace(/<<(fig_[^>]+)>>/g, (_, figId) => {
    if (opts.figResolver) {
      return opts.figResolver(figId.trim());
    }
    return `<span class="fig-ref">${escapeHtml(figId.trim())}</span>`;
  });

  // Handle URN inline refs: {{urn:...,term[,displayText]}} (double-braced)
  result = result.replace(/\{\{(urn:[^,}]+),([^,}]+)(?:,([^}]+))?\}\}/g, (_, uri, term, display) => {
    const text = (display || term).trim();
    if (opts.xrefResolver) {
      return opts.xrefResolver(uri, text);
    }
    return text;
  });

  // Handle URN inline refs: {urn:...,term[,displayText]} (single-braced)
  result = result.replace(/\{(urn:[^,}]+),([^,}]+)(?:,([^}]+))?\}/g, (_, uri, term, display) => {
    const text = (display || term).trim();
    if (opts.xrefResolver) {
      return opts.xrefResolver(uri, text);
    }
    return text;
  });

  // Handle any remaining {{...}} refs (fallback: show term before comma)
  result = result.replace(/\{\{([^,}]+)(?:,\s*[^}]+)?\}\}/g, '$1');

  return result;
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
  let result = text
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~([^~]+)~/g, '_$1')
    .replace(/\n[ \t]*\* /g, '; ')
    .replace(/<<([^,>]+),([^>]+)>>/g, '$2')
    .replace(/<<(fig_[^>]+)>>/g, '$1')
    .replace(/\{\{urn:[^,}]+,([^,}]+)(?:,[^}]+)?\}\}/g, '$1')
    .replace(/\{urn:[^,}]+,([^,}]+)(?:,[^}]+)?\}/g, '$1')
    .replace(/\{\{([^,}]+)(?:,\s*[^}]+)?\}\}/g, '$1');
  result = replaceBracketed(result, 'stem:', (math) => math);
  result = replaceBracketed(result, 'latexmath:', (math) => math);
  return result;
}
