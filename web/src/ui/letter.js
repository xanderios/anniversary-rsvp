// Envelope -> wax seal drops -> flap opens -> letter rises -> unfolds -> the page scrolls.
// Layers, front to back: envelope pocket + closed flap + seal, the letter, envelope back + open flap.
import { buildInvite, inviteText, startCountdown } from './invite.js';
import { createPage } from './page.js';
import { h, calmo } from './dom.js';

const EASE = 'cubic-bezier(.45,0,.2,1)';
const SIMETRICA = 'cubic-bezier(.45,0,.55,1)'; // crosses its half-way point at half time (the flap is edge-on there)

// Red wax seal: an uneven blob, a pressed dish with a raised ring and beads, and the initials.
const SELO = `
  <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="wx-wax" cx="36%" cy="28%" r="78%"><stop offset="0" stop-color="#EA7583"/><stop offset=".42" stop-color="#C23A4D"/><stop offset="1" stop-color="#8C2034"/></radialGradient>
      <radialGradient id="wx-dish" cx="62%" cy="68%" r="70%"><stop offset="0" stop-color="#C94A5B"/><stop offset="1" stop-color="#A52F42"/></radialGradient>
      <radialGradient id="wx-shine"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="wx-in" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6E1A2B" stop-opacity=".85"/><stop offset=".5" stop-color="#8B2536" stop-opacity=".15"/><stop offset="1" stop-color="#F5B4BA" stop-opacity=".8"/></linearGradient>
      <linearGradient id="wx-out" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F5B4BA" stop-opacity=".85"/><stop offset=".5" stop-color="#C64F5E" stop-opacity=".3"/><stop offset="1" stop-color="#6E1A2B" stop-opacity=".8"/></linearGradient>
    </defs>
    <path class="wx-shadow" d="M60 4.5C68.8 4.1 82.8 7.3 89.3 10.6 95.8 14 98.2 19.4 102.3 26.2 106.5 33 114.8 46.1 116.4 55.1 117.9 64.2 115.2 78.6 112.5 85.3 109.8 92.1 104.7 95.1 98.6 99.2 92.5 103.3 81.4 109.7 72.8 112 64.2 114.3 49.8 115 42.6 114.2 35.3 113.3 30.8 112.1 25.6 106.4 20.3 100.8 11.6 85.4 8.3 77.6 5 69.7 3.2 63.4 4.2 55.2 5.2 47 10.4 30.2 14.7 23.8 19 17.4 25.3 16.2 32.2 13.2 39.2 10.3 51.2 4.9 60 4.5Z" transform="translate(1.6 3.4)" fill="#5A1422" opacity=".3"/>
    <path d="M60 4.5C68.8 4.1 82.8 7.3 89.3 10.6 95.8 14 98.2 19.4 102.3 26.2 106.5 33 114.8 46.1 116.4 55.1 117.9 64.2 115.2 78.6 112.5 85.3 109.8 92.1 104.7 95.1 98.6 99.2 92.5 103.3 81.4 109.7 72.8 112 64.2 114.3 49.8 115 42.6 114.2 35.3 113.3 30.8 112.1 25.6 106.4 20.3 100.8 11.6 85.4 8.3 77.6 5 69.7 3.2 63.4 4.2 55.2 5.2 47 10.4 30.2 14.7 23.8 19 17.4 25.3 16.2 32.2 13.2 39.2 10.3 51.2 4.9 60 4.5Z" fill="url(#wx-wax)"/>
    <path d="M60 4.5C68.8 4.1 82.8 7.3 89.3 10.6 95.8 14 98.2 19.4 102.3 26.2 106.5 33 114.8 46.1 116.4 55.1 117.9 64.2 115.2 78.6 112.5 85.3 109.8 92.1 104.7 95.1 98.6 99.2 92.5 103.3 81.4 109.7 72.8 112 64.2 114.3 49.8 115 42.6 114.2 35.3 113.3 30.8 112.1 25.6 106.4 20.3 100.8 11.6 85.4 8.3 77.6 5 69.7 3.2 63.4 4.2 55.2 5.2 47 10.4 30.2 14.7 23.8 19 17.4 25.3 16.2 32.2 13.2 39.2 10.3 51.2 4.9 60 4.5Z" fill="none" stroke="url(#wx-out)" stroke-width="1.6" transform="translate(60 60) scale(.955) translate(-60 -60)" opacity=".55"/>
    <circle cx="60" cy="60" r="41" fill="url(#wx-dish)"/>
    <circle cx="60" cy="60" r="41" fill="none" stroke="url(#wx-in)" stroke-width="2.4"/>
    <circle cx="60" cy="60" r="36.6" fill="none" stroke="#E79AA2" stroke-opacity=".55" stroke-width="1.5" stroke-linecap="round" stroke-dasharray=".1 4.692"/>
    <circle cx="60" cy="60" r="32" fill="none" stroke="url(#wx-out)" stroke-width="1.7"/>
    <g class="wx-txt" font-family="'Cormorant Garamond', 'Cormorant', Garamond, 'Times New Roman', serif" font-weight="600" text-anchor="middle">
      <text fill="#6A1526" fill-opacity=".8" transform="translate(.9 1.1)"></text>
      <text fill="#FBD0D4" fill-opacity=".85" transform="translate(-.6 -.7)"></text>
      <text fill="#DC6E7B"></text>
    </g>
    <ellipse cx="41" cy="27" rx="19" ry="9" transform="rotate(-33 41 27)" fill="url(#wx-shine)"/>
    <ellipse cx="88" cy="97" rx="12" ry="5" transform="rotate(-38 88 97)" fill="url(#wx-shine)" opacity=".35"/>
  </svg>`;

