// How much the 3D scene draws: GPU detection picks a starting preset, then the measured frame
// rate adapts it (first the drawing resolution, then, if that is not enough, a lower preset).
import { getGPUTier } from 'detect-gpu';

export const LEVELS = ['low', 'medium', 'high'];
// models: which export of the scenes (see scripts/export-models.sh). pixelRatio: most device pixels
// drawn per CSS pixel. minScale: how far the governor may shrink that. shadow: size of the sun's
// shadow map (0 = baked shade only). particles: petals and stars, relative to medium.
// reflection: size of the hall floor's mirror image relative to the screen (0 = none).
export const PRESETS = {
  low: { models: 'low', pixelRatio: 1.25, minScale: 0.6, antialias: false, shadow: 0, shadowMobile: 0, particles: 0.4, reflection: 0, gateLight: false },
  medium: { models: 'medium', pixelRatio: 2, minScale: 0.6, antialias: true, shadow: 4096, shadowMobile: 2048, particles: 1, reflection: 0.35, gateLight: true },
  high: { models: 'high', pixelRatio: 3, minScale: 0.7, antialias: true, shadow: 4096, shadowMobile: 4096, particles: 1.6, reflection: 0.6, gateLight: true },
};

const KEY = 'convite:qualidade';
const CHOICES = ['auto', ...LEVELS];
export function savedChoice() {
  const pedido = new URLSearchParams(location.search).get('q');       // ?q=low|medium|high|auto, for testing
  if (CHOICES.includes(pedido)) return pedido;
  try {
    const v = localStorage.getItem(KEY);
    return CHOICES.includes(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}
export function saveChoice(v) {
  try { localStorage.setItem(KEY, v); } catch { /* private mode: the choice lasts for this visit */ }
}

// GPU detection -> starting preset. The benchmark tables are served by the site itself (/benchmarks).
export async function detectLevel() {
  const mobile = matchMedia('(pointer: coarse)').matches;
  let gpu = null;
  try {
    gpu = await Promise.race([getGPUTier({ benchmarksURL: '/benchmarks' }), new Promise((ok) => setTimeout(() => ok(null), 2500))]);
  } catch {
    gpu = null;
  }
  if (gpu && gpu.type === 'BENCHMARK') {
    // tier 3: 60 fps or more in the benchmark; tier 2: 30 or more; below that, the lightest scene.
    if (mobile) return gpu.tier >= 3 ? 'medium' : 'low';
    return gpu.tier >= 3 ? 'high' : gpu.tier === 2 ? 'medium' : 'low';
  }
  if (gpu && (gpu.type === 'BLOCKLISTED' || gpu.tier === 0)) return 'low';
  // unknown GPU: judge by the device itself
  const mem = navigator.deviceMemory || (mobile ? 4 : 8), cores = navigator.hardwareConcurrency || 4;
  if (mobile) return mem >= 4 && cores >= 6 ? 'medium' : 'low';
  return cores >= 8 && mem >= 8 ? 'high' : cores >= 4 ? 'medium' : 'low';
}

// Watches the frame rate, one second at a time. Slow for two seconds running: draw fewer pixels;
// already at the fewest: ask for a lower preset. Fast again for a while: give pixels back.
export function createGovernor({ onScale, onDrop }) {
  let min = 0.6, scale = 1, ceiling = 1, acc = 0, n = 0, slow = 0, fast = 0, calm = 0, settle = 3, before = 0, noGain = 0, capped = false, on = true;
  const set = (s) => { scale = Math.round(s * 100) / 100; onScale(scale); };
  return {
    get scale() { return scale; },
    reset(minScale, enabled = true) {
      min = minScale; on = enabled; scale = 1; ceiling = 1; acc = n = slow = fast = calm = before = noGain = 0; settle = 3; capped = false;
      onScale(1);
    },
    pause(seconds = 2) { settle = Math.max(settle, seconds); acc = n = 0; },
    tick(dt) {                                     // dt: the real time since the last frame, in seconds
      if (!on || capped) return;
      if (dt > 0.25) { acc = n = 0; return; }       // the tab was away
      if (settle > 0) { settle -= dt; return; }
      acc += dt; n++;
      if (acc < 1) return;
      const fps = n / acc;
      acc = n = 0;
      if (before) {                                 // did the last cut help at all?
        noGain = fps < before * 1.08 ? noGain + 1 : 0;
        before = 0;
        if (noGain >= 2) {                          // no: something else caps the rate (battery saver, a 30 Hz screen)
          capped = true;
          set(Math.min(1, scale + 0.3));
          return;
        }
      }
      if (fps < 50) { slow++; fast = 0; } else if (fps > 56) { fast++; slow = 0; } else slow = fast = 0;
      if (slow >= 2) {
        slow = 0; calm = 0;
        if (scale > min + 0.01) {
          before = fps;
          ceiling = Math.max(min, scale - 0.05);
          set(Math.max(min, scale - 0.15));
          settle = 0.6;
        } else if (onDrop()) {
          scale = 1; ceiling = 1; settle = 3; noGain = 0;
        } else capped = true;                       // nothing lighter left
      } else if (fast >= 5) {
        fast = 0;
        if (++calm >= 4) { calm = 0; ceiling = Math.min(1, ceiling + 0.1); }   // long calm: allow a little more again
        if (scale < ceiling - 0.01) { set(Math.min(ceiling, scale + 0.1)); settle = 0.6; }
      }
    },
  };
}
