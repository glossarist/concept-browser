import { escapeHtml } from './escape';
import { sanitizeUrl } from './url-safety';

const INLINE_PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/\*\*(.+?)\*\*/g, m => `<strong>${m[1]}</strong>`],
  [/(?<!\*)\*([^*]+?)\*(?!\*)/g, m => `<em>${m[1]}</em>`],
  [/`([^`]+?)`/g, m => `<code>${m[1]}</code>`],
  [/\[([^\]]+)\]\(([^)]+)\)/g, m => {
    const href = sanitizeUrl(m[2]);
    if (!href) return escapeHtml(m[1]);
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${m[1]}</a>`;
  }],
];

function renderInline(text: string): string {
  for (const [re, fn] of INLINE_PATTERNS) {
    text = text.replace(re, (...args) => fn(args as any));
  }
  return text;
}

export function renderMarkdown(input: string): string {
  const blocks: string[] = [];
  const lines = input.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length + 1; // h2-h5 (h1 reserved for page title)
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      blocks.push('<hr>');
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`);
        i++;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(`<blockquote>${renderInline(quoteLines.join(' '))}</blockquote>`);
      continue;
    }

    // Table
    if (/^\|(.+)\|$/.test(line) && i + 1 < lines.length && /^\|[-:| ]+\|$/.test(lines[i + 1])) {
      const headerCells = line.split('|').map(c => c.trim()).filter(Boolean);
      i += 2; // skip header and separator
      const rows: string[][] = [];
      while (i < lines.length && /^\|(.+)\|$/.test(lines[i])) {
        rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean));
        i++;
      }
      const thCells = headerCells.map(c => `<th>${renderInline(c)}</th>`).join('');
      const trRows = rows.map(r => `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join('')}</tr>`).join('');
      blocks.push(`<table><thead><tr>${thCells}</tr></thead><tbody>${trRows}</tbody></table>`);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,4}\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !line.trimStart().startsWith('```')) {
      paraLines.push(lines[i]);
      i++;
      if (i >= lines.length) break;
    }
    if (paraLines.length) {
      blocks.push(`<p>${renderInline(paraLines.join(' '))}</p>`);
    }
  }

  return blocks.join('\n');
}
