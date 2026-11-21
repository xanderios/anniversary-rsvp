// The cog at the top right: a small menu to choose how detailed the 3D scene is.
const OPCOES = [
  ['auto', 'Automática', 'Ajusta sozinha ao seu aparelho'],
  ['high', 'Alta', 'Mais detalhes e nitidez'],
  ['medium', 'Média', 'Equilíbrio entre beleza e leveza'],
  ['low', 'Baixa', 'Mais leve, para aparelhos antigos'],
];
const NOMES = { low: 'baixa', medium: 'média', high: 'alta' };
const COG = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="12" cy="12" r="8.6" stroke-width="3" stroke-dasharray="3.38 3.375"/><circle cx="12" cy="12" r="6.1" stroke-width="2.2"/><circle cx="12" cy="12" r="2.3" stroke-width="1.7"/></g></svg>';

export function createSettings({ onChoose }) {
  const raiz = document.createElement('div');
  raiz.id = 'ajustes';
  raiz.hidden = true;
  raiz.innerHTML = `
    <button type="button" class="aj-cog" aria-haspopup="true" aria-expanded="false" aria-controls="aj-menu" aria-label="Qualidade da imagem">${COG}</button>
    <div class="aj-menu" id="aj-menu" role="radiogroup" aria-label="Qualidade da imagem" hidden>
      <p class="aj-title">Qualidade da imagem</p>
      ${OPCOES.map(([v, nome, nota]) => `<button type="button" class="aj-op" role="radio" aria-checked="false" data-v="${v}"><i aria-hidden="true"></i><span><b>${nome}</b><small>${nota}</small></span></button>`).join('')}
    </div>`;
  document.body.appendChild(raiz);
  const cog = raiz.querySelector('.aj-cog'), menu = raiz.querySelector('.aj-menu'), ops = [...raiz.querySelectorAll('.aj-op')];
  const notaAuto = ops[0].querySelector('small');
  let aberto = false;

  function abrir(sim) {
    if (sim === aberto) return;
    aberto = sim;
    menu.hidden = !sim;
    cog.setAttribute('aria-expanded', String(sim));
    if (sim) (ops.find((o) => o.getAttribute('aria-checked') === 'true') || ops[0]).focus();
  }
  cog.addEventListener('click', () => abrir(!aberto));
  addEventListener('pointerdown', (e) => { if (aberto && !raiz.contains(e.target)) abrir(false); }, { passive: true });
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aberto) { e.stopPropagation(); abrir(false); cog.focus(); return; }
    if (!aberto || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = ops.indexOf(document.activeElement);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? ops.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + ops.length) % ops.length;
    ops[j].focus();
  });
  raiz.addEventListener('focusout', (e) => { if (aberto && e.relatedTarget && !raiz.contains(e.relatedTarget)) abrir(false); });
  ops.forEach((o) => o.addEventListener('click', () => { onChoose(o.dataset.v); }));

  return {
    show() { raiz.hidden = false; },
    // choice: what the guest picked (auto / low / medium / high); level: what is being drawn; busy: a change is loading
    update({ choice, level, busy }) {
      ops.forEach((o) => { o.setAttribute('aria-checked', String(o.dataset.v === choice)); o.disabled = !!busy; });
      notaAuto.textContent = busy ? 'Aplicando…' : choice === 'auto' && level ? `Ajusta sozinha ao seu aparelho (agora: ${NOMES[level]})` : 'Ajusta sozinha ao seu aparelho';
      raiz.classList.toggle('busy', !!busy);
    },
  };
}
