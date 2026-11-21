// The sky follows the guest's own clock: blue by day, deep blue with stars by night, with a
// short dawn and dusk in between. Shared by the 3D scene and by the page's own background.
export const SKY = {
  day: { top: '#7FC0F2', bottom: '#DCEFFB', fog: '#DCEFFB' },     // fog = the horizon's colour
  night: { top: '#16225A', bottom: '#43549A', fog: '#43549A' },
};

// 0 = day, 1 = night. Night until 5:30, dawn until 6:30, day until 17:30, dusk until 18:30.
// For testing: ?ceu=noite, ?ceu=dia or ?hora=19.5 at the end of the link.
export function nightAt(date = new Date()) {
  const q = new URLSearchParams(location.search);
  const ceu = q.get('ceu');
  if (ceu === 'noite') return 1;
  if (ceu === 'dia') return 0;
  const pedido = parseFloat(q.get('hora'));
  const h = Number.isFinite(pedido) ? pedido : date.getHours() + date.getMinutes() / 60;
  if (h < 5.5 || h >= 18.5) return 1;
  if (h < 6.5) return 6.5 - h;
  if (h < 17.5) return 0;
  return h - 17.5;
}

// The guest may also pick day or night in the settings (the cog); the pick lasts for this visit,
// and the next one follows the clock again.
const KEY = 'convite:ceu';
export function savedSky() {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === 'dia' || v === 'noite' ? v : null;
  } catch {
    return null;
  }
}
export function saveSky(v) {
  try { sessionStorage.setItem(KEY, v); } catch { /* private mode: the pick lasts until the page is reloaded */ }
}

const canal = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
export function mixHex(a, b, t) {
  return '#' + [0, 1, 2].map((i) => Math.round(canal(a, i) + (canal(b, i) - canal(a, i)) * t).toString(16).padStart(2, '0')).join('');
}

// The page's own sky (seen before the 3D scene draws, and behind the still-image journey).
export function paintSky(night) {
  const top = mixHex(SKY.day.top, SKY.night.top, night), bottom = mixHex(SKY.day.bottom, SKY.night.bottom, night);
  const raiz = document.documentElement;
  raiz.style.setProperty('--sky-top', top);
  raiz.style.setProperty('--sky-bottom', bottom);
  raiz.classList.toggle('noite', night > 0.5);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', top);
}
