// The cog at the top right: a small menu to choose day or night, and how detailed the 3D scene is.
const SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.5M12 18.9v2.5M2.6 12h2.5M18.9 12h2.5M5.35 5.35l1.77 1.77M16.88 16.88l1.77 1.77M5.35 18.65l1.77-1.77M16.88 7.12l1.77-1.77"/></g></svg>';
const LUA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M19.6 14.6A8.2 8.2 0 0 1 9.4 4.4a8.2 8.2 0 1 0 10.2 10.2z"/></svg>';
const CEUS = [['dia', 'Dia', SOL], ['noite', 'Noite', LUA]];
const OPCOES = [
  ['auto', 'Automática', 'Ajusta sozinha ao seu aparelho'],
  ['high', 'Alta', 'Mais detalhes e nitidez'],
  ['medium', 'Média', 'Equilíbrio entre beleza e leveza'],
  ['low', 'Baixa', 'Mais leve, para aparelhos antigos'],
];
const NOMES = { low: 'baixa', medium: 'média', high: 'alta' };
const COG = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="12" cy="12" r="8.6" stroke-width="3" stroke-dasharray="3.38 3.375"/><circle cx="12" cy="12" r="6.1" stroke-width="2.2"/><circle cx="12" cy="12" r="2.3" stroke-width="1.7"/></g></svg>';

export function createSettings({ onChoose, onSky }) {
  const raiz = document.createElement('div');
  raiz.id = 'ajustes';
  raiz.hidden = true;
  raiz.innerHTML = `
    <button type="button" class="aj-cog" aria-haspopup="true" aria-expanded="false" aria-controls="aj-menu" aria-label="Ajustes">${COG}</button>
    <div class="aj-menu" id="aj-menu" role="group" aria-label="Ajustes" hidden>
      <p class="aj-title" id="aj-t-ceu">Céu</p>
      <div class="aj-ceu" role="radiogroup" aria-labelledby="aj-t-ceu">
        ${CEUS.map(([v, nome, icone]) => `<button type="button" class="aj-dn" role="radio" aria-checked="false" data-ceu="${v}">${icone}<b>${nome}</b></button>`).join('')}
      </div>
      <p class="aj-title" id="aj-t-q">Qualidade da imagem</p>
      <div role="radiogroup" aria-labelledby="aj-t-q">
        ${OPCOES.map(([v, nome, nota]) => `<button type="button" class="aj-op" role="radio" aria-checked="false" data-v="${v}"><i aria-hidden="true"></i><span><b>${nome}</b><small>${nota}</small></span></button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(raiz);
  const cog = raiz.querySelector('.aj-cog'), menu = raiz.querySelector('.aj-menu'), ops = [...raiz.querySelectorAll('.aj-op')];
  const ceus = [...raiz.querySelectorAll('.aj-dn')], todos = [...ceus, ...ops];      // every choice, in the order shown
  const notaAuto = ops[0].querySelector('small');
  let aberto = false;

  function abrir(sim) {
    if (sim === aberto) return;
    aberto = sim;
    menu.hidden = !sim;
    cog.setAttribute('aria-expanded', String(sim));
    if (sim) (todos.find((o) => o.getAttribute('aria-checked') === 'true') || todos[0]).focus();
  }
  cog.addEventListener('click', () => abrir(!aberto));
  addEventListener('pointerdown', (e) => { if (aberto && !raiz.contains(e.target)) abrir(false); }, { passive: true });
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aberto) { e.stopPropagation(); abrir(false); cog.focus(); return; }
    if (!aberto || !['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = todos.indexOf(document.activeElement), n = todos.length;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + n) % n;
    todos[j].focus();
  });
  raiz.addEventListener('focusout', (e) => { if (aberto && e.relatedTarget && !raiz.contains(e.relatedTarget)) abrir(false); });
  ops.forEach((o) => o.addEventListener('click', () => { onChoose(o.dataset.v); }));
  ceus.forEach((o) => o.addEventListener('click', () => { onSky(o.dataset.ceu); }));

  return {
    show() { raiz.hidden = false; },
    // steps aside while the open page is scrolled away from its top (it would sit on the cards)
    tuck(sim) { const fora = sim && !aberto; if (fora !== raiz.inert) { raiz.inert = fora; raiz.classList.toggle('fora', fora); } },
    // which sky is showing: 'dia' or 'noite'
    sky(v) { ceus.forEach((o) => o.setAttribute('aria-checked', String(o.dataset.ceu === v))); },
    // choice: what the guest picked (auto / low / medium / high); level: what is being drawn; busy: a change is loading
    update({ choice, level, busy }) {
      ops.forEach((o) => { o.setAttribute('aria-checked', String(o.dataset.v === choice)); o.disabled = !!busy; });
      notaAuto.textContent = busy ? 'Aplicando…' : choice === 'auto' && level ? `Ajusta sozinha ao seu aparelho (agora: ${NOMES[level]})` : 'Ajusta sozinha ao seu aparelho';
      raiz.classList.toggle('busy', !!busy);
    },
  };
}
