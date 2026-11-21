// The sky follows the guest's own clock: blue by day with the sun, deep blue with stars and the
// moon by night, and a short warm twilight in between. Shared by the 3D scene and by the page's
// own background.
//
// The sky's state is one number, its phase: a turn of the wheel that carries the sun and the moon.
// 0 = day, 0.25 = dusk, 0.5 = night, 0.75 = dawn, and 1 is day again. It only ever moves forward.
export const SKY = {
  day: { top: '#7FC0F2', bottom: '#DCEFFB' },       // bottom = the horizon's colour, and the fog's
  dusk: { top: '#6F7CC6', bottom: '#F8C6B2' },
  dawn: { top: '#8CA6E2', bottom: '#FBD2C8' },
  night: { top: '#16225A', bottom: '#43549A' },
};

const wrap = (x) => ((x % 1) + 1) % 1;
// 0 = day, 1 = night, for a phase.
export const nightOf = (phase) => { const f = wrap(phase); return f <= 0.5 ? f * 2 : 2 - f * 2; };

// Night until 5:30, dawn until 6:30, day until 17:30, dusk until 18:30.
// For testing: ?ceu=noite, ?ceu=dia or ?hora=19.5 at the end of the link.
export function phaseAt(date = new Date()) {
  const q = new URLSearchParams(location.search);
  const ceu = q.get('ceu');
  if (ceu === 'noite') return 0.5;
  if (ceu === 'dia') return 0;
  const pedido = parseFloat(q.get('hora'));
  const h = Number.isFinite(pedido) ? pedido : date.getHours() + date.getMinutes() / 60;
  if (h < 5.5 || h >= 18.5) return 0.5;
  if (h < 6.5) return 0.5 + (h - 5.5) / 2;
  if (h < 17.5) return 0;
  return (h - 17.5) / 2;
}
export const nightAt = (date) => nightOf(phaseAt(date));

// Day -> twilight -> night for one value: `stops` is [day, twilight, night], `mix` blends two of them.
// Each half eases in and out, so the twilight is a moment of its own and not a blur of the two ends.
const ease = (t) => t * t * (3 - 2 * t);
export function through(stops, n, mix) {
  return n < 0.5 ? mix(stops[0], stops[1], ease(n * 2)) : mix(stops[1], stops[2], ease(n * 2 - 1));
}
// Which twilight a phase passes through: the sun leaving (dusk) or coming back (dawn).
export const twilightOf = (phase) => (wrap(phase) <= 0.5 ? 'dusk' : 'dawn');

const canal = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
export function mixHex(a, b, t) {
  return '#' + [0, 1, 2].map((i) => Math.round(canal(a, i) + (canal(b, i) - canal(a, i)) * t).toString(16).padStart(2, '0')).join('');
}
// The sky's two colours at a phase, as hex.
export function skyAt(phase) {
  const n = nightOf(phase), tw = SKY[twilightOf(phase)];
  return {
    top: through([SKY.day.top, tw.top, SKY.night.top], n, mixHex),
    bottom: through([SKY.day.bottom, tw.bottom, SKY.night.bottom], n, mixHex),
  };
}

// The page's own sky (seen before the 3D scene draws, and behind the still-image journey).
export function paintSky(phase) {
  const { top, bottom } = skyAt(phase);
  const raiz = document.documentElement;
  raiz.style.setProperty('--sky-top', top);
  raiz.style.setProperty('--sky-bottom', bottom);
  raiz.classList.toggle('noite', nightOf(phase) > 0.5);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', top);
}
