// One scroll does it all: the envelope rides in -> the wax seal drops -> the flap opens -> the letter
// rises and unfolds -> the page scrolls on. Scrolling up plays it backwards.
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

// The envelope is drawn as paper: a soft blush stock with a fine grain, a pointed flap with a
// rounded tip, the seams of the side and bottom flaps, and the shade each fold casts on the next.
// Units: 780 x 538 (the flap is the top 312).
const ABA = 'M0,0H780V16Q780,30 768,39L413,298Q390,315 367,298L12,39Q0,30 0,16Z';
const PAPEL = `
  <svg class="lt-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
    <filter id="env-grao" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 .5  0 0 0 0 .3  0 0 0 0 .24  0 0 0 .3 -.1" result="g"/>
      <feTurbulence type="fractalNoise" baseFrequency=".012 .5" numOctaves="2" seed="3" result="f"/>
      <feColorMatrix in="f" type="matrix" values="0 0 0 0 1  0 0 0 0 .97  0 0 0 0 .94  0 0 0 .42 -.16" result="fi"/>
      <feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="g"/><feMergeNode in="fi"/></feMerge>
      <feComposite in="m" in2="SourceAlpha" operator="in"/>
    </filter>
    <filter id="env-sombra" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="7"/></filter>
    <linearGradient id="env-lado-e" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#F3E1D5"/><stop offset="1" stop-color="#E9D1C3"/></linearGradient>
    <linearGradient id="env-lado-d" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#F3E1D5"/><stop offset="1" stop-color="#E8CFC1"/></linearGradient>
    <linearGradient id="env-baixo" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#EFDACC"/><stop offset="1" stop-color="#F5E5DA"/></linearGradient>
    <linearGradient id="env-aba" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#F7E8DE"/><stop offset=".7" stop-color="#F1DDD0"/><stop offset="1" stop-color="#EBD3C5"/></linearGradient>
    <linearGradient id="env-forro" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#F4D2D4"/><stop offset="1" stop-color="#EDBEC5"/></linearGradient>
    <clipPath id="env-canto"><rect width="780" height="538" rx="9"/></clipPath>
  </defs></svg>`;
const BOLSO = `
  <svg viewBox="0 0 780 538" aria-hidden="true" focusable="false"><g clip-path="url(#env-canto)">
    <g filter="url(#env-grao)">
      <path d="M0,0L404,300L0,538Z" fill="url(#env-lado-e)"/>
      <path d="M780,0L376,300L780,538Z" fill="url(#env-lado-d)"/>
    </g>
    <path d="M-6,542L372,266Q390,253 408,266L786,542" fill="none" stroke="#8F5E4C" stroke-opacity=".34" stroke-width="12" filter="url(#env-sombra)" class="env-so"/>
    <path d="M0,538L372,266Q390,253 408,266L780,538Z" fill="url(#env-baixo)" filter="url(#env-grao)"/>
    <path d="M2,537L372,267.5Q390,254.5 408,267.5L778,537" fill="none" stroke="#FFFAF5" stroke-opacity=".75" stroke-width="1.6"/>
    <rect x=".8" y=".8" width="778.4" height="536.4" rx="8.4" fill="none" stroke="#FFFAF5" stroke-opacity=".5" stroke-width="1.6"/>
  </g></svg>`;
const ABA_FORA = `
  <svg viewBox="0 0 780 312" aria-hidden="true" focusable="false">
    <g class="env-lo" fill="#8F5E4C" fill-opacity=".1"><path d="${ABA}" transform="translate(0 3)"/><path d="${ABA}" transform="translate(0 6.5)"/><path d="${ABA}" transform="translate(0 10)"/></g>
    <path d="${ABA}" fill="url(#env-aba)" filter="url(#env-grao)"/>
    <path d="M13,40.5L367.5,299Q390,315.5 412.5,299L767,40.5" fill="none" stroke="#FFFAF5" stroke-opacity=".7" stroke-width="1.6"/>
  </svg>`;
const ABA_DENTRO = `
  <svg viewBox="0 0 780 312" aria-hidden="true" focusable="false">
    <path d="${ABA}" fill="#F1DDD0" filter="url(#env-grao)"/>
    <path d="M22,10H758V17Q758,26 750,32L404,285Q390,295 376,285L30,32Q22,26 22,17Z" fill="url(#env-forro)"/>
  </svg>`;

