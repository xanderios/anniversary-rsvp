import './styles/app.css';
import { ARRIVE, CAPTIONS, LEAVE, SWAP, TRACK_SCREENS, fadeAt } from './scene/journey.js';
import { createTilt } from './ui/tilt.js';
import { createLetter } from './ui/letter.js';

const $ = (id) => document.getElementById(id);
const token = location.pathname.split('/')[2] || '';
const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
const soImagens = new URLSearchParams(location.search).has('imagens'); // ?imagens forces the still-image journey

async function dadosDoConvite() {
  const el = $('convite');
  if (el) return JSON.parse(el.textContent);
  const r = await fetch(`/api/convite/${token}`); // dev server path
  if (!r.ok) throw new Error('convite');
  return r.json();
}

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

async function start() {
  let dados;
  try {
    dados = await dadosDoConvite();
  } catch {
    location.replace('/');
    return;
  }
  const ev = dados.evento;
  document.title = `Convite · ${ev.nome}`;
  $('ld-name').textContent = ev.nome;
  $('ld-sub').textContent = ev.idade;

  // ---- phone motion: asked while the garden loads (iOS only allows it after a tap)
  const tilt = createTilt();
  const motion = new Promise((resolve) => {
    if (!tilt.hasSensor || calmo) return resolve();
    if (!tilt.needsPermission) { tilt.enable(); return resolve(); }
    const card = $('ld-motion');
    card.hidden = false;
    $('ld-yes').addEventListener('click', async () => { $('ld-yes').disabled = true; await tilt.enable(); card.hidden = true; resolve(); }, { once: true });
    $('ld-no').addEventListener('click', () => { card.hidden = true; resolve(); }, { once: true });
  });

  // ---- the journey renderer: real-time 3D, or still renders as a fallback
  const fill = $('ld-fill'), txt = $('ld-txt');
  const progresso = (f) => { fill.style.width = Math.max(4, Math.round(f * 100)) + '%'; txt.textContent = `Preparando o jardim… ${Math.round(f * 100)}%`; };
  let world = null;
  if (webglOk() && !calmo && !soImagens) {
    try {
      const { createWorld } = await import('./scene/world.js');
      world = await createWorld($('gl'), progresso);
    } catch (e) {
      console.warn('3D indisponível, usando imagens.', e);
    }
  }
  if (!world) {
    $('gl').hidden = true;
    const { createStills } = await import('./scene/stills.js');
    world = createStills($('stills'));
    await world.ready;
  }
  progresso(1);
  txt.textContent = 'Tudo pronto';

  // ---- opening card: who invites whom, the name, the verse
  const intro = $('intro'), card = $('in-card');
  {
    const lead = $('in-lead'), b = (t, cls) => { const el = document.createElement('b'); el.textContent = t; if (cls) el.className = cls; return el; };
    const quem = document.createElement('span');
    quem.className = 'in-guest';
    quem.textContent = `${dados.convidado},`;
    lead.append(quem, ' é com imenso prazer que ', b(ev.anfitrioes || 'papai e mamãe'), ' te convidam para o aniversário de ', b(ev.idade, 'in-age'), ' da');
    $('in-name').textContent = ev.nome;
    const verso = (ev.poema || []).join(' '), fim = ev.poemaDestaque || '';
    const poema = $('in-poem');
    if (fim && verso.endsWith(fim)) poema.append(verso.slice(0, -fim.length), b(fim));
    else poema.textContent = verso;

    // scalloped outline (soft lobes, pinched corners), redrawn whenever the card changes size
    const svg = $('in-frame'), [fill, line] = svg.querySelectorAll('path');
    const scallop = (w, h, r) => {
      const nx = Math.max(3, Math.round((w - 2 * r) / (r * 3.2))), ny = Math.max(2, Math.round((h - 2 * r) / (r * 3.2)));
      const sx = (w - 2 * r) / nx, sy = (h - 2 * r) / ny, k = r * 0.95 * 0.9;
      let d = `M ${r} ${r}`;
      const bump = (x0, y0, x1, y1, nxv, nyv) => { d += ` C ${(x0 + nxv * k).toFixed(1)} ${(y0 + nyv * k).toFixed(1)}, ${(x1 + nxv * k).toFixed(1)} ${(y1 + nyv * k).toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
      for (let i = 0; i < nx; i++) bump(r + i * sx, r, r + (i + 1) * sx, r, 0, -1);
      for (let i = 0; i < ny; i++) bump(w - r, r + i * sy, w - r, r + (i + 1) * sy, 1, 0);
      for (let i = 0; i < nx; i++) bump(w - r - i * sx, h - r, w - r - (i + 1) * sx, h - r, 0, 1);
      for (let i = 0; i < ny; i++) bump(r, h - r - i * sy, r, h - r - (i + 1) * sy, -1, 0);
      return d + ' Z';
    };
    // the name is as large as the card allows, never wider
    const nome = $('in-name');
    const caber = () => {
      nome.style.fontSize = '';
      const max = card.clientWidth - 12, w = nome.offsetWidth;
      if (w > max) nome.style.fontSize = (parseFloat(getComputedStyle(nome).fontSize) * max / w).toFixed(1) + 'px';
    };
    const desenhar = () => {
      caber();
      const w = svg.clientWidth, h = svg.clientHeight;
      if (!w || !h) return;
      const d = scallop(w, h, Math.min(40, w / 13));
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      fill.setAttribute('d', d); line.setAttribute('d', d);
    };
    intro.hidden = false;
    if ('ResizeObserver' in window) new ResizeObserver(desenhar).observe(card);
    addEventListener('resize', desenhar);
    desenhar();
  }

  // ---- envelope + invitation
  let aberto = false;
  const letter = createLetter($('stage'), dados, {
    token,
    onOpen() { aberto = true; document.body.classList.add('locked'); hud(false); },
  });

  // ---- scroll -> progress
  const track = $('track'), guide = $('guide'), hint = $('hint'), skip = $('skip'), caption = $('caption'), rail = $('rail'), dot = rail.firstElementChild, fade = $('fade');
  const medir = () => { track.style.height = Math.round(innerHeight * TRACK_SCREENS) + 'px'; };
  medir();
  let largura = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== largura) { largura = innerWidth; medir(); } }); // ignore mobile URL-bar resizes
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);

  const fundo = () => document.documentElement.scrollHeight - innerHeight;
  const alvo = () => {
    const max = fundo();
    return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  };
  function hud(on) { [guide, rail].forEach((el) => el.classList.toggle('gone', !on)); if (!on) intro.style.visibility = 'hidden'; }

  // "skip" rests on the hint; once the hint sinks away it slides down into the hint's place
  const pill = hint.firstElementChild;
  function assentar() {
    if (guide.hidden) return;
    const meio = pill.offsetTop + hint.offsetTop + pill.offsetHeight / 2;
    guide.style.setProperty('--pill', meio + 'px');
    guide.style.setProperty('--drop', (meio - (skip.offsetTop + skip.offsetHeight / 2)) + 'px');
    const fundoGuia = innerHeight - guide.getBoundingClientRect().top;
    intro.style.setProperty('--guide-room', Math.round(fundoGuia + 26) + 'px');
  }
  addEventListener('resize', assentar);
  document.fonts?.ready.then(() => { dispatchEvent(new Event('resize')); });

  // ---- the ride: one smooth crossing of the whole journey, as in a guided tour
  let passeio = 0, passeando = false, legenda = '';
  function parar() {
    if (!passeando) return;
    cancelAnimationFrame(passeio);
    passeando = false;
    guide.classList.remove('riding');
  }
  skip.addEventListener('click', () => {
    const de = scrollY, dist = fundo() - de;
    if (dist < 2) return;
    // about 1.3 s per screen of distance; the whole crossing takes some 11 s
    const dur = calmo ? 1 : Math.min(11000, Math.max(700, (dist / innerHeight) * 1300)), t0 = performance.now();
    cancelAnimationFrame(passeio);
    passeando = true;
    guide.classList.add('riding');
    const passo = (t) => {
      const f = Math.min(1, (t - t0) / dur), sio = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      scrollTo(0, de + dist * (0.35 * sio + 0.65 * f)); // nearly even pace, soft at both ends
      if (f < 1) passeio = requestAnimationFrame(passo);
    };
    passeio = requestAnimationFrame(passo);
  });
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((evn) => addEventListener(evn, (e) => { if (!skip.contains(e.target)) parar(); }, { passive: true }));

  const suave = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  let p = 0, antes = performance.now(), chegou = false, timer = 0, salao = false, some = -1;
  function loop(agora) {
    const dt = Math.min(0.05, (agora - antes) / 1000);
    antes = agora;
    const a = alvo();
    p += (a - p) * (1 - Math.exp(-dt * (calmo ? 30 : 5)));
    if (Math.abs(a - p) < 0.0004) p = a;

    const noSalao = world.frame(p, dt, tilt.state);
    if (noSalao !== salao) { salao = noSalao; document.body.classList.toggle('in-hall', salao); }
    fade.style.opacity = fadeAt(p).toFixed(3);

    if (!aberto) {
      // the opening card opens the way: it lifts and fades over the first three quarters of a screen
      const hp = suave(Math.min(1, Math.max(0, scrollY / (innerHeight * 0.75))));
      if (hp !== some) {
        some = hp;
        card.style.transform = hp ? `translateY(${(-70 * hp).toFixed(1)}px) scale(${(1 - 0.12 * hp).toFixed(4)})` : '';
        card.style.opacity = Math.max(0, 1 - hp * 1.6).toFixed(3);
        intro.style.visibility = hp >= 0.63 ? 'hidden' : '';
      }
      guide.classList.toggle('moving', p > 0.012 || passeando);
      guide.classList.toggle('gone', p >= SWAP - 0.02);
      const meio = p > 0.02 && p < SWAP;
      rail.classList.toggle('gone', !meio);
      dot.style.top = (p * 100).toFixed(1) + '%';

      let texto = '';
      if (passeando && !calmo) for (const [de, t] of CAPTIONS) if (p >= de) texto = t;
      if (texto !== legenda) {
        legenda = texto;
        if (texto) caption.textContent = texto;
        caption.classList.toggle('show', !!texto);
      }
      if (passeando && a >= 1 && p >= 0.999) parar();

      if (!chegou && p >= ARRIVE) { chegou = true; timer = setTimeout(() => letter.arrive(), 650); }
      else if (chegou && p < LEAVE) { chegou = false; clearTimeout(timer); letter.leave(); }
    }
    requestAnimationFrame(loop);
  }

  await motion;
  [guide, rail].forEach((el) => { el.hidden = false; });
  rail.classList.add('gone');
  assentar();
  $('loader').classList.add('done');
  intro.classList.add('on');
  document.body.classList.remove('locked');
  requestAnimationFrame((t) => { antes = t; loop(t); });
}

start();
