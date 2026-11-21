// The cog at the top right: a small menu to choose the sky (the clock's, day or night) and how
// detailed the 3D scene is.
const OPCOES = [
  ['auto', 'Automática', 'Ajusta sozinha ao seu aparelho'],
  ['high', 'Alta', 'Mais detalhes e nitidez'],
  ['medium', 'Média', 'Equilíbrio entre beleza e leveza'],
  ['low', 'Baixa', 'Mais leve, para aparelhos antigos'],
];
const NOMES = { low: 'baixa', medium: 'média', high: 'alta' };
const SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.4" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8"/></g></svg>';
const LUA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a.6.6 0 0 0-.8-.7 9.6 9.6 0 1 0 12.3 12.3.6.6 0 0 0-.7-.8Z"/></svg>';
const RELOGIO = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/></g></svg>';
const CEUS = [['auto', 'Relógio', RELOGIO], ['dia', 'Dia', SOL], ['noite', 'Noite', LUA]];
const NOTAS = { auto: 'Acompanha a hora do seu aparelho', dia: 'Sol sobre o castelo', noite: 'Lua, estrelas e postes acesos' };
const COG = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="12" cy="12" r="8.6" stroke-width="3" stroke-dasharray="3.38 3.375"/><circle cx="12" cy="12" r="6.1" stroke-width="2.2"/><circle cx="12" cy="12" r="2.3" stroke-width="1.7"/></g></svg>';

export function createSettings({ onChoose, onSky }) {
  const raiz = document.createElement('div');
  raiz.id = 'ajustes';
  raiz.hidden = true;
  raiz.innerHTML = `
    <button type="button" class="aj-cog" aria-haspopup="true" aria-expanded="false" aria-controls="aj-menu" aria-label="Ajustes: céu e qualidade da imagem">${COG}</button>
    <div class="aj-menu" id="aj-menu" hidden>
      <p class="aj-title" id="aj-t-ceu">Céu</p>
      <div class="aj-ceu" role="radiogroup" aria-labelledby="aj-t-ceu">
        ${CEUS.map(([v, nome, icone]) => `<button type="button" class="aj-seg" role="radio" aria-checked="false" data-ceu="${v}">${icone}<b>${nome}</b></button>`).join('')}
      </div>
      <p class="aj-nota" aria-live="polite"></p>
      <p class="aj-title" id="aj-t-q">Qualidade da imagem</p>
      <div role="radiogroup" aria-labelledby="aj-t-q">
        ${OPCOES.map(([v, nome, nota]) => `<button type="button" class="aj-op" role="radio" aria-checked="false" data-v="${v}"><i aria-hidden="true"></i><span><b>${nome}</b><small>${nota}</small></span></button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(raiz);
  const cog = raiz.querySelector('.aj-cog'), menu = raiz.querySelector('.aj-menu'), ops = [...raiz.querySelectorAll('.aj-op')];
  const ceus = [...raiz.querySelectorAll('.aj-seg')], notaCeu = raiz.querySelector('.aj-nota'), todos = [...ceus, ...ops];
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
    if (!aberto || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = todos.indexOf(document.activeElement), passo = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? todos.length - 1 : (i + passo + todos.length) % todos.length;
    todos[j].focus();
  });
  raiz.addEventListener('focusout', (e) => { if (aberto && e.relatedTarget && !raiz.contains(e.relatedTarget)) abrir(false); });
  ops.forEach((o) => o.addEventListener('click', () => { onChoose(o.dataset.v); }));
  // choosing a sky closes the menu: the sun and the moon change places behind it
  ceus.forEach((o) => o.addEventListener('click', () => { onSky(o.dataset.ceu); abrir(false); cog.focus(); }));

  return {
    show() { raiz.hidden = false; },
    // steps aside while the open page is scrolled away from its top (it would sit on the cards)
    tuck(sim) { const fora = sim && !aberto; if (fora !== raiz.inert) { raiz.inert = fora; raiz.classList.toggle('fora', fora); } },
    // which sky is chosen: auto (the clock's) / dia / noite
    sky(v) {
      ceus.forEach((o) => o.setAttribute('aria-checked', String(o.dataset.ceu === v)));
      notaCeu.textContent = NOTAS[v] || '';
    },
    // choice: what the guest picked (auto / low / medium / high); level: what is being drawn; busy: a change is loading
    update({ choice, level, busy }) {
      ops.forEach((o) => { o.setAttribute('aria-checked', String(o.dataset.v === choice)); o.disabled = !!busy; });
      notaAuto.textContent = busy ? 'Aplicando…' : choice === 'auto' && level ? `Ajusta sozinha ao seu aparelho (agora: ${NOMES[level]})` : 'Ajusta sozinha ao seu aparelho';
      raiz.classList.toggle('busy', !!busy);
    },
  };
}
