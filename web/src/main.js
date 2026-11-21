import './styles/app.css';
import { CAPTIONS, ENVELOPE, FADE_OUT, REACH, SWAP, TAIL_SCREENS, TRACK_SCREENS, fadeAt, span } from './scene/journey.js';
import { createTilt } from './ui/tilt.js';
import { createLetter } from './ui/letter.js';
import './styles/scene.css';
import { LEVELS, PRESETS, createGovernor, detectLevel, saveChoice, savedChoice } from './quality.js';
import { nightOf, paintSky, phaseAt } from './scene/sky.js';
import { createSettings } from './ui/settings.js';

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
  // blue by day, starry by night: the guest's own clock decides, unless they pick one in the cog's menu
  let ceu = 'auto', pintado = -1;             // ceu: auto | dia | noite
  const fase = () => (ceu === 'dia' ? 0 : ceu === 'noite' ? 0.5 : phaseAt());   // the sky's phase (see scene/sky.js)
  const pintar = (f) => { pintado = f; paintSky(f); };
  pintar(fase());
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('fotos')) return tirarFotos(txt);
  let world = null, createWorld = null;
  let escolha = savedChoice(), nivel = null, detectado = null, trocando = false;   // escolha: auto | low | medium | high
  const marcar = () => { LEVELS.forEach((l) => document.body.classList.toggle('q-' + l, l === nivel)); };
  if (webglOk() && !calmo && !soImagens) {
    try {
      ({ createWorld } = await import('./scene/world.js'));
      detectado = await detectLevel();
      nivel = escolha === 'auto' ? detectado : escolha;
      try {
        world = await createWorld($('gl'), progresso, { preset: PRESETS[nivel], sky: fase() });
      } catch (e) {
        if (nivel === 'low') throw e;
        console.warn('Cena 3D pesada demais para este aparelho; usando a versão leve.', e);
        const novo = $('gl').cloneNode(false);   // a canvas keeps its first context: start over on a fresh one
        $('gl').replaceWith(novo);
        nivel = 'low';
        world = await createWorld(novo, progresso, { preset: PRESETS.low, sky: fase() });
      }
    } catch (e) {
      console.warn('3D indisponível, usando imagens.', e);
      world = null; nivel = null;
    }
  }
  if (!world) {
    $('gl').hidden = true;
    const { createStills } = await import('./scene/stills.js');
    world = createStills($('stills'), nightOf(fase()));
    await world.ready;
  }
  marcar();

  // ---- quality: the cog's menu, and the governor that keeps the frame rate up
  let quadro = null, pagina = 0;               // quadro(): what the scene is showing right now, as frame() arguments
  const governor = createGovernor({
    onScale: (s) => world.setScale?.(s),
    onDrop: () => {                            // still slow at the lowest resolution: one preset down
      const i = LEVELS.indexOf(nivel);
      if (escolha !== 'auto' || i <= 0 || trocando) return false;
      trocar(LEVELS[i - 1]);
      return true;
    },
  });
  const settings = nivel ? createSettings({
    onChoose(v) {
      if (trocando || v === escolha) return;
      escolha = v;
      saveChoice(v);
      const alvoNivel = v === 'auto' ? detectado : v;
      if (alvoNivel !== nivel) trocar(alvoNivel);
      else { governor.reset(PRESETS[nivel].minScale, escolha === 'auto'); settings.update({ choice: escolha, level: nivel }); }
    },
    onSky(v) {                                 // the wheel turns: one leaves to the left, the other rises on the right
      ceu = v;
      settings.sky(ceu);
      world.setSky?.(fase());
    },
  }) : null;
  // Changing preset loads that preset's models into a second canvas, then swaps the two on one frame.
  async function trocar(novoNivel) {
    if (trocando || !createWorld || novoNivel === nivel) return;
    trocando = true;
    settings?.update({ choice: escolha, level: nivel, busy: true });
    governor.pause(60);
    const antigo = $('gl'), novo = document.createElement('canvas');
    novo.className = 'gl-next';
    novo.setAttribute('aria-hidden', 'true');
    antigo.before(novo);                       // underneath the current one until it is ready
    try {
      const outro = await createWorld(novo, null, { preset: PRESETS[novoNivel], sky: world.phase ?? fase() });
      outro.setSky(fase());                    // a turn of the sky under way carries on in the new scene
      if (quadro) outro.frame(...quadro());
      const velho = world;
      world = outro;
      nivel = novoNivel;
      antigo.remove();
      novo.id = 'gl';
      novo.className = '';
      velho.dispose?.();
      marcar();
    } catch (e) {
      console.warn('Não foi possível mudar a qualidade.', e);
      novo.remove();
    }
    trocando = false;
    governor.reset(PRESETS[nivel].minScale, escolha === 'auto');
    settings?.update({ choice: escolha, level: nivel });
  }
  if (import.meta.env.DEV) window.__cena = () => ({ nivel, escolha, ceu, fase: world.phase, escala: governor.scale, desenho: world.renderer?.info.render });   // for testing
  if (nivel) {
    governor.reset(PRESETS[nivel].minScale, escolha === 'auto');
    settings.update({ choice: escolha, level: nivel });
    settings.sky(ceu);
    setInterval(() => { world.setSky?.(fase()); }, 60000);
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
  const track = $('track'), guide = $('guide'), hint = $('hint'), skip = $('skip'), caption = $('caption'), rail = $('rail'), dot = rail.firstElementChild, fade = $('fade'), cue = $('cue');
  const medir = () => { track.style.height = Math.round(innerHeight * (TRACK_SCREENS + TAIL_SCREENS)) + 'px'; };
  medir();
  let largura = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== largura) { largura = innerWidth; medir(); } }); // ignore mobile URL-bar resizes
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);

  const fundo = () => document.documentElement.scrollHeight - innerHeight;
  // how far the scroll has come, in journeys: 1 is the walk's end in the hall, REACH the very bottom
  const alvo = () => {
    const max = fundo();
    return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) * REACH : 0;
  };
  function hud(on) { [guide, rail].forEach((el) => el.classList.toggle('gone', !on)); if (!on) { intro.style.visibility = 'hidden'; cue.classList.add('gone'); } }

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
  let x = 0, p = 0, antes = performance.now(), salao = false, some = -1;   // x: the scroll, eased, in journeys; p: the journey itself (0 to 1)
  quadro = () => [p, 0, tilt.state, pagina];
  function loop(agora) {
    const real = (agora - antes) / 1000, dt = Math.min(0.05, real);
    antes = agora;
    governor.tick(real);
    const a = aberto ? REACH : alvo(); // once the letter is open the journey stays in the hall
    x += (a - x) * (1 - Math.exp(-dt * (calmo ? 30 : 5)));
    if (Math.abs(a - x) < 0.0004) x = a;
    p = Math.min(1, x);

    const page = letter.tick(dt); // 0 until the letter is open, then the open page's scroll progress, 0 (top) to 1 (bottom)
    const noSalao = world.frame(p, dt, tilt.state, page);
    pagina = page;
    // the page's own sky keeps up with the scene's while it turns from day to night
    const f = world.phase;
    if (f !== undefined && f !== pintado && (Math.abs(f - pintado) > 0.008 || f === fase())) pintar(f);
    settings?.tuck(page > 0.04);
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
      if (passeando && a >= REACH && x >= REACH - 0.001) parar();

      // in the hall the scroll goes on: the hall alone at first, then the envelope rides it up from below
      const env = span(x, ENVELOPE);
      letter.enter(env);
      cue.classList.toggle('gone', passeando || p < FADE_OUT[1] - 0.012 || env > 0.12);
    }
    requestAnimationFrame(loop);
  }

  await motion;
  [guide, rail].forEach((el) => { el.hidden = false; });
  rail.classList.add('gone');
  assentar();
  $('loader').classList.add('done');
  settings?.show();
  intro.classList.add('on');
  document.body.classList.remove('locked');
  requestAnimationFrame((t) => { antes = t; loop(t); });
}

