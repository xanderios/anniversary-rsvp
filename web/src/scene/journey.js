// The scroll journey as data. Positions are in Blender coordinates (Z up); world.js converts
// them. `k` is how much of the 3:2 framing must stay visible on a narrow (portrait) screen,
// `fog` is where the haze starts and where it hides the land completely, `rise` is how much
// higher the camera walks on a tall, narrow screen (so the path does not fill the picture).
// blender/exterior.py keeps the same walk in CAM_TRACK (nothing may stand or fly there).
export const KEYS = [
  { p: 0.0, pos: [0.3, -72.8, 28.2], tgt: [0.3, -1.5, 5.0], lens: 76, k: 0.84, fog: [79, 112] },   // longe
  { p: 0.1, pos: [0.4, -65.0, 15.5], tgt: [0.4, -1.0, 5.0], lens: 58, k: 0.78, fog: [68, 132] },   // descida
  { p: 0.2, pos: [0.5, -55.0, 5.2], tgt: [0.5, 0.0, 5.2], lens: 40, k: 0.68, rise: 0.6, fog: [52, 140] },     // pousando no caminho
  { p: 0.3, pos: [0.0, -46.0, 3.3], tgt: [0.5, 0.0, 5.0], lens: 36, k: 0.62, rise: 1.3, fog: [42, 140] },     // a caminhada
  { p: 0.4, pos: [-0.8, -36.0, 3.0], tgt: [0.5, 0.0, 4.8], lens: 33, k: 0.6, rise: 1.4, fog: [36, 130] },
  { p: 0.5, pos: [0.9, -26.0, 2.8], tgt: [0.55, 0.0, 4.6], lens: 31, k: 0.6, rise: 1.3, fog: [32, 122] },
  { p: 0.6, pos: [-1.3, -16.5, 2.5], tgt: [0.6, 0.0, 4.3], lens: 30, k: 0.6, rise: 1.1, fog: [28, 115] },     // jardim
  { p: 0.7, pos: [0.2, -7.0, 1.7], tgt: [0.6, 0.5, 2.7], lens: 26, k: 0.62, rise: 0.3, fog: [24, 110] },      // diante dos portões
  { p: 0.8, pos: [0.35, -6.0, 1.65], tgt: [0.6, 0.6, 2.6], lens: 26, k: 0.62, fog: [24, 110] },    // os portões se abrem
  { p: 0.9, pos: [0.6, -1.7, 1.5], tgt: [0.6, 3.0, 1.6], lens: 22, k: 0.8, fog: [20, 100] },       // travessia
];
export const HALL = {
  from: { pos: [0, -21.5, 4.2], tgt: [0, 3, 4.0] },
  to:   { pos: [0, -18.6, 3.9], tgt: [0, 3, 3.8] },
  lens: 30, k: 0.52,
};
export const TRACK_SCREENS = 9.5;        // length of the journey's scroll, in screen heights
export const GATE = [0.66, 0.8];         // the camera waits at the gates while they swing open
export const GATE_ANGLE = (105 * Math.PI) / 180;
export const FADE_IN = [0.84, 0.9];      // cream glow rises
export const SWAP = 0.9;                 // garden -> hall behind the glow
export const FADE_OUT = [0.9, 0.95];
// After the walk ends in the hall the scroll goes on: the hall alone at first, to look at, then the
// envelope rides the scroll up from below, then the same scroll breaks the seal, opens the flap and
// unfolds the letter. From there on the page itself scrolls (the answer, the gifts, the goodbye).
// Scrolling up plays all of it backwards, out to the garden again.
const WALK = TRACK_SCREENS - 1;          // screens of scroll in one journey (0 to 1)
export const TAIL_SCREENS = 1;           // the hall and the envelope's arrival, in screen heights
export const OPEN_SCREENS = 3;           // the opening: seal, flap, the letter out and unfolded
export const REACH = 1 + TAIL_SCREENS / WALK;         // the envelope is in place, still sealed, in journeys
export const OPENED = REACH + OPEN_SCREENS / WALK;    // the letter lies open (where "skip" stops): here the pinned scroll ends and the page moves
export const ENVELOPE = [1.025, 1.105];  // the envelope: still below the screen, in place (in journeys)
export const OPENING = [REACH + 0.22 / WALK, OPENED - 0.12 / WALK];   // the opening, with a short rest at each end
// what the little indicator says while the "skip" ride crosses the garden
export const CAPTIONS = [
  [0.03, 'Seguindo o caminho até o castelo…'],
  [0.46, 'Quase lá'],
  [0.66, 'Os portões se abrem para você'],
  [0.84, ''],
];

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const span = (p, [a, b]) => clamp01((p - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const fadeAt = (p) => (p < SWAP ? smooth(span(p, FADE_IN)) : 1 - smooth(span(p, FADE_OUT)));

// Horizontal half-angle tangent of a Blender lens on a 36 mm sensor.
export const lensTan = (mm) => 18 / mm;

// Vertical FOV (degrees) that keeps `k` of the reference width in view at this aspect.
export function fovFor(tanH, k, aspect) {
  const tv = Math.max(tanH / 1.5, (k * tanH) / aspect);
  return Math.min(82, (2 * Math.atan(tv) * 180) / Math.PI);
}

// Smooth, never-overshooting curve through (xs[i], ys[i]) (monotone cubic, Fritsch-Carlson).
// Used for "distance walked" against scroll, so the camera slows down and speeds up gently.
export function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const a = xs[i] - xs[i - 1], b = xs[i + 1] - xs[i];
      m[i] = (3 * (a + b)) / ((2 * b + a) / d[i - 1] + (b + 2 * a) / d[i]);
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
