// The page the invitation becomes once the letter is open: the same scroll that walked the garden
// and opened the envelope goes on down the page (letter, answer, gift ideas, goodbye, credit) over the
// hall, with a few layers that drift at different speeds. The stage is pinned to the screen until
// the letter lies open and scrolls like any page from there on (see letter.css). Only `transform`
// and `opacity` change while scrolling; every measurement is cached, so a frame never forces layout.
import { h, icone, calmo } from './dom.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const linkOk = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };

// soft petals behind the cards: [left %, start (0..1 of the loop), size px, depth, turn deg, colour, opacity]
const PETALAS = [
  [6, 0.10, 20, 0.35, -20, 0, 0.75], [88, 0.22, 26, 0.55, 35, 1, 0.8], [18, 0.48, 15, 0.8, 60, 2, 0.7], [79, 0.60, 18, 1.25, -45, 3, 0.75],
  [45, 0.78, 13, 0.45, 15, 1, 0.6], [94, 0.86, 22, 1.5, 80, 0, 0.7], [3, 0.95, 28, 1.1, -70, 2, 0.75], [62, 0.34, 12, 1.7, 30, 3, 0.6],
];
const CORES = ['#F6B8C2', '#FBE9E0', '#F7C2CB', '#F2D9A0'];
const CREDITO = 'https://xanderios.vercel.app/';