// Dev only (?fotos): redraws the still images of the fallback journey from the 3D scene and sends
// them to the dev server, which saves them in web/public/stills (see vite.config.js).
async function tirarFotos(txt) {
  const [{ createWorld }, { FRAMES }] = await Promise.all([import('./scene/world.js'), import('./scene/stills.js')]);
  const canvas = $('gl');
  $('loader').style.display = 'none';
  const world = await createWorld(canvas, null, { preset: { ...PRESETS.high, pixelRatio: 1 }, sky: 0 });
  let n = 0;
  for (const [w, h, sufixo] of [[1152, 768, ''], [768, 1152, '_mobile']]) {
    Object.assign(canvas.style, { inset: 'auto', left: '0', top: '0', width: w + 'px', height: h + 'px' });
    for (const noite of [0, 1]) {
      world.setSky(noite ? 0.5 : 0, true);
      for (const f of FRAMES) {
        if (noite && f.dentro) continue;
        world.frame(f.dentro ? 1 : f.p, 0, null, 0);
        const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.86));   // read right after drawing
        const nome = `${f.src}${noite ? '_noite' : ''}${sufixo}.jpg`;
        const r = await fetch('/__still/' + nome, { method: 'POST', body: blob });
        if (!r.ok) throw new Error('foto ' + nome);
        n++;
      }
    }
  }
  document.title = `fotos: ${n}`;
  txt.textContent = `${n} imagens salvas em web/public/stills`;
  $('loader').style.display = '';
}

start();
