type PlurimathCtor = new (data: string, format: string) => {
  toAsciimath(): string;
  toLatex(): string;
  toMathml(): string;
  toHtml(): string;
  toOmml(): string;
  toDisplay(lang: string): string;
};

let Plurimath: PlurimathCtor | null = null;
let loading: Promise<PlurimathCtor> | null = null;

export async function loadPlurimath(): Promise<PlurimathCtor> {
  if (Plurimath) return Plurimath;
  if (loading) return loading;
  loading = import('@plurimath/plurimath').then(m => {
    Plurimath = m.default as PlurimathCtor;
    return Plurimath;
  });
  return loading;
}

export function renderToMathML(expr: string, format: string): string | null {
  if (!Plurimath) return null;
  try {
    const p = new Plurimath(expr, format);
    return p.toMathml().replace('display="block"', 'display="inline"').trim();
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function mathToHtml(expr: string, format: string, bold: boolean): string {
  const mathml = renderToMathML(expr, format);
  if (mathml) {
    return `<span class="math-inline${bold ? ' math-bold' : ''}">${mathml}</span>`;
  }
  return `<code class="math-fallback">${escapeHtml(expr)}</code>`;
}
