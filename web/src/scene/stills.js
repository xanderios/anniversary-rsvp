// Fallback journey for devices without WebGL, or with reduced motion turned on: the same six
// moments as still images of the scene, cross-fading with the scroll. Each exists wide and tall,
// by day and by night (they are redrawn from the 3D scene itself: see "?fotos" in the README).
export const FRAMES = [
  { p: 0.0, src: '01_longe' },
  { p: 0.2, src: '02_descida' },
  { p: 0.6, src: '03_jardim' },
  { p: 0.76, src: '04_portoes' },
  { p: 0.87, src: '05_entrada' },
  { p: 0.95, src: '06_salao', dentro: true },      // indoors: the same by day and by night
];

export function createStills(box, night = 0) {
  box.hidden = false;
  const imgs = FRAMES.map((f, i) => {
    const nome = f.src + (night > 0.5 && !f.dentro ? '_noite' : '');
    const pic = document.createElement('picture');
    const s = document.createElement('source');
    s.media = '(orientation: portrait)';
    s.srcset = `/stills/${nome}_mobile.jpg`;
    pic.appendChild(s);
    const img = document.createElement('img');
    img.src = `/stills/${nome}.jpg`;
    img.alt = '';
    img.decoding = 'async';
    if (i > 1) img.loading = 'lazy';
    pic.appendChild(img);
    box.appendChild(pic);
    return img;
  });
  const ready = imgs[0].decode ? imgs[0].decode().catch(() => {}) : Promise.resolve();

  function frame(p) {
    let i = 0;
    while (i < FRAMES.length - 2 && p > FRAMES[i + 1].p) i++;
    const a = FRAMES[i], b = FRAMES[i + 1];
    const f = Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p)));
    const mix = f * f * (3 - 2 * f);
    imgs.forEach((img, j) => {
      const o = j === i ? 1 : j === i + 1 ? mix : 0;
      img.style.opacity = o;
      if (o > 0) img.style.transform = `scale(${(1 + (j === i ? f : f - 1) * 0.06 + 0.03).toFixed(4)})`;
    });
    return p >= 0.93;
  }
  return { frame, ready };
}
