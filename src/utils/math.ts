export type XrefResolver = (uri: string, term: string) => string;
export type BibResolver = (refId: string, title: string) => string;
export type FigResolver = (figId: string) => string;

export interface RenderOptions {
  xrefResolver?: XrefResolver;
  bibResolver?: BibResolver;
  figResolver?: FigResolver;
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

export function renderMath(text: string, xrefResolverOrOpts?: XrefResolver | RenderOptions): string {
  if (!text) return '';
  let result = text;

  const opts: RenderOptions = typeof xrefResolverOrOpts === 'function'
    ? { xrefResolver: xrefResolverOrOpts }
    : (xrefResolverOrOpts ?? {});

  // Math (stem/latexmath) is pre-rendered at build time. Only process text formatting.
  result = convertLists(result);
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  result = result.replace(/~([^~]+)~/g, '<sub>$1</sub>');

  result = result.replace(/<<([^,>]+),([^>]+)>>/g, (_, refId, title) => {
    if (opts.bibResolver) {
      return opts.bibResolver(refId.trim(), title.trim());
    }
    return `<span class="bib-ref">${escapeHtml(title.trim())}</span>`;
  });

  result = result.replace(/<<(fig_[^>]+)>>/g, (_, figId) => {
    if (opts.figResolver) {
      return opts.figResolver(figId.trim());
    }
    return `<span class="fig-ref">${escapeHtml(figId.trim())}</span>`;
  });

  result = result.replace(/\{\{(urn:[^,}]+),([^,}]+)(?:,([^}]+))?\}\}/g, (_, uri, term, display) => {
    const t = (display || term).trim();
    if (opts.xrefResolver) {
      return opts.xrefResolver(uri, t);
    }
    return t;
  });

  result = result.replace(/\{(urn:[^,}]+),([^,}]+)(?:,([^}]+))?\}/g, (_, uri, term, display) => {
    const t = (display || term).trim();
    if (opts.xrefResolver) {
      return opts.xrefResolver(uri, t);
    }
    return t;
  });

  result = result.replace(/\{\{([^,}]+)(?:,\s*[^}]+)?\}\}/g, '$1');

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function cleanContent(text: string): string {
  if (!text) return '';
  let result = text
    .replace(/<[^>]+>/g, '') // strip pre-rendered HTML/MathML
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~([^~]+)~/g, '_$1')
    .replace(/\n[ \t]*\* /g, '; ')
    .replace(/<<([^,>]+),([^>]+)>>/g, '$2')
    .replace(/<<(fig_[^>]+)>>/g, '$1')
    .replace(/\{\{urn:[^,}]+,([^,}]+)(?:,[^}]+)?\}\}/g, '$1')
    .replace(/\{urn:[^,}]+,([^,}]+)(?:,[^}]+)?\}/g, '$1')
    .replace(/\{\{([^,}]+)(?:,\s*[^}]+)?\}\}/g, '$1');
  return result;
}
