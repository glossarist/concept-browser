import Plurimath from '@plurimath/plurimath';

function renderToMathML(math, format) {
  try {
    const p = new Plurimath(math, format);
    return p.toMathml().replace('display="block"', 'display="inline"').trim();
  } catch {
    return null;
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceBracketed(text, prefix, render) {
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
      result += render(content, true);
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
      result += render(content, false);
      i = j;
    } else {
      result += text[i];
      i++;
    }
  }
  return result;
}

function renderStem(math, bold) {
  const mathml = renderToMathML(math, 'asciimath');
  if (mathml) {
    return `<span class="math-inline${bold ? ' math-bold' : ''}">${mathml}</span>`;
  }
  return `<code class="math-fallback">${escapeHtml(math)}</code>`;
}

function renderLatexmath(math, bold) {
  const mathml = renderToMathML(math, 'latex');
  if (mathml) {
    return `<span class="math-inline${bold ? ' math-bold' : ''}">${mathml}</span>`;
  }
  return `<code class="math-fallback">${escapeHtml(math)}</code>`;
}

export function preRenderMath(text) {
  if (!text) return '';
  let result = text;
  result = replaceBracketed(result, 'stem:', renderStem);
  result = replaceBracketed(result, 'latexmath:', renderLatexmath);
  return result;
}
