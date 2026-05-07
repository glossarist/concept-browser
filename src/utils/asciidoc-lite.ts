/**
 * Lightweight AsciiDoc-to-HTML converter for news posts.
 * Handles: paragraphs, headings, bold, italic, monospace, links, lists, source blocks.
 */
export function renderAsciiDocLite(text: string): string {
  if (!text) return '';

  const output: string[] = [];
  const lines = text.split('\n');
  let i = 0;
  let inSourceBlock = false;
  let sourceLines: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Source block delimiter
    if (trimmed.match(/^-{4,}\s*$/) || trimmed.match(/^\.{4,}\s*$/)) {
      if (inSourceBlock) {
        output.push(`<pre><code>${sourceLines.map(escapeHtml).join('\n')}</code></pre>`);
        sourceLines = [];
        inSourceBlock = false;
      } else {
        flushParagraph(output);
        inSourceBlock = true;
      }
      i++;
      continue;
    }

    if (inSourceBlock) {
      sourceLines.push(line);
      i++;
      continue;
    }

    // Empty line — paragraph break
    if (!trimmed) {
      flushParagraph(output);
      i++;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(={1,5})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(output);
      const level = headingMatch[1].length + 1;
      output.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Unordered list item
    if (trimmed.match(/^\*+\s+/)) {
      flushParagraph(output);
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^\*+\s+/)) {
        const itemLine = lines[i].trim();
        const stars = itemLine.match(/^(\*+)\s+/)?.[1].length ?? 1;
        const text = itemLine.replace(/^\*+\s+/, '');
        items.push(`<li class="list-level-${stars}">${inlineFormat(text)}</li>`);
        i++;
      }
      output.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list item
    if (trimmed.match(/^\.\s+/)) {
      flushParagraph(output);
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^\.\s+/)) {
        items.push(`<li>${inlineFormat(lines[i].trim().replace(/^\.\s+/, ''))}</li>`);
        i++;
      }
      output.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Regular text — accumulate into paragraph buffer
    paragraphBuf.push(inlineFormat(trimmed));
    i++;
  }

  flushParagraph(output);

  return output.join('\n');
}

let paragraphBuf: string[] = [];

function flushParagraph(output: string[]) {
  if (paragraphBuf.length > 0) {
    output.push(`<p>${paragraphBuf.join(' ')}</p>`);
    paragraphBuf = [];
  }
}

function inlineFormat(text: string): string {
  // AsciiDoc link: https://example.com[text]
  text = text.replace(/(https?:\/\/[^\s\[]+)\[([^\]]*)\]/g, (_, url, label) =>
    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label || url)}</a>`
  );

  // Bare URLs
  text = text.replace(/(?<!href="|">)(https?:\/\/[^\s<]+)/g, url =>
    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`
  );

  // Monospace: `text`
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold: *text*
  text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');

  // Italic: _text_
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

  return text;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