export function createLetter(stage, dados, { token, onOpen }) {
  const ev = dados.evento;
  stage.innerHTML = `
    <div class="lt">
      <div class="lt-env lt-envb"><div class="lt-inside"></div><div class="lt-flap lt-flap-in"><div class="lt-flap-face"></div></div></div>
      <div class="lt-sheet" aria-hidden="true">
        <div class="lt-panel lt-mid"><div class="lt-face" style="--i:1"></div></div>
        <div class="lt-panel lt-bot"><div class="lt-face" style="--i:2"></div><div class="lt-face back"></div></div>
        <div class="lt-panel lt-top"><div class="lt-face" style="--i:0"></div><div class="lt-face back"></div></div>
        <i class="lt-crease c1"></i><i class="lt-crease c2"></i>
      </div>
      <div class="lt-env lt-envf">
        <div class="lt-pocket"><i></i><i></i><i></i></div>
        <div class="lt-to"><small>Para</small><b></b></div>
        <div class="lt-flap lt-flap-out"><div class="lt-flap-face"></div></div>
        <button class="lt-seal" type="button" data-act="open" aria-label="Abrir o convite: romper o selo de cera">${SELO}</button>
      </div>
      <div class="lt-open"><button class="btn pri" type="button" data-act="open">Abrir convite</button></div>
      <div class="rsvp" hidden></div>
      <div class="lt-more" aria-hidden="true" hidden><svg><use href="#i-chev"/></svg></div>
      <p class="sr-only" data-texto></p>
    </div>`;

  const $ = (s) => stage.querySelector(s);
  const lt = $('.lt'), sheet = $('.lt-sheet'), envb = $('.lt-envb'), envf = $('.lt-envf'), seal = $('.lt-seal');
  const flapIn = $('.lt-flap-in'), flapOut = $('.lt-flap-out'), top = $('.lt-top'), bot = $('.lt-bot');
  const abrir = $('.lt-open'), rsvp = $('.rsvp'), mais = $('.lt-more'), confete = document.getElementById('confete'), veil = document.getElementById('veil');
  const page = createPage(stage, dados);

  // text set as text, never as markup
  const nome = $('.lt-to b');
  nome.textContent = dados.convidado;
  if (dados.convidado.length > 17) nome.style.fontSize = Math.max(3.6, 7.2 * 17 / dados.convidado.length).toFixed(2) + 'em';
  $('[data-texto]').textContent = inviteText(ev);

  // ---- initials on the seal: measured, then sized and centred so they always sit inside the ring
  const iniciais = [...String(ev.iniciais || '').trim()].slice(0, 3).join('');
  const letras = seal.querySelectorAll('.wx-txt text');
  function gravar() {
    const BASE = 30, RAIO = 27; // the ring's inner radius is 31; the ink stays well inside it
    let tam = [0, 40, 27, 19][iniciais.length] || 19, x = 60, yb = 60 + tam * 0.32;
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `600 ${BASE}px "Cormorant Garamond", Cormorant, Garamond, "Times New Roman", serif`;
      const m = ctx.measureText(iniciais);
      if (iniciais && m.actualBoundingBoxAscent > 0) {
        const esq = m.actualBoundingBoxLeft, dir = m.actualBoundingBoxRight, sobe = m.actualBoundingBoxAscent, desce = m.actualBoundingBoxDescent;
        const k = Math.min(1.5, (2 * RAIO) / Math.hypot(esq + dir, sobe + desce)); // the ink's diagonal fits the circle
        tam = BASE * k;
        x = 60 - ((dir - esq) / 2) * k + (m.width / 2) * k; // text-anchor is "middle": shift so the ink, not the advance, is centred
        yb = 60 + ((sobe - desce) / 2) * k;
      }
    } catch { /* keeps the safe defaults above */ }
    letras.forEach((t) => {
      t.textContent = iniciais;
      t.setAttribute('font-size', tam.toFixed(2));
      t.setAttribute('x', x.toFixed(2));
      t.setAttribute('y', yb.toFixed(2));
    });
  }
  gravar();
  document.fonts?.load?.('600 30px "Cormorant Garamond"', iniciais || 'A').then(gravar).catch(() => {});

  // the same letter three times, one per folded panel (each panel shows its own third)
  stage.querySelectorAll('.lt-face:not(.back)').forEach((f, i) => {
    const copia = buildInvite(dados, token);
    if (i) copia.setAttribute('aria-hidden', 'true');
    copia.querySelectorAll('a').forEach((a) => { a.tabIndex = -1; });
    f.appendChild(copia);
  });
  startCountdown(sheet, ev.inicio);
  // a button cut by a fold lives in two panels: keyboard focus on one copy lights up all of them
  sheet.addEventListener('focusin', (e) => { const k = e.target.dataset?.k; if (k) sheet.querySelectorAll(`[data-k="${k}"]`).forEach((a) => a.classList.add('focus')); });
  sheet.addEventListener('focusout', () => sheet.querySelectorAll('.focus').forEach((a) => a.classList.remove('focus')));

  // The sheet is exactly as tall as its text needs (the party's texts come from a config file):
  // a hidden copy is measured and the height / width ratio handed to the CSS as --R.
  const regua = buildInvite(dados, token);
  regua.classList.add('inv-regua');
  regua.setAttribute('aria-hidden', 'true');
  regua.querySelectorAll('a').forEach((a) => { a.tabIndex = -1; });
  sheet.appendChild(regua);
  function ajustar() {
    const w = sheet.offsetWidth, a = regua.offsetHeight;
    if (w && a) lt.style.setProperty('--R', (Math.ceil((a / w) * 300) / 300).toFixed(4));
  }

  let estado = 'fora'; // fora | chegou | abrindo | aberto
  let anims = [], T0 = '', T1 = '', ocupado = false;

  function place() {
    if (estado === 'abrindo') return;
    ajustar();
    if (estado === 'aberto') return;
    sheet.style.transform = 'none';
    const e = envb.getBoundingClientRect(), s = sheet.getBoundingClientRect();
    if (!s.width || !e.width) return;
    const terco = s.height / 3;
    const k = Math.min((e.width * 0.9) / s.width, (e.height * 0.9) / terco); // the folded letter fits inside the envelope
    const dx = e.left + e.width / 2 - (s.left + s.width / 2);
    const dy = e.top + e.height * 0.52 - (s.top + (s.height * k) / 2); // origin is the top edge
    T0 = `translate(${dx}px, ${dy}px) scale(${k})`;
    T1 = `translate(${dx}px, ${dy - e.height * 1.02}px) scale(${k})`;
    sheet.style.transform = T0;
  }
  addEventListener('resize', () => requestAnimationFrame(place));

  const run = (el, frames, opts) => {
    const a = el.animate(frames, { fill: 'both', easing: EASE, ...opts });
    anims.push(a);
    return a;
  };
  const limpar = () => { anims.forEach((a) => a.cancel()); anims = []; };
  const pecas = [envb, envf, abrir];

  function arrive() {
    if (estado !== 'fora') return;
    estado = 'chegou';
    stage.hidden = false;
    place();
    requestAnimationFrame(() => { if (estado !== 'fora') { veil.classList.add('on'); lt.classList.add('on'); } });
    limpar();
    const dur = calmo() ? 1 : 1000, y = innerHeight;
    pecas.forEach((el) => run(el, [{ transform: `translateY(${y}px)` }, { transform: 'translateY(0)' }], { duration: dur, easing: 'cubic-bezier(.2,.8,.2,1)' }));
    const a = run(sheet, [{ transform: `translateY(${y}px) ${T0}` }, { transform: `translateY(0px) ${T0}` }], { duration: dur, easing: 'cubic-bezier(.2,.8,.2,1)' });
    a.finished.then(() => { if (estado === 'chegou') limpar(); }).catch(() => {});
  }

  function leave() {
    if (estado !== 'chegou') return;
    estado = 'fora';
    veil.classList.remove('on');
    lt.classList.remove('on');
    limpar();
    const y = innerHeight, dur = calmo() ? 1 : 600;
    pecas.forEach((el) => run(el, [{ transform: 'translateY(0)' }, { transform: `translateY(${y}px)` }], { duration: dur, easing: 'ease-in' }));
    const a = run(sheet, [{ transform: `translateY(0px) ${T0}` }, { transform: `translateY(${y}px) ${T0}` }], { duration: dur, easing: 'ease-in' });
    a.finished.then(() => { if (estado === 'fora') { limpar(); stage.hidden = true; } }).catch(() => {});
  }

  function open() {
    if (estado !== 'chegou') return;
    estado = 'abrindo';
    limpar();
    lt.classList.add('opening'); // T0 / T1 were set on arrival and on every resize
    onOpen?.();
    run(abrir, [{ opacity: 1 }, { opacity: 0 }], { duration: 350 });
    run(seal, [
      { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1, offset: 0 },
      { transform: 'translate(-50%,-50%) rotate(-8deg)', offset: 0.16 },
      { transform: 'translate(-50%,-47%) rotate(6deg)', offset: 0.3 },
      { transform: 'translate(-47%,-30%) rotate(10deg)', opacity: 1, offset: 0.5 },
      { transform: 'translate(-40%,240%) rotate(36deg)', opacity: 0, offset: 1 },
    ], { duration: 1500, easing: 'cubic-bezier(.45,0,.75,.45)' });
    // The flap is two pieces turning together: the outer face belongs to the envelope's front
    // and is seen until it stands edge-on; from there on the inner face shows, and it belongs
    // to the envelope's back, behind the letter.
    const giro = [{ transform: 'perspective(120em) rotateX(0deg)' }, { transform: 'perspective(120em) rotateX(180deg)' }];
    [flapOut, flapIn].forEach((f) => run(f, giro, { duration: 1000, delay: 1250, easing: SIMETRICA }));
    run(flapOut, [{ opacity: 1, easing: 'steps(1, end)' }, { opacity: 0 }], { duration: 500, delay: 1250, easing: 'linear' });
    run(flapIn, [{ opacity: 0, easing: 'steps(1, end)' }, { opacity: 1 }], { duration: 500, delay: 1250, easing: 'linear' });
    run(sheet, [{ transform: T0, easing: EASE }, { transform: T1, offset: 0.42, easing: EASE }, { transform: 'translate(0px, 0px) scale(1)' }], { duration: 2300, delay: 2150 });
    [envb, envf].forEach((e) => run(e, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(40%)', opacity: 0 }], { duration: 900, delay: 3100, easing: 'ease-in' }));
    run(top, [{ transform: 'perspective(160em) rotateX(-180deg)' }, { transform: 'perspective(160em) rotateX(0deg)' }], { duration: 1100, delay: 4300 });
    const fim = run(bot, [{ transform: 'perspective(160em) rotateX(180deg)' }, { transform: 'perspective(160em) rotateX(0deg)' }], { duration: 1100, delay: 4950 });
    if (calmo()) anims.forEach((a) => a.finish());
    fim.finished.then(settle).catch(() => {});
  }

  // The unfolded letter stays exactly where the animation left it: the resting pose is written
  // while the finished animations still hold it, the style is flushed, and only then are the
  // animations dropped. No transition is declared on any of these, so nothing can move.
  function settle() {
    if (estado !== 'abrindo') return;
    estado = 'aberto';
    sheet.style.transform = top.style.transform = bot.style.transform = 'none';
    lt.classList.remove('opening');
    lt.classList.add('open');
    envb.hidden = envf.hidden = abrir.hidden = true;
    void sheet.offsetWidth;
    limpar();
    sheet.removeAttribute('aria-hidden');
    sheet.setAttribute('role', 'group');
    sheet.setAttribute('aria-label', 'Convite');
    sheet.tabIndex = -1;
    sheet.querySelectorAll('.lt-face:not(.back) .inv:not([aria-hidden]) a').forEach((a) => a.removeAttribute('tabindex'));

    // from here on the stage is a page: the answer sits right under the letter
    const semResposta = !dados.resposta && !dados.encerrado;
    mostrar(semResposta ? 'pedir' : 'resposta');
    rsvp.hidden = mais.hidden = false;
    page.start({ alvo: rsvp, texto: semResposta ? 'Role para responder' : 'Role para ver sua resposta' });
    if (!calmo()) [rsvp, mais].forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 150, fill: 'backwards', easing: 'ease' }));
    sheet.focus({ preventScroll: true });
  }

  // ---- answers (the block right under the letter)
  const botao = (cls, texto, act) => h('button', { class: `btn ${cls}`, type: 'button', 'data-act': act, text: texto });
  const agenda = () => h('a', { class: 'btn pri', href: `/c/${encodeURIComponent(token)}/evento.ics`, text: 'Adicionar à agenda' });
  const mapa = () => h('a', { class: 'btn sec', href: dados.mapaUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Ver no mapa' });
  const erro = () => h('p', { class: 'rsvp-err', role: 'alert', hidden: true });

  function mostrar(modo) { // pedir | resposta | mudar
    const { resposta, encerrado } = dados;
    const quando = dados.inicioTexto, onde = ev.local, prazo = dados.prazoTexto;
    rsvp.dataset.mode = modo;
    let conteudo;
    if (modo === 'pedir') {
      conteudo = h('div', { class: 'rsvp-ask', role: 'group', 'aria-label': 'Confirmação de presença' },
        erro(), botao('pri', 'Confirmar presença', 'sim'), botao('sec', 'Não poderei ir', 'nao'));
    } else if (modo === 'mudar') {
      conteudo = h('section', { class: 'ans', tabindex: '-1', 'aria-label': 'Alterar resposta' },
        h('h2', { text: 'Alterar resposta' }),
        h('p', { text: resposta === 'sim' ? 'Hoje sua presença está confirmada.' : 'Hoje sua resposta é que não poderá ir.' }),
        erro(), botao('pri', 'Confirmar presença', 'sim'), botao('sec', 'Não poderei ir', 'nao'), botao('ghost', 'Manter minha resposta', 'voltar'));
    } else if (encerrado) {
      const linha = resposta === 'sim' ? `Sua resposta: presença confirmada. Nos vemos no dia ${quando}, no ${onde}!`
        : resposta === 'nao' ? 'Sua resposta: não poderá ir. Sentiremos sua falta.'
        : 'Este convite não foi respondido a tempo. Fale com a família para avisar.';
      conteudo = h('section', { class: 'ans', tabindex: '-1', 'aria-label': 'Sua resposta' },
        h('h2', { text: 'Respostas encerradas' }), h('p', { text: linha }),
        resposta === 'sim' && agenda(), resposta === 'sim' && mapa(),
        h('small', { text: `As respostas foram encerradas em ${prazo}.` }));
    } else if (resposta === 'sim') {
      conteudo = h('section', { class: 'ans', tabindex: '-1', 'aria-label': 'Sua resposta' },
        h('h2', { text: 'Presença confirmada' }), h('p', { text: `Nos vemos no dia ${quando}, no ${onde}.` }),
        agenda(), mapa(),
        h('small', { text: `Mudou de planos? Você pode alterar a resposta até ${prazo}.` }), botao('ghost', 'Alterar resposta', 'mudar'));
    } else {
      conteudo = h('section', { class: 'ans', tabindex: '-1', 'aria-label': 'Sua resposta' },
        h('h2', { text: 'Sentiremos sua falta' }), h('p', { text: 'Obrigado por avisar. Se os planos mudarem, é só voltar a este link.' }),
        botao('sec', 'Alterar resposta', 'mudar'),
        h('small', { text: `Você pode alterar a resposta até ${prazo}.` }));
    }
    rsvp.replaceChildren(conteudo);
    return conteudo;
  }
  // swap the block's content, fade the new one in, and make sure it is on screen
  function trocar(modo) {
    const novo = mostrar(modo);
    if (!calmo()) novo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease' });
    page.medir();
    (novo.matches('.ans') ? novo : novo.querySelector('button'))?.focus({ preventScroll: true });
    requestAnimationFrame(() => page.irPara(rsvp));
  }

  async function responder(resposta) {
    if (ocupado) return;
    ocupado = true;
    const botoes = [...rsvp.querySelectorAll('button')], errEl = rsvp.querySelector('.rsvp-err');
    botoes.forEach((b) => (b.disabled = true));
    if (errEl) errEl.hidden = true;
    try {
      const r = await fetch(`/api/convite/${token}/resposta`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resposta }) });
      const j = await r.json().catch(() => ({}));
      if (j.convidado) Object.assign(dados, j);
      if (!r.ok && r.status !== 409) throw new Error(j.erro || 'falha');
      trocar('resposta');
      if (r.ok && resposta === 'sim') celebrar();
    } catch {
      botoes.forEach((b) => (b.disabled = false));
      if (errEl) {
        errEl.textContent = 'Não conseguimos salvar sua resposta. Confira a conexão e tente de novo.';
        errEl.hidden = false;
        page.medir();
      }
    } finally {
      ocupado = false;
    }
  }

  function celebrar() {
    if (calmo()) return;
    const cores = ['#F6B8C2', '#FBE9E0', '#F9D0D4', '#F7C2CB', '#F2D9A0'];
    const pouco = document.body.classList.contains('q-low');
    const frag = document.createDocumentFragment();
    for (let i = 0, n = pouco ? 16 : 34; i < n; i++) {
      const petala = i % 3 === 0, s = petala ? 9 + Math.random() * 8 : 26 + Math.random() * 26;
      frag.append(h('i', { class: petala ? 'p' : null, style: `left:${(Math.random() * 100).toFixed(1)}%;--s:${s.toFixed(1)}px;--c:${cores[i % cores.length]};--d:${(3.2 + Math.random() * 2.6).toFixed(2)}s;--w:${(Math.random() * 1.4).toFixed(2)}s;--x:${(Math.random() * 30 - 15).toFixed(1)}vw;--r:${(Math.random() * 80 - 40).toFixed(0)}deg` }));
    }
    confete.replaceChildren(frag);
    setTimeout(() => confete.replaceChildren(), 7500);
  }

  lt.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-act]');
    if (!alvo || alvo.disabled) return;
    const a = alvo.dataset.act;
    if (a === 'open') open();
    else if (a === 'sim' || a === 'nao') responder(a);
    else if (a === 'mudar') trocar('mudar');
    else if (a === 'voltar') trocar('resposta');
  });

  return {
    arrive, leave,
    // one step of the main loop: the open page's scroll progress, 0 (top) to 1 (bottom); 0 until the letter is open
    tick: (dt) => page.tick(dt),
    get estado() { return estado; },
  };
}
