// Tiny DOM builder: every text goes in as text, never as markup.
//   h('a', { class: 'btn', href, text: 'Ver' })   h('ul', {}, h('li', { text }))
export function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos) if (f != null && f !== false) el.append(f);
  return el;
}

const SVG = 'http://www.w3.org/2000/svg';
// An icon from the sprite in index.html (decorative).
export function icone(id) {
  const svg = document.createElementNS(SVG, 'svg'), use = document.createElementNS(SVG, 'use');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  use.setAttribute('href', `#i-${id}`);
  svg.appendChild(use);
  return svg;
}

export const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