export function createLetter(stage, dados, { token, onRide }) {
  const ev = dados.evento;
  stage.innerHTML = `
    <div class="lt">${PAPEL}
      <div class="lt-env lt-envb"><div class="lt-inside"></div><div class="lt-flap lt-flap-in"><div class="lt-flap-face">${ABA_DENTRO}</div></div></div>
      <div class="lt-sheet" aria-hidden="true">
        <div class="lt-panel lt-mid"><div class="lt-face" style="--i:1"></div></div>
        <div class="lt-panel lt-bot"><div class="lt-face" style="--i:2"></div><div class="lt-face back"></div></div>
        <div class="lt-panel lt-top"><div class="lt-face" style="--i:0"></div><div class="lt-face back"></div></div>
      </div>
      <div class="lt-env lt-envf">
        <div class="lt-pocket">${BOLSO}</div>
        <div class="lt-to"><small>Para</small><b></b></div>
        <div class="lt-flap lt-flap-out"><div class="lt-flap-face">${ABA_FORA}</div></div>
        <button class="lt-seal" type="button" data-act="open" aria-label="Abrir o convite: romper o selo de cera">${SELO}</button>
      </div>
      <div class="lt-open"><button class="chip" type="button" data-act="open"><span>Role para abrir o convite</span><svg aria-hidden="true"><use href="#i-chev"/></svg></button></div>
      <div class="rsvp"></div>
      <p class="sr-only" data-texto></p>
    </div>`;
  // The stage is always laid out (its height is part of the page's scroll); until the envelope comes it is only unseen.
  stage.classList.add('fora');
  stage.hidden = false;

  const $ = (s) => stage.querySelector(s);
  const lt = $('.lt'), sheet = $('.lt-sheet'), envb = $('.lt-envb'), envf = $('.lt-envf'), seal = $('.lt-seal');
  const flapIn = $('.lt-flap-in'), flapOut = $('.lt-flap-out'), top = $('.lt-top'), bot = $('.lt-bot');
  const abrir = $('.lt-open'), rsvp = $('.rsvp'), confete = document.getElementById('confete'), veil = document.getElementById('veil');
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
  let anims = [], T0 = '', T1 = '', ocupado = false, focar = false;
  let dentro = 0;      // how far in the envelope is: 0 below the screen, 1 in place (it rides the scroll)
  let abertura = 0;    // how far open: 0 sealed, 1 the letter lies unfolded (it rides the scroll too)
  const pecas = [envb, envf, abrir];
  const queda = () => (1 - dentro) ** 2 * innerHeight;   // how far below its place: quick at first, settling gently

  // the envelope, the folded letter inside it and the veil behind them, for the current `dentro`
  function pose() {
    const y = queda(), t = y > 0.5 ? `translateY(${y.toFixed(1)}px)` : '';
    pecas.forEach((el) => { el.style.transform = t; });
    sheet.style.transform = t ? `${t} ${T0}` : T0;
    veil.style.opacity = (dentro * dentro * (3 - 2 * dentro)).toFixed(3);
  }

  // Where the folded letter sits inside the envelope (T0) and how far it rises out of it (T1). Measured
  // with nothing moving: an opening under way is taken down, measured and put back at the same point.
  function place() {
    ajustar();
    if (estado === 'aberto') return;
    const tinha = anims.length > 0;
    limpar();
    pecas.forEach((el) => { el.style.transform = ''; });   // measured where they rest
    sheet.style.transform = 'none';
    const e = envb.getBoundingClientRect(), s = sheet.getBoundingClientRect();
    if (s.width && e.width) {
      const terco = s.height / 3;
      const k = Math.min((e.width * 0.9) / s.width, (e.height * 0.9) / terco); // the folded letter fits inside the envelope
      const dx = e.left + e.width / 2 - (s.left + s.width / 2);
      const dy = e.top + e.height * 0.52 - (s.top + (s.height * k) / 2); // origin is the top edge
      T0 = `translate(${dx}px, ${dy}px) scale(${k})`;
      T1 = `translate(${dx}px, ${dy - e.height * 1.02}px) scale(${k})`;
    }
    pose();
    if (tinha) { montar(); mover(); }
  }
  addEventListener('resize', () => requestAnimationFrame(place));

  const run = (el, frames, opts) => {
    const a = el.animate(frames, { fill: 'both', easing: EASE, ...opts });
    anims.push(a);
    return a;
  };
  const limpar = () => { anims.forEach((a) => a.cancel()); anims = []; };
  // The envelope follows the scroll (main.js calls this every frame): 0 = still below the screen,
  // 1 = in place, with the hall dimmed and blurred behind it. Scrolling back up sends it down again,
  // so the hall can be looked at for as long as the guest likes.
  function enter(e) {
    if (abertura > 0) return;
    e = Math.min(1, Math.max(0, e));
    if (e === dentro) return;
    const estava = dentro > 0;
    dentro = e;
    estado = e > 0 ? 'chegou' : 'fora';
    lt.classList.toggle('on', e >= 0.999);
    stage.classList.toggle('fora', e === 0);
    if (e > 0 && !estava) place();   // place() measures, then poses
    else pose();
  }

  // The opening follows the scroll as well: 0 = sealed, 1 = the letter lies unfolded. It is one
  // timeline (seal, flap, the letter out and down, the two folds) held still and moved by hand, so it
  // plays backwards just the same. With reduced motion it has two states only: closed and open.
  const TEMPO = 6050;   // the timeline's length, in its own milliseconds
  function unfold(o) {
    o = Math.min(1, Math.max(0, o));
    if (calmo()) o = o < 0.5 ? 0 : 1;
    if (o === abertura) return;
    if (o > 0 && dentro < 1) enter(1);
    abertura = o;
    if (o === 0) {
      if (estado === 'aberto') dobrar();
      limpar();
      lt.classList.remove('opening');
      estado = 'chegou';
      pose();
    } else if (o === 1) {
      if (estado !== 'aberto') settle();
    } else {
      if (estado === 'aberto') dobrar();
      estado = 'abrindo';
      if (!anims.length) montar();
      mover();
    }
  }
  const mover = () => { const t = abertura * TEMPO; anims.forEach((a) => { a.currentTime = t; }); };

  function montar() {
    lt.classList.add('opening'); // T0 / T1 were set when the envelope came in and on every resize
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
    // Once the letter has risen clear of the envelope it is out of it: on its way down it passes in
    // front of the whole envelope (never back under the pocket's folds).
    run(sheet, [{ zIndex: 2, easing: 'steps(1, end)' }, { zIndex: 4 }], { duration: 2300 * 0.42, delay: 2150, easing: 'linear' });
    [envb, envf].forEach((e) => run(e, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(40%)', opacity: 0 }], { duration: 900, delay: 3100, easing: 'ease-in' }));
    run(top, [{ transform: 'perspective(160em) rotateX(-180deg)' }, { transform: 'perspective(160em) rotateX(0deg)' }], { duration: 1100, delay: 4300 });
    run(bot, [{ transform: 'perspective(160em) rotateX(180deg)' }, { transform: 'perspective(160em) rotateX(0deg)' }], { duration: 1100, delay: 4950 });
    anims.forEach((a) => a.pause());
  }

  // The unfolded letter stays exactly where the timeline left it: the resting pose is written
  // while the timeline still holds it, the style is flushed, and only then is the timeline
  // dropped. No transition is declared on any of these, so nothing can move.
  function settle() {
    estado = 'aberto';
    sheet.style.transform = top.style.transform = bot.style.transform = 'none';
    lt.classList.remove('opening');
    lt.classList.add('open');
    stage.classList.add('aberto');   // what follows the letter (answer, gifts, goodbye) is there now
    envb.hidden = envf.hidden = abrir.hidden = true;
    void sheet.offsetWidth;
    limpar();
    sheet.removeAttribute('aria-hidden');
    sheet.setAttribute('role', 'group');
    sheet.setAttribute('aria-label', 'Convite');
    sheet.tabIndex = -1;
    sheet.querySelectorAll('.lt-face:not(.back) .inv:not([aria-hidden]) a').forEach((a) => a.removeAttribute('tabindex'));

    const semResposta = !dados.resposta && !dados.encerrado;
    page.show(true, { alvo: rsvp, texto: semResposta ? 'Role para responder' : 'Role para ver sua resposta' });
    if (focar) { focar = false; sheet.focus({ preventScroll: true }); }   // opened from the keyboard: reading goes on in the letter
  }

  // Scrolling back up: the open letter is three folded panels over its envelope again, ready for
  // the timeline to take it from its last frame.
  function dobrar() {
    estado = 'abrindo';
    lt.classList.remove('open');
    stage.classList.remove('aberto');
    envb.hidden = envf.hidden = abrir.hidden = false;
    top.style.transform = bot.style.transform = '';
    sheet.setAttribute('aria-hidden', 'true');
    sheet.removeAttribute('role');
    sheet.removeAttribute('aria-label');
    sheet.querySelectorAll('a').forEach((a) => { a.tabIndex = -1; });
    page.show(false);
    place();
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
    if (a === 'open') { focar = true; onRide?.(); }   // the seal and the hint are buttons: they scroll the opening through
    else if (a === 'sim' || a === 'nao') responder(a);
    else if (a === 'mudar') trocar('mudar');
    else if (a === 'voltar') trocar('resposta');
  });

  mostrar(!dados.resposta && !dados.encerrado ? 'pedir' : 'resposta');   // the answer block has its place from the start
  place();

  return {
    enter,
    unfold,
    // one step of the main loop: the open page's scroll progress, 0 (top) to 1 (bottom); 0 until the letter is open
    tick: (dt) => page.tick(dt),
    // a ride is bringing the visitor to the open letter: once it lies open, reading goes on in it
    follow() { focar = true; },
    get estado() { return estado; },
  };
}
