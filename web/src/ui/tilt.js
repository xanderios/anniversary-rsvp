// A small "look around": the mouse on a computer, the phone's own tilt on mobile.
// Output is x/y in -1..1; the scene eases toward it.
const clamp = (v) => Math.max(-1, Math.min(1, v));

export function createTilt() {
  const state = { x: 0, y: 0 };
  const DOE = window.DeviceOrientationEvent;
  const touch = matchMedia('(pointer: coarse)').matches;
  const needsPermission = !!DOE && typeof DOE.requestPermission === 'function'; // iPhone / iPad
  const hasSensor = !!DOE && touch;

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    state.x = clamp((e.clientX / innerWidth) * 2 - 1);
    state.y = clamp((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  let base = null, ouvindo = false;
  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
    let lr = e.gamma, fb = e.beta;
    if (ang === 90) { lr = e.beta; fb = -e.gamma; } else if (ang === 270 || ang === -90) { lr = -e.beta; fb = e.gamma; }
    if (!base) base = { lr, fb };
    // however the phone is held becomes "centre" again after a few seconds
    base.lr += (lr - base.lr) * 0.004;
    base.fb += (fb - base.fb) * 0.004;
    state.x = clamp((lr - base.lr) / 16);
    state.y = clamp((fb - base.fb) / 16);
  }
  function listen() {
    if (ouvindo) return;
    ouvindo = true;
    addEventListener('deviceorientation', onOrientation, { passive: true });
  }

  return {
    state,
    needsPermission,
    hasSensor,
    // Must be called from a tap on iOS. Resolves true when motion is flowing.
    async enable() {
      if (!hasSensor) return false;
      if (needsPermission) {
        try {
          if ((await DOE.requestPermission()) !== 'granted') return false;
        } catch {
          return false;
        }
      }
      listen();
      return true;
    },
  };
}