export function createPage(stage, dados) {
  const ev = dados.evento || {};
  const itens = (Array.isArray(ev.presentes?.itens) ? ev.presentes.itens : []).filter((i) => i && typeof i.nome === 'string' && i.nome.trim());
  const pix = typeof ev.presentes?.pix === 'string' ? ev.presentes.pix.trim() : '';
  const zap = String(ev.contato?.whatsapp ?? '').replace(/\D/g, '');
  const temIdeias = itens.length > 0 || !!pix;

  // ---- sections (all text set as text)
  const btnIdeias = temIdeias ? h('button', { class: 'btn pri', type: 'button', 'aria-haspopup': 'dialog', text: 'Ver sugestões de presente' }) : null;
  const presentes = h('section', { class: 'pg-sec pg-gifts', 'aria-labelledby': 'pg-gifts-t' },
    h('div', { class: 'pg-float' },
      h('div', { class: 'pg-card rv' },
        h('div', { class: 'pg-orn pg-bow' }, icone('bow')),
        h('h2', { class: 'pg-script', id: 'pg-gifts-t', text: 'Sua presença é o nosso presente' }),
        temIdeias && h('p', { text: `Mas se quiser mimar a ${ev.nome || 'aniversariante'}, deixamos aqui algumas ideias com todo o carinho.` }),
        btnIdeias)));

  const zapUrl = zap ? `https://wa.me/${zap}?text=${encodeURIComponent(`Oi! Estou com uma dúvida sobre a festa da ${ev.nome || 'princesa'} 👑`)}` : '';
  const fim = h('footer', { class: 'pg-sec pg-end' },
    h('div', { class: 'pg-float' },
      h('div', { class: 'pg-card rv' },
        h('div', { class: 'pg-orn pg-flo' }, icone('flourish')),
        h('p', { class: 'pg-script', text: 'Com amor, papai e mamãe' }),
        h('p', { class: 'pg-it', text: 'Qualquer dúvida, é só chamar a gente.' }),
        zapUrl && h('a', { class: 'btn sec pg-wa', href: zapUrl, target: '_blank', rel: 'noopener noreferrer' }, icone('wa'), h('span', { text: 'Falar no WhatsApp' })))),
    // the very last line of the page: who made it
    h('p', { class: 'pg-credit' }, 'Feito com ', h('span', { class: 'pg-heart', text: '❤️' }), ' por ', h('a', { href: CREDITO, target: '_blank', rel: 'noopener noreferrer', text: 'Alexandre Rios' })));
  stage.append(presentes, fim);
  const track = document.getElementById('track');   // the pinned stretch of scroll before the page moves

  // ---- little things pinned to the screen: scroll cue, progress rail, toast, petals
  const cue = h('button', { class: 'chip pg-cue', type: 'button', hidden: true }, h('span', { text: 'Role para ver mais' }), icone('chev'));
  const rail = h('div', { class: 'pg-rail', 'aria-hidden': 'true', hidden: true }, h('i'));
  const toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
  document.body.append(cue, rail, toastEl);
  const deco = document.getElementById('deco');
  const petalas = [];

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  // ---- gift ideas dialog
  let modal = null, quemAbriu = null, fechando = 0;
  async function copiar(texto) {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); return true; }
    } catch { /* falls through to the old way */ }
    try {
      const ta = h('textarea', { readonly: true, class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
      ta.value = texto;
      modal.append(ta);
      ta.select();
      ta.setSelectionRange(0, texto.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
  function montarModal() {
    const fechar = h('button', { class: 'modal-x', type: 'button', 'aria-label': 'Fechar' }, icone('x'));
    const copia = pix ? h('button', { class: 'btn sec', type: 'button', 'aria-label': 'Copiar chave PIX', text: 'Copiar' }) : null;
    const caixa = h('div', { class: 'modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gift-t', 'aria-describedby': 'gift-d', tabindex: '-1' },
      fechar,
      h('h2', { class: 'pg-script', id: 'gift-t', text: 'Ideias de presente' }),
      h('p', { class: 'pg-it', id: 'gift-d', text: 'Sem obrigação nenhuma, tá? ♥' }),
      itens.length > 0 && h('ul', { class: 'gift-list' }, ...itens.map((i) => h('li', {},
        h('div', {}, h('b', { text: i.nome.trim() }), typeof i.obs === 'string' && i.obs.trim() ? h('small', { text: i.obs.trim() }) : null),
        linkOk(i.url) && h('a', { class: 'btn sec', href: i.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Ver ${i.nome.trim()}`, text: 'Ver' })))),
      pix && h('div', { class: 'pix' }, h('div', {}, h('b', { text: 'Chave PIX' }), h('code', { text: pix })), copia));
    modal = h('div', { class: 'modal', hidden: true }, caixa);
    document.body.append(modal);
    fechar.addEventListener('click', fecharModal);
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) fecharModal(); });
    copia?.addEventListener('click', async () => {
      const ok = await copiar(pix);
      copia.focus({ preventScroll: true });
      toast(ok ? 'Copiado!' : 'Não foi possível copiar');
    });
    // focus stays inside the dialog
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharModal(); return; }
      if (e.key !== 'Tab') return;
      const foco = [...caixa.querySelectorAll('a[href], button:not([disabled])')];
      if (!foco.length) { e.preventDefault(); return; }
      const primeiro = foco[0], ultimo = foco[foco.length - 1], atual = document.activeElement;
      if (e.shiftKey && (atual === primeiro || atual === caixa)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && atual === ultimo) { e.preventDefault(); primeiro.focus(); }
    });
  }
  const fundo = () => [stage, document.getElementById('hud'), cue].filter(Boolean);
  function abrirModal() {
    if (!modal) montarModal();
    clearTimeout(fechando);
    quemAbriu = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open'); // the page behind stops scrolling
    fundo().forEach((el) => { el.inert = true; });
    void modal.offsetWidth;
    modal.classList.add('open');
    modal.firstElementChild.focus({ preventScroll: true });
  }
  function fecharModal() {
    if (!modal || modal.hidden || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
    fundo().forEach((el) => { el.inert = false; });
    (quemAbriu && quemAbriu.isConnected ? quemAbriu : btnIdeias)?.focus({ preventScroll: true });
    fechando = setTimeout(() => { modal.hidden = true; }, calmo() ? 0 : 280);
  }
  btnIdeias?.addEventListener('click', abrirModal);

  // ---- scrolling state (everything a frame needs is cached here)
  let ligado = false, pronto = false, base = 0, topo = 0, max = 0, vh = 0, railH = 0, laco = 0;   // base: where the page's own scroll begins
  let y = 0, pg = 0, yAntes = -1, pgAntes = -1;
  const flutuam = [...stage.querySelectorAll('.pg-float')].map((el) => ({ el, orn: el.querySelector('.pg-orn'), meio: 0 }));
  const rolado = () => clamp(scrollY - base, 0, max);

  function medir() {
    if (!pronto) return;
    vh = innerHeight;
    base = track.offsetHeight;
    max = Math.max(0, stage.offsetHeight - vh);
    topo = rolado();
    railH = rail.clientHeight;
    laco = vh + 240;
    for (const f of flutuam) f.meio = f.el.parentElement.offsetTop + f.el.offsetTop + f.el.offsetHeight / 2;
    rail.hidden = max < 8;
    yAntes = pgAntes = -1; // redraw on the next frame
  }

  function irPara(el, folga = 24) {
    if (!ligado || !el) return;
    const r = el.getBoundingClientRect();
    // bring the whole block into view; if it is taller than the screen, its top
    const alvo = r.height + folga * 2 > innerHeight ? scrollY + r.top - folga : scrollY + r.bottom - innerHeight + folga;
    scrollTo({ top: clamp(alvo, base, base + max), behavior: calmo() ? 'auto' : 'smooth' });   // never back into the opening
  }
  const visivel = (el) => { const r = el.getBoundingClientRect(); return r.bottom <= innerHeight - 8 && r.top >= 0; };

  let cueAlvo = null, cueTimer = 0;
  function esconderCue() {
    clearTimeout(cueTimer);
    if (cue.hidden || !cue.classList.contains('on')) return;
    cue.classList.remove('on');
    setTimeout(() => { if (!cue.classList.contains('on')) cue.hidden = true; }, 450);
  }
  cue.addEventListener('click', () => { irPara(cueAlvo || presentes); esconderCue(); });

  // The first time the letter lies open: petals, listeners, and the sections' arrival.
  function preparar() {
    pronto = true;
    if (!calmo()) {
      for (const [x, y0, s, prof, giro, cor, op] of PETALAS) {
        const el = h('i', { style: `left:${x}%` }, h('b', { style: `width:${s}px;height:${s}px;background:${CORES[cor]};opacity:${op};--r:${giro}deg;--t:${(5 + prof * 3).toFixed(1)}s` }));
        deco.append(el);
        petalas.push({ el, y0, prof });
      }
    }

    addEventListener('scroll', () => { topo = rolado(); if (topo > 24) esconderCue(); }, { passive: true });
    addEventListener('resize', medir);
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(medir);
      [track, ...stage.children].forEach((el) => ro.observe(el));
    }

    // sections arrive as they scroll into view
    const rv = [...stage.querySelectorAll('.rv')];
    if ('IntersectionObserver' in window && !calmo()) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
      rv.forEach((el) => io.observe(el));
    } else rv.forEach((el) => el.classList.add('in'));
  }

  // Called whenever the letter comes to lie open (on = true) or starts folding back (on = false).
  // `alvo` is the block right under the letter (the answer buttons); `texto` is what the cue says
  // when that block is off screen.
  function show(on, { alvo, texto } = {}) {
    if (on === ligado) return;
    ligado = on;
    document.body.classList.toggle('page', on);
    if (!on) { esconderCue(); return; }
    if (!pronto) preparar();
    medir();

    cueAlvo = alvo || null;
    clearTimeout(cueTimer);
    if (max > 8 && (!alvo || !visivel(alvo))) {
      if (alvo && texto) cue.firstElementChild.textContent = texto;
      // the whole letter is seen first
      cueTimer = setTimeout(() => { if (!ligado || topo > 24) return; cue.hidden = false; void cue.offsetWidth; cue.classList.add('on'); }, 1100);
    }
  }

  // One step of the main loop. Returns the page's scroll progress, 0 (top) to 1 (bottom),
  // eased like the journey's own progress; 0 until the letter has been open once.
  function tick(dt) {
    if (!pronto) return 0;
    const quieto = calmo();
    const alvo = max > 0 ? clamp(topo / max, 0, 1) : 0;
    pg += (alvo - pg) * (1 - Math.exp(-dt * (quieto ? 30 : 5)));
    if (Math.abs(alvo - pg) < 0.0004) pg = alvo;
    y += (topo - y) * (1 - Math.exp(-dt * (quieto ? 30 : 10)));
    if (Math.abs(topo - y) < 0.05) y = topo;

    if (pg !== pgAntes) {
      pgAntes = pg;
      rail.firstElementChild.style.transform = `translate3d(0,${(pg * railH).toFixed(1)}px,0)`;
    }
    if (y !== yAntes && !quieto) {
      yAntes = y;
      const centro = y + vh / 2;
      for (const f of flutuam) {
        const d = clamp(f.meio - centro, -vh, vh);
        f.el.style.transform = `translate3d(0,${(d * 0.04).toFixed(1)}px,0)`;   // a gentle drift: the cards stay close to one another
        if (f.orn) f.orn.style.transform = `translate3d(0,${clamp(d * -0.045, -10, 10).toFixed(1)}px,0)`;
      }
      for (const p of petalas) {
        const pos = (((p.y0 * laco - y * p.prof) % laco) + laco) % laco;
        p.el.style.transform = `translate3d(0,${(pos - 120).toFixed(1)}px,0)`;
      }
    }
    return pg;
  }

  return { show, tick, medir, irPara, toast, get ligado() { return ligado; } };
}
