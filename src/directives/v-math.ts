import { type Directive } from 'vue';
import { loadPlurimath, mathToHtml } from '../utils/plurimath';

let loaded = false;

function upgrade(el: HTMLElement) {
  const pending = el.querySelectorAll('.math-pending');
  if (!pending.length) return;

  if (!loaded) {
    loadPlurimath().then(() => {
      loaded = true;
      upgrade(el);
    });
    return;
  }

  pending.forEach((span) => {
    const expr = (span as HTMLElement).dataset.expr;
    const format = (span as HTMLElement).dataset.format || 'asciimath';
    const bold = span.classList.contains('math-bold');
    if (!expr) return;
    const html = mathToHtml(expr, format, bold);
    const wrapper = document.createElement('span');
    wrapper.innerHTML = html;
    span.replaceWith(wrapper.firstElementChild || wrapper);
  });
}

export const vMath: Directive<HTMLElement> = {
  updated(el) { upgrade(el); },
  mounted(el) { upgrade(el); },
};
