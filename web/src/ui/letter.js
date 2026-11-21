// Envelope -> seal drops -> flap opens -> letter rises -> unfolds -> answer.
import { buildInvite, inviteText, startCountdown } from './invite.js';

const EASE = 'cubic-bezier(.45,0,.2,1)';
const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createLetter(stage, dados, { token, onOpen }) {
  const ev = dados.evento;
  stage.innerHTML = `
    <div class="lt">
      <div class="lt-veil"></div>
      <div class="lt-envb"><div class="lt-inside"></div><div class="lt-flap lt-flap-in"><div class="lt-flap-face"></div></div></div>
      <div class="lt-sheet" aria-hidden="true">
        <div class="lt-panel lt-mid"><div class="lt-face" style="--i:1"></div></div>
        <div class="lt-panel lt-bot"><div class="lt-face" style="--i:2"></div><div class="lt-face back"></div></div>
        <div class="lt-panel lt-top"><div class="lt-face" style="--i:0"></div><div class="lt-face back"></div></div>
        <i class="lt-crease c1"></i><i class="lt-crease c2"></i>
      </div>
      <div class="lt-envf">
        <div class="lt-pocket"><i></i><i></i><i></i></div>
        <div class="lt-to"><small>Para</small><b></b></div>
        <div class="lt-flap lt-flap-out"><div class="lt-flap-face"></div></div>
        <div class="lt-seal"><b></b></div>
      </div>
      <div class="lt-cta" data-mode="none">
        <button class="btn pri" type="button" data-for="open" data-act="open">Abrir convite</button>
        <p class="lt-err" data-for="rsvp change" hidden></p>
        <button class="btn pri" type="button" data-for="rsvp change" data-act="sim">Confirmar presença</button>
        <button class="btn sec" type="button" data-for="rsvp change" data-act="nao">Não poderei ir</button>
        <button class="btn ghost" type="button" data-for="change" data-act="voltar">Manter minha resposta</button>
        <button class="btn sec" type="button" data-for="ver" data-act="ver">Ver minha resposta</button>
      </div>
      <section class="ans" aria-live="polite"></section>
      <p class="sr-only" data-texto></p>
      <div class="confete" aria-hidden="true"></div>
    </div>`;

  const $ = (s) => stage.querySelector(s);
  const lt = $('.lt'), sheet = $('.lt-sheet'), envb = $('.lt-envb'), envf = $('.lt-envf'), seal = $('.lt-seal');
  const flaps = stage.querySelectorAll('.lt-flap'), top = $('.lt-top'), bot = $('.lt-bot');
  const cta = $('.lt-cta'), ans = $('.ans'), errEl = $('.lt-err'), confete = $('.confete');

  // text set as text, never as markup
  const nome = $('.lt-to b');
  nome.textContent = dados.convidado;
  if (dados.convidado.length > 17) nome.style.fontSize = Math.max(3.6, 7.2 * 17 / dados.convidado.length).toFixed(2) + 'em';
  $('.lt-seal b').textContent = ev.iniciais || '';
  $('[data-texto]').textContent = inviteText(ev);
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

  let estado = 'fora'; // fora | chegou | abrindo | aberto
  let anims = [], T0 = '', T1 = '', ocupado = false;

  function place() {
    if (estado === 'aberto' || estado === 'abrindo') return;
    sheet.style.transform = 'none';
    const e = envb.getBoundingClientRect(), s = sheet.getBoundingClientRect();
    if (!s.width) return;
    const k = (e.width * 0.9) / s.width;
    const dx = e.left + e.width / 2 - (s.left + s.width / 2);
    const dy = e.top + e.height * 0.53 - (s.top + (s.height * k) / 2); // origin is the top edge
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
  const modo = (m) => { cta.dataset.mode = m; errEl.hidden = true; };

  function arrive() {
    if (estado !== 'fora') return;
    estado = 'chegou';
    stage.hidden = false;
    place();
    requestAnimationFrame(() => lt.classList.add('on'));
    modo('open');
    limpar();
    const dur = calmo() ? 1 : 1000, y = innerHeight;
    [envb, envf, cta].forEach((el) => run(el, [{ transform: `translateY(${y}px)` }, { transform: 'translateY(0)' }], { duration: dur, easing: 'cubic-bezier(.2,.8,.2,1)' }));
    const a = run(sheet, [{ transform: `translateY(${y}px) ${T0}` }, { transform: `translateY(0px) ${T0}` }], { duration: dur, easing: 'cubic-bezier(.2,.8,.2,1)' });
    a.finished.then(() => { if (estado === 'chegou') limpar(); }).catch(() => {});
  }

  function leave() {
    if (estado !== 'chegou') return;
    estado = 'fora';
    lt.classList.remove('on');
    limpar();
    const y = innerHeight, dur = calmo() ? 1 : 600;
    [envb, envf, cta].forEach((el) => run(el, [{ transform: 'translateY(0)' }, { transform: `translateY(${y}px)` }], { duration: dur, easing: 'ease-in' }));
    const a = run(sheet, [{ transform: `translateY(0px) ${T0}` }, { transform: `translateY(${y}px) ${T0}` }], { duration: dur, easing: 'ease-in' });
    a.finished.then(() => { if (estado === 'fora') { limpar(); stage.hidden = true; } }).catch(() => {});
  }

  function open() {
    if (estado !== 'chegou') return;
    estado = 'abrindo';
    limpar();
    onOpen?.();
    run(cta, [{ opacity: 1 }, { opacity: 0 }], { duration: 350 });
    run(seal, [
      { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1, offset: 0 },
      { transform: 'translate(-50%,-50%) rotate(-8deg)', offset: 0.16 },
      { transform: 'translate(-50%,-47%) rotate(6deg)', offset: 0.3 },
      { transform: 'translate(-47%,-30%) rotate(10deg)', opacity: 1, offset: 0.5 },
      { transform: 'translate(-40%,240%) rotate(36deg)', opacity: 0, offset: 1 },
    ], { duration: 1500, easing: 'cubic-bezier(.45,0,.75,.45)' });
    flaps.forEach((f) => run(f, [{ transform: 'perspective(120em) rotateX(0deg)' }, { transform: 'perspective(120em) rotateX(180deg)' }], { duration: 1000, delay: 1250 }));
    run(sheet, [{ transform: T0, easing: EASE }, { transform: T1, offset: 0.42, easing: EASE }, { transform: 'translate(0px, 0px) scale(1)' }], { duration: 2300, delay: 2150 });
    [envb, envf].forEach((e) => run(e, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(40%)', opacity: 0 }], { duration: 900, delay: 3100, easing: 'ease-in' }));
    run(top, [{ transform: 'perspective(160em) rotateX(-180deg)' }, { transform: 'perspective(160em) rotateX(0deg)' }], { duration: 1100, delay: 4300 });
    const fim = run(bot, [{ transform: 'perspective(160em) rotateX(180deg)' }, { transform: 'perspective(160em) rotateX(0deg)' }], { duration: 1100, delay: 4950 });
    if (calmo()) anims.forEach((a) => a.finish());
    fim.finished.then(settle).catch(() => {});
  }

  // Hand the final pose over to plain CSS so later transitions (mini letter, sheet) work.
  function settle() {
    estado = 'aberto';
    lt.classList.add('open');
    sheet.style.transform = '';
    envb.style.display = envf.style.display = 'none';
    limpar();
    sheet.removeAttribute('aria-hidden');
    sheet.setAttribute('role', 'group');
    sheet.setAttribute('aria-label', 'Convite');
    sheet.tabIndex = 0;
    sheet.querySelectorAll('.lt-face:not(.back) .inv:not([aria-hidden]) a').forEach((a) => a.removeAttribute('tabindex'));
    if (dados.resposta || dados.encerrado) { modo('none'); setTimeout(showAnswer, 600); }
    else { modo('rsvp'); run(cta, [{ opacity: 0, transform: 'translateY(12%)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600 }); }
  }

  // ---- answers
  const btn = (cls, texto, attrs) => `<${attrs.href ? 'a' : 'button type="button"'} class="btn ${cls}" ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}>${texto}</${attrs.href ? 'a' : 'button'}>`;
  const agenda = () => btn('pri', 'Adicionar à agenda', { href: `/c/${token}/evento.ics` });
  const mapa = (cls = 'sec') => btn(cls, 'Ver no mapa', { href: dados.mapaUrl, target: '_blank', rel: 'noopener noreferrer' });
  const safe = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function renderAnswer() {
    const { resposta, encerrado } = dados;
    const quando = safe(dados.inicioTexto), onde = safe(ev.local), prazo = safe(dados.prazoTexto);
    let h;
    if (encerrado) {
      const linha = resposta === 'sim' ? `Sua resposta: presença confirmada. Nos vemos no dia ${quando}, no ${onde}!`
        : resposta === 'nao' ? 'Sua resposta: não poderá ir. Sentiremos sua falta.'
        : 'Este convite não foi respondido a tempo. Fale com a família para avisar.';
      h = `<h2>Respostas encerradas</h2><p>${linha}</p>${resposta === 'sim' ? agenda() + mapa() : ''}<small>As respostas foram encerradas em ${prazo}.</small>`;
    } else if (resposta === 'sim') {
      h = `<h2>Presença confirmada</h2><p>Nos vemos no dia ${quando}, no ${onde}.</p>${agenda()}${mapa()}
           <small>Mudou de planos? Você pode alterar a resposta até ${prazo}.</small>${btn('ghost', 'Alterar resposta', { 'data-act': 'mudar' })}`;
    } else {
      h = `<h2>Sentiremos sua falta</h2><p>Obrigado por avisar. Se os planos mudarem, é só voltar a este link.</p>
           ${btn('sec', 'Alterar resposta', { 'data-act': 'mudar' })}<small>Você pode alterar a resposta até ${prazo}.</small>`;
    }
    ans.innerHTML = h;
  }

  function showAnswer() {
    renderAnswer();
    modo('none');
    lt.classList.add('mini');
  }
  function hideAnswer(m) {
    lt.classList.remove('mini');
    modo(m);
  }

  async function responder(resposta) {
    if (ocupado) return;
    ocupado = true;
    cta.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      const r = await fetch(`/api/convite/${token}/resposta`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resposta }) });
      const j = await r.json().catch(() => ({}));
      if (j.convidado) Object.assign(dados, j);
      if (!r.ok && r.status !== 409) throw new Error(j.erro || 'falha');
      showAnswer();
      if (r.ok && resposta === 'sim') celebrar();
    } catch {
      errEl.textContent = 'Não conseguimos salvar sua resposta. Confira a conexão e tente de novo.';
      errEl.hidden = false;
    } finally {
      ocupado = false;
      cta.querySelectorAll('button').forEach((b) => (b.disabled = false));
    }
  }

  function celebrar() {
    if (calmo()) return;
    const cores = ['#F6B8C2', '#FBE9E0', '#F9D0D4', '#F7C2CB', '#F2D9A0'];
    let h = '';
    for (let i = 0; i < 34; i++) {
      const petala = i % 3 === 0, s = petala ? 2.2 + Math.random() * 2 : 7 + Math.random() * 7;
      h += `<i class="${petala ? 'p' : ''}" style="left:${(Math.random() * 100).toFixed(1)}%;--s:${s.toFixed(1)}em;--c:${cores[i % cores.length]};--d:${(3.2 + Math.random() * 2.6).toFixed(2)}s;--w:${(Math.random() * 1.4).toFixed(2)}s;--x:${(Math.random() * 30 - 15).toFixed(1)}vw;--r:${(Math.random() * 80 - 40).toFixed(0)}deg"></i>`;
    }
    confete.innerHTML = h;
    setTimeout(() => (confete.innerHTML = ''), 7500);
  }

  lt.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-act]');
    if (alvo) {
      const a = alvo.dataset.act;
      if (a === 'open') open();
      else if (a === 'sim' || a === 'nao') responder(a);
      else if (a === 'mudar') hideAnswer('change');
      else if (a === 'voltar' || a === 'ver') showAnswer();
      return;
    }
    // tapping the small letter brings it back to full size
    if (e.target.closest('.lt-sheet') && lt.classList.contains('mini')) hideAnswer('ver');
  });
  sheet.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && lt.classList.contains('mini')) { e.preventDefault(); hideAnswer('ver'); }
  });

  return { arrive, leave, get estado() { return estado; } };
}
