// The 3D world: garden + castle (exterior) and the party hall (interior), both exported from
// Blender. The garden carries colour and soft occlusion in its vertex colours and is lit live
// (sun or moon, sky); the hall's light is baked entirely (Cycles) and is drawn unlit.
// The sun and the moon themselves ride a wheel behind the land: half a turn swaps day and night.
// Everything that costs frame time is scaled by a quality preset (see ../quality.js).
import {
  AdditiveBlending, BufferGeometry, CatmullRomCurve3, Color, DirectionalLight, Float32BufferAttribute, Fog, HemisphereLight,
  IcosahedronGeometry, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, Object3D, PCFShadowMap, PerspectiveCamera, PlaneGeometry,
  PointLight, Points, Quaternion, SRGBColorSpace, Scene, ShaderMaterial, Vector3, WebGLRenderTarget, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GATE, GATE_ANGLE, HALL, KEYS, SWAP, fovFor, lensTan, monotone, smooth, span } from './journey.js';
import { SKY, nightOf, through, twilightOf } from './sky.js';
import gardenLow from '../models/garden-low.glb?url';
import gardenMed from '../models/garden.glb?url';
import gardenHigh from '../models/garden-high.glb?url';
import hallLow from '../models/hall-low.glb?url';
import hallMed from '../models/hall.glb?url';
import hallHigh from '../models/hall-high.glb?url';

const MODELS = {
  low: { garden: gardenLow, hall: hallLow, bytes: [3.4e6, 0.8e6] },
  medium: { garden: gardenMed, hall: hallMed, bytes: [6.1e6, 1.5e6] },
  high: { garden: gardenHigh, hall: hallHigh, bytes: [6.6e6, 2.6e6] },
};
const b2t = ([x, y, z]) => new Vector3(x, z, -y); // Blender (Z up) -> three (Y up)
const lerp = (a, b, t) => a + (b - a) * t;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (x) => ((x % 1) + 1) % 1;

// Light by day, at twilight and by night (the sky's own colours are in sky.js, shared with the page).
const LIGHT = {
  day: { hemiSky: 0xfff4f2, hemiGround: 0xf6ddd6, hemi: 2.35, sun: 0xfff1e4, sunI: 1.5 },
  dusk: { hemiSky: 0xffd6c4, hemiGround: 0xdcaab2, hemi: 1.95, sun: 0xffb486, sunI: 1.2 },
  dawn: { hemiSky: 0xffdfd4, hemiGround: 0xe2b6c0, hemi: 2.0, sun: 0xffc4a0, sunI: 1.2 },
  night: { hemiSky: 0xb4c0f2, hemiGround: 0x7377ac, hemi: 1.5, sun: 0xc6d3ff, sunI: 0.8 },
};

// Where the sun (by day) and the moon (by night) rest: up and to the right of the castle, as seen
// from the walk. BODY is their radius and HALO the reach of their glow, in radii.
const REST = { az: 10.5, el: 11.0 };      // degrees to the right of the castle's axis, and above the horizon
const BODY = 0.066;                       // radius, as a share of the lens (so it keeps its size on screen)
const HALO = 3.4;
const TURN = { time: 0.6, speed: 0.17 };  // the wheel: seconds to pick up speed, and turns per second at most

// `sky` is the phase the scene opens at (see sky.js): 0 = day, 0.5 = night.
export async function createWorld(canvas, onProgress, { preset, sky: skyAtStart = 0 } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: preset.antialias, alpha: false, stencil: false, powerPreference: 'high-performance' });
  const mobile = matchMedia('(pointer: coarse)').matches;
  let scale = 1;                                   // the governor lowers this when frames run late
  const pixelRatio = () => Math.max(0.5, Math.min(window.devicePixelRatio || 1, preset.pixelRatio) * scale);
  renderer.setPixelRatio(pixelRatio());
  const shadows = preset.shadow > 0;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  // ---------------------------------------------------------------- load
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const files = MODELS[preset.models] || MODELS.medium;
  const sizes = { garden: files.bytes[0], hall: files.bytes[1] }, got = { garden: 0, hall: 0 };
  const report = () => onProgress?.(Math.min(1, (got.garden + got.hall) / (sizes.garden + sizes.hall)));
  const load = (name) => loader.loadAsync(files[name], (e) => {
    if (e.total) sizes[name] = e.total;
    got[name] = e.loaded;
    report();
  });
  const [garden, hallGltf] = await Promise.all([load('garden'), load('hall')]);

  // ---------------------------------------------------------------- materials
  const time = { value: 0 };
  const lampGain = { value: new Color(0, 0, 0) };  // warm light from the lanterns, baked per vertex (uv1.x)
  // Lit garden materials also take the lanterns' baked light, which fades in as night falls.
  const withLamps = (m, vertexExtra = '') => {
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = time;
      s.uniforms.uLamp = lampGain;
      s.vertexShader = `uniform float uTime;\n#ifndef USE_UV1\nattribute vec2 uv1;\n#endif\nvarying float vLamp;\n${s.vertexShader}`
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n vLamp = uv1.x / (1.0 + 0.6 * uv1.x);\n${vertexExtra}`);   // right beside a lantern the light levels off
      s.fragmentShader = `uniform vec3 uLamp;\nvarying float vLamp;\n${s.fragmentShader}`
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uLamp * vLamp;');
    };
    return m;
  };
  const lit = withLamps(new MeshLambertMaterial({ vertexColors: true }));
  const twoSided = withLamps(new MeshLambertMaterial({ vertexColors: true, side: 2 }));
  const flowers = withLamps(new MeshLambertMaterial({ vertexColors: true, side: 2 }), `
      float ph = uv.y * 6.2832 + position.x * 0.35 + position.z * 0.27;
      float w = uv.x * uv.x * 0.055;
      transformed.x += sin(uTime * 1.5 + ph) * w;
      transformed.z += cos(uTime * 1.1 + ph * 1.3) * w * 0.7;`);
  const glow = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });       // castle windows
  const lampGlass = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });  // lantern panes
  const disposables = [lit, twoSided, flowers, glow, lampGlass];

  function dress(root, rules) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const r = (rules.find(([re]) => re.test(o.name) || re.test(o.parent?.name || '')) || [null, {}])[1];
      const isGlow = o.material?.name === 'GLOW';
      o.material = isGlow ? r.glow || glow : r.mat || lit;
      o.castShadow = shadows && !isGlow && !!r.cast;
      o.receiveShadow = shadows && !isGlow && !!r.recv;
      o.frustumCulled = r.cull !== false;
      disposables.push(o.geometry);
    });
  }

  // ---------------------------------------------------------------- exterior
  const ext = new Scene();
  ext.fog = new Fog(0xffffff, KEYS[0].fog[0], KEYS[0].fog[1]);   // far land melts into the horizon
  ext.add(garden.scene);
  dress(garden.scene, [
    [/^W_Ground/, { recv: true }],
    [/^W_CastleTrim/, { recv: true }],            // windows: no shadow of their own down the wall
    [/^W_Castle/, { cast: true, recv: true }],
    [/^W_Gate/, { cast: true, recv: true }],
    [/^W_Lamps/, { cast: true, recv: true, glow: lampGlass }],
    [/^W_Trees/, { cast: true, recv: true }],
    [/^W_Flowers/, { mat: flowers, cast: true, cull: false }],
    [/^W_Flag/, { mat: twoSided }],
    [/^W_Butterfly/, { mat: twoSided }],
    [/^W_Cloud/, {}],
  ]);
  const node = (n) => garden.scene.getObjectByName(n);
  const gateL = node('W_Gate_L'), gateR = node('W_Gate_R');

  // The sky itself, drawn behind everything (the canvas is opaque: cheaper to composite). Its colour
  // depends on how high each pixel looks: the horizon has exactly the fog's colour, so far land
  // melts into it wherever the camera points, and it deepens towards the top of the sky.
  const skyGeo = new BufferGeometry();
  skyGeo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const skyMat = new ShaderMaterial({
    depthTest: false, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new Color() }, uBottom: { value: new Color() }, uInvProj: { value: new Matrix4() } },
    vertexShader: `uniform mat4 uInvProj; varying vec3 vDir;
      void main(){ vec4 v = uInvProj * vec4(position.xy, 1.0, 1.0); vDir = transpose(mat3(viewMatrix)) * (v.xyz / v.w); gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; varying vec3 vDir;
      void main(){ float up = normalize(vDir).y; float t = smoothstep(0.0, 0.5, up); t = t * (2.0 - t);
        float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;     // hides banding in the gradient
        gl_FragColor = vec4(mix(uBottom, uTop, t) + grain / 255.0, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  ext.add(sky);
  disposables.push(skyGeo, skyMat);

  // The sun and the moon: two faceted balls, each with a soft glow, at opposite ends of one wheel.
  // They are drawn at the distance where the haze closes, so the garden, the castle and the clouds
  // pass in front of them, and far land that has already melted into the sky stays behind.
  const ballGeo = new IcosahedronGeometry(1, 1), haloGeo = new PlaneGeometry(2, 2);
  disposables.push(ballGeo, haloGeo);
  const restDir = new Vector3(Math.sin(REST.az * Math.PI / 180) * Math.cos(REST.el * Math.PI / 180), Math.sin(REST.el * Math.PI / 180),
    -Math.cos(REST.az * Math.PI / 180) * Math.cos(REST.el * Math.PI / 180));
  const body = (isSun) => {
    const uniforms = { uAlpha: { value: 1 }, uLow: { value: 0 }, uTime: time };   // uLow: 0 high in the sky, 1 down at the horizon
    const defines = isSun ? { SUN: 1 } : {};
    const ballMat = new ShaderMaterial({
      uniforms, defines, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vView; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float uAlpha; uniform float uLow; varying vec3 vView;
        void main(){ vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));                              // one flat tone per facet
          float k = smoothstep(-0.35, 0.95, dot(n, normalize(vec3(-0.5, 0.62, 0.6))));
          #ifdef SUN
            vec3 col = mix(vec3(1.0, 0.79, 0.38), vec3(1.0, 0.95, 0.70), k);
            col = mix(col, mix(vec3(0.98, 0.52, 0.36), vec3(1.0, 0.77, 0.54), k), uLow);              // sets red
          #else
            vec3 col = mix(vec3(0.71, 0.76, 0.93), vec3(0.99, 0.98, 0.92), k);
            col = mix(col, mix(vec3(0.86, 0.66, 0.62), vec3(1.0, 0.91, 0.80), k), uLow * 0.7);        // rises warm
          #endif
          gl_FragColor = vec4(col, uAlpha); }`,
    });
    const glowMat = new ShaderMaterial({
      uniforms, defines: { ...defines, HALO: HALO.toFixed(2) }, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uAlpha; uniform float uLow; uniform float uTime; varying vec2 vUv;
        void main(){ vec2 p = (vUv - 0.5) * 2.0 * HALO; float d = length(p);                           // d: distance in radii
          float away = max(d - 0.9, 0.0);
          #ifdef SUN
            float rays = 0.5 + 0.5 * cos(atan(p.y, p.x) * 12.0 + uTime * 0.1); rays *= rays;
            float glow = exp(-away * 1.9) * 0.62 + rays * exp(-away * 1.3) * 0.2;
            vec3 col = mix(vec3(1.0, 0.96, 0.78), vec3(1.0, 0.72, 0.52), uLow);
          #else
            float glow = exp(-away * 1.6) * 0.46;
            vec3 col = mix(vec3(0.80, 0.87, 1.0), vec3(1.0, 0.84, 0.74), uLow * 0.7);
          #endif
          float a = glow * smoothstep(HALO, HALO * 0.6, d) * uAlpha; if (a < 0.003) discard;
          gl_FragColor = vec4(col, a); }`,
    });
    disposables.push(ballMat, glowMat);
    const ball = new Mesh(ballGeo, ballMat), halo = new Mesh(haloGeo, glowMat), root = new Object3D();
    halo.scale.setScalar(HALO);
    halo.renderOrder = -50; ball.renderOrder = -49;   // after the stars, before everything else that glows
    ball.frustumCulled = halo.frustumCulled = false;
    ball.rotation.set(0.4, isSun ? 0.3 : 2.1, 0.2);
    root.add(halo, ball);
    ext.add(root);
    return { root, ball, halo, uniforms, dir: new Vector3(), x: 0, y: 0, lag: isSun ? 0 : 0.5 };
  };
  const bodies = [body(true), body(false)];
  let bodyFar = 100;

  const hemi = new HemisphereLight(0xffffff, 0xffffff, 1);
  ext.add(hemi);
  const sun = new DirectionalLight(0xffffff, 1);
  const sunDir = new Vector3(-0.42, 0.71, 0.57).normalize();
  // One still shadow map over the castle garden and the whole walk (x, height, depth in metres).
  const lit0 = new Vector3(-34, -0.5, -13), lit1 = new Vector3(34, 15.5, 67);
  const mid = lit0.clone().add(lit1).multiplyScalar(0.5);
  sun.position.copy(mid).addScaledVector(sunDir, 120);
  sun.target.position.copy(mid);
  sun.castShadow = shadows;
  if (shadows) {
    const view = new Matrix4().lookAt(sun.position, mid, new Vector3(0, 1, 0)).setPosition(sun.position).invert();
    const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity), c = new Vector3();
    for (let i = 0; i < 8; i++) {
      c.set(i & 1 ? lit1.x : lit0.x, i & 2 ? lit1.y : lit0.y, i & 4 ? lit1.z : lit0.z).applyMatrix4(view);
      lo.min(c); hi.max(c);
    }
    const sc = sun.shadow.camera;
    sc.left = lo.x; sc.right = hi.x; sc.bottom = lo.y; sc.top = hi.y; sc.near = -hi.z - 2; sc.far = -lo.z + 2;
    const big = Math.min(renderer.capabilities.maxTextureSize, mobile ? preset.shadowMobile : preset.shadow);
    const w = hi.x - lo.x, h = hi.y - lo.y;
    sun.shadow.mapSize.set(w > h ? big : big / 2, h >= w ? big : big / 2);
    if (Math.max(w, h) / Math.min(w, h) < 1.5) sun.shadow.mapSize.set(big, big);
    sun.shadow.radius = (mobile ? 4 : 7) * (big / (mobile ? 2048 : 4096));
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.05;
  }
  ext.add(sun, sun.target);
  const gateGlow = new PointLight(0xffe2b8, 0, 9, 1.8);
  gateGlow.position.copy(b2t([0.6, 1.2, 1.9]));
  if (preset.gateLight) ext.add(gateGlow);

  const points = (n, fill, attrs, mat) => {
    const geo = new BufferGeometry(), arrays = attrs.map(([, size]) => new Float32Array(n * size));
    for (let i = 0; i < n; i++) fill(i, ...arrays);
    attrs.forEach(([name, size], k) => geo.setAttribute(name, new Float32BufferAttribute(arrays[k], size)));
    const p = new Points(geo, mat);
    p.frustumCulled = false;
    disposables.push(geo, mat);
    return p;
  };

  // sparkles around the castle (day and night)
  const sparkMat = new ShaderMaterial({
    uniforms: { uTime: time, uSize: { value: 1 }, uGain: { value: 1 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: `attribute float aRnd; uniform float uTime; uniform float uSize; varying float vA;
      void main(){ vA = 0.35 + 0.65 * abs(sin(uTime * (0.6 + aRnd) + aRnd * 40.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * (5.0 + aRnd * 9.0) * vA; }`,
    fragmentShader: `uniform float uGain; varying float vA; void main(){ vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
        float star = max(0.0, 1.0 - (p.x * p.y * 14.0 + p.x + p.y)); gl_FragColor = vec4(1.0, 0.97, 0.88, star * vA * uGain); }`,
  });
  ext.add(points(90, (i, p, r) => {
    p[i * 3] = (Math.random() - 0.5) * 90; p[i * 3 + 1] = 2 + Math.random() * 34; p[i * 3 + 2] = -14 - Math.random() * 10;
    r[i] = Math.random();
  }, [['position', 3], ['aRnd', 1]], sparkMat));

  // night sky: stars over the whole horizon, and now and then a shooting star
  const starMat = new ShaderMaterial({
    uniforms: { uTime: time, uSize: { value: 1 }, uNight: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: `attribute vec2 aRnd; uniform float uTime; uniform float uSize; varying float vA; varying float vTint;
      void main(){ vA = 0.55 + 0.45 * sin(uTime * (0.5 + aRnd.x * 1.6) + aRnd.y * 50.0); vTint = aRnd.y;
        vA *= smoothstep(0.03, 0.22, normalize(position - cameraPosition).y);                        // none in the haze of the horizon
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * (1.6 + aRnd.x * aRnd.x * 3.4); }`,
    fragmentShader: `uniform float uNight; varying float vA; varying float vTint; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.15, d) * vA * uNight; if (a < 0.01) discard;
        gl_FragColor = vec4(mix(vec3(0.82, 0.88, 1.0), vec3(1.0, 0.95, 0.84), vTint), a); }`,
  });
  const stars = points(Math.round(620 * preset.particles), (i, p, r) => {
    p[i * 3] = (Math.random() - 0.5) * 520; p[i * 3 + 1] = 6 + Math.pow(Math.random(), 0.8) * 190; p[i * 3 + 2] = -150 - Math.random() * 110;
    r[i * 2] = Math.random(); r[i * 2 + 1] = Math.random();
  }, [['position', 3], ['aRnd', 2]], starMat);
  stars.renderOrder = -60;                          // behind the moon
  ext.add(stars);
  const meteorMat = new ShaderMaterial({
    uniforms: { uAlpha: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending, side: 2,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uAlpha; varying vec2 vUv; void main(){ float tail = pow(vUv.x, 2.6); float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
        float head = smoothstep(0.9, 1.0, vUv.x); gl_FragColor = vec4(mix(vec3(0.8, 0.87, 1.0), vec3(1.0), head), tail * edge * edge * uAlpha); }`,
  });
  const meteor = new Mesh(new PlaneGeometry(1, 1), meteorMat);
  meteor.frustumCulled = false;
  meteor.visible = false;
  meteor.renderOrder = -55;
  ext.add(meteor);
  disposables.push(meteor.geometry, meteorMat);
  const shot = { t: 0, dur: 1, wait: 3 + Math.random() * 4, from: new Vector3(), dir: new Vector3(), len: 24 };

  // the lanterns' soft halos
  const lampList = node('W_Lamps')?.userData?.lamps || [];
  const haloMat = new ShaderMaterial({
    uniforms: { uTime: time, uSize: { value: 1 }, uNight: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: `attribute float aRnd; uniform float uTime; uniform float uSize; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        vA = 0.88 + 0.12 * sin(uTime * (2.0 + aRnd * 2.0) + aRnd * 30.0); gl_PointSize = min(uSize * 620.0 / -mv.z, uSize * 260.0); }`,
    fragmentShader: `uniform float uNight; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 2.2) * 0.62 * vA * uNight; if (a < 0.004) discard; gl_FragColor = vec4(1.0, 0.8, 0.5, a); }`,
  });
  const halos = points(lampList.length / 3, (i, p, r) => {
    const v = b2t([lampList[i * 3], lampList[i * 3 + 1], lampList[i * 3 + 2]]);
    p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z; r[i] = Math.random();
  }, [['position', 3], ['aRnd', 1]], haloMat);
  ext.add(halos);

  // petals drifting down along the path
  const petalShader = (range, extra) => new ShaderMaterial({
    uniforms: { uTime: time, uSize: { value: 1 } }, transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 aRnd; uniform float uTime; uniform float uSize; varying float vR; varying float vA; varying float vTint;
      void main(){ vec3 p = position; ${extra}
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vTint = aRnd.z;
        gl_PointSize = uSize * (${range}) / -mv.z; }`,
    fragmentShader: `varying float vR; varying float vA; varying float vTint; void main(){ vec2 q = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR);
        q = vec2(q.x * c - q.y * s, q.x * s + q.y * c); float d = length(q * vec2(1.0, 1.9));
        float a = smoothstep(0.5, 0.36, d) * vA; if (a < 0.02) discard;
        gl_FragColor = vec4(mix(vec3(0.985, 0.80, 0.85), vec3(0.99, 0.88, 0.9), vTint), a * 0.92); }`,
  });
  const petMat = petalShader('60.0 + aRnd.x * 50.0', `float t = uTime * (0.35 + aRnd.x * 0.3);
        p.y = mod(p.y - t, 9.0) + 0.2; p.x += sin(t * 1.7 + aRnd.x * 30.0) * 0.7; p.z += cos(t * 1.3 + aRnd.x * 17.0) * 0.5;
        vR = aRnd.x * 6.2832 + t * 2.0; vA = 1.0;`);
  const rnd3 = (i, r) => { r[i * 3] = Math.random(); r[i * 3 + 1] = Math.random(); r[i * 3 + 2] = Math.random(); };
  ext.add(points(Math.round((mobile ? 130 : 240) * preset.particles), (i, p, r) => {
    p[i * 3] = (Math.random() - 0.5) * 30; p[i * 3 + 1] = Math.random() * 9; p[i * 3 + 2] = -1 + Math.random() * 64;
    rnd3(i, r);
  }, [['position', 3], ['aRnd', 3]], petMat));

  // moving parts
  const flagGeo = node('W_Flag_0')?.geometry || null;
  const flagBase = flagGeo ? flagGeo.attributes.position.array.slice() : null;
  // Butterflies fly long, loose loops: centre + (ax sin a, az cos 1.3a, ay cos 0.7a). Each loop
  // was tested in Blender against the trees, the castle and the camera's way (exterior.py).
  const butterflies = [];
  for (let i = 0; i < 64; i++) {
    const root = node(`W_Butterfly_${i}`);
    if (!root) break;
    const wings = ['WingL', 'WingR'].map((w) => {
      const m = node(`W_Butterfly_${i}_${w}`);
      const q = m.quaternion.clone();
      const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
      const s = Math.sqrt(1 - q.w * q.w) || 1;
      return { m, axis: new Vector3(q.x / s, q.y / s, q.z / s).multiplyScalar(q.w < 0 ? -1 : 1), ang };
    });
    const [ax, ay, az, sp, ph] = root.userData.fly || [1.3, 0.6, 0.4, 0.4, i * 1.9];
    butterflies.push({ root, wings, base: root.position.clone(), q0: root.quaternion.clone(), ax, ay, az, sp, ph });
  }
  const clouds = [0, 1, 2, 3].map((i) => node(`W_Cloud_${i}`)).filter(Boolean).map((m, i) => ({ m, base: m.position.clone(), ph: i * 2.3 }));

  // ---------------------------------------------------------------- hall (light baked into the vertices)
  const hall = new Scene();
  hall.background = new Color('#F1E0CB');
  hall.add(hallGltf.scene);
  const baked = new MeshBasicMaterial({ vertexColors: true });
  const bakedLeaves = new MeshBasicMaterial({ vertexColors: true, side: 2 });       // bouquets: leaves show from both sides
  const hallGlow = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  // Balloons: baked colour plus a live glint on every facet, and a slow sway of the whole column.
  const balloons = new MeshPhongMaterial({ vertexColors: true, color: 0x000000, shininess: 46, specular: 0x6a5a58 });
  balloons.onBeforeCompile = (s) => {
    s.uniforms.uTime = time;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.x += sin(uTime * 0.8 + position.y * 0.32) * 0.035;
      transformed.z += cos(uTime * 0.62 + position.y * 0.27) * 0.022;`);
    s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance = vColor.rgb;');
  };
  // Floor: baked light, tile joints drawn with exact anti-aliasing, and (medium/high) a soft mirror image.
  const mirror = preset.reflection > 0 ? new WebGLRenderTarget(4, 4, { depthBuffer: true }) : null;
  if (mirror) mirror.texture.colorSpace = SRGBColorSpace;
  const floorMat = new ShaderMaterial({
    vertexColors: true,
    defines: mirror ? { MIRROR: 1 } : {},
    uniforms: { tMirror: { value: mirror ? mirror.texture : null }, uMirror: { value: new Matrix4() }, uEye: { value: new Vector3() }, uTexel: { value: 1 / 512 } },
    vertexShader: `varying vec3 vCol; varying vec3 vWorld; varying vec4 vMirror; uniform mat4 uMirror;
      void main(){ vCol = color.rgb; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vMirror = uMirror * w;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vCol; varying vec3 vWorld; varying vec4 vMirror; uniform sampler2D tMirror; uniform vec3 uEye; uniform float uTexel;
      void main(){
        vec2 cell = vWorld.xz / 1.6;
        vec2 g = abs(fract(cell - 0.5) - 0.5) * 1.6;            // distance to the nearest joint, in metres
        vec2 fw = fwidth(vWorld.xz) * 0.75 + 0.0001;
        vec2 ln = 1.0 - smoothstep(vec2(0.018) - fw, vec2(0.018) + fw, g);
        float joint = max(ln.x, ln.y) * clamp(0.03 / max(fw.x, fw.y), 0.0, 1.0);   // fades out before it can shimmer
        vec3 col = vCol * (1.0 - 0.13 * joint);
        #ifdef MIRROR
          vec3 v = normalize(uEye - vWorld);
          float k = mix(0.16, 0.5, pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0)) * (1.0 - 0.5 * joint);
          vec2 uv = vMirror.xy / vMirror.w;
          vec3 r = texture2D(tMirror, uv).rgb * 0.34 + texture2D(tMirror, uv + vec2(0.0, uTexel * 2.2)).rgb * 0.2 + texture2D(tMirror, uv - vec2(0.0, uTexel * 2.2)).rgb * 0.2
                 + texture2D(tMirror, uv + vec2(uTexel * 1.6, 0.0)).rgb * 0.13 + texture2D(tMirror, uv - vec2(uTexel * 1.6, 0.0)).rgb * 0.13;
          col = mix(col, r, k);
        #endif
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  disposables.push(baked, bakedLeaves, hallGlow, balloons, floorMat);
  let floor = null;
  hallGltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const isGlow = o.material?.name === 'GLOW';
    if (/^W_Floor/.test(o.name)) { o.material = floorMat; floor = o; }
    else {
      const nome = `${o.name} ${o.parent?.name || ''}`;
      o.material = isGlow ? hallGlow : /W_Balloons/.test(nome) ? balloons : /W_HallFlowers/.test(nome) ? bakedLeaves : baked;
    }
    disposables.push(o.geometry);
  });
  const glint = new DirectionalLight(0xfff2e2, 2.2);      // only the balloons are lit live
  glint.position.set(-6, 16, 20);
  hall.add(glint);

  // petals falling through the hall: some drift left, some right, each at its own pace
  const hallPetMat = petalShader('130.0 + aRnd.x * 110.0', `float fall = 0.42 + aRnd.x * 0.75;
        float side = (aRnd.y < 0.5 ? -1.0 : 1.0) * (0.22 + aRnd.z * 0.6);
        float t = uTime;
        p.y = mod(p.y - t * fall, 12.0) - 0.4;
        p.x = mod(p.x + t * side + sin(t * (0.5 + aRnd.z * 0.5) + aRnd.x * 40.0) * 0.45 + 22.0, 44.0) - 22.0;
        p.z += cos(t * (0.4 + aRnd.y * 0.4) + aRnd.z * 25.0) * 0.4;
        vR = aRnd.y * 6.2832 + t * (0.9 + aRnd.x * 1.3) * (aRnd.y < 0.5 ? -1.0 : 1.0);
        vA = smoothstep(-0.4, 0.5, p.y) * smoothstep(11.6, 10.2, p.y) * smoothstep(22.0, 19.5, abs(p.x));`);
  hall.add(points(Math.round(120 * preset.particles), (i, p, r) => {
    p[i * 3] = (Math.random() - 0.5) * 44; p[i * 3 + 1] = Math.random() * 12; p[i * 3 + 2] = -5.5 + Math.random() * 13;
    rnd3(i, r);
  }, [['position', 3], ['aRnd', 3]], hallPetMat));

  // ---------------------------------------------------------------- day and night
  // `phase` is where the wheel stands (0 = day, 0.5 = night); it only ever turns forward, towards
  // `goal`. Everything the hour changes is set from it: sky, haze, light, lanterns, stars.
  const cA = new Color(), cB = new Color();
  const mix = (a, b, t) => cA.set(a).lerp(cB.set(b), t);
  let phase = wrap(skyAtStart), goal = phase, turning = 0, topSpeed = TURN.speed, nightNow = 0, painted = -1;
  function paint() {
    painted = phase;
    const n = nightNow = nightOf(phase), tw = twilightOf(phase), S = SKY[tw], L = LIGHT[tw];
    skyMat.uniforms.uTop.value.copy(through([SKY.day.top, S.top, SKY.night.top], n, mix));
    skyMat.uniforms.uBottom.value.copy(through([SKY.day.bottom, S.bottom, SKY.night.bottom], n, mix));
    ext.fog.color.copy(skyMat.uniforms.uBottom.value);
    hemi.color.copy(through([LIGHT.day.hemiSky, L.hemiSky, LIGHT.night.hemiSky], n, mix));
    hemi.groundColor.copy(through([LIGHT.day.hemiGround, L.hemiGround, LIGHT.night.hemiGround], n, mix));
    hemi.intensity = through([LIGHT.day.hemi, L.hemi, LIGHT.night.hemi], n, lerp);
    sun.color.copy(through([LIGHT.day.sun, L.sun, LIGHT.night.sun], n, mix));
    sun.intensity = through([LIGHT.day.sunI, L.sunI, LIGHT.night.sunI], n, lerp);
    const lamps = smooth(span(n, [0.2, 0.85])), dark = smooth(span(n, [0.4, 1]));   // lanterns come on at dusk; stars wait for the dark
    lampGain.value.setRGB(1.0, 0.7, 0.4).multiplyScalar(1.1 * lamps);
    lampGlass.color.setRGB(lerp(0.9, 1.35, lamps), lerp(0.88, 1.2, lamps), lerp(0.82, 0.92, lamps));
    starMat.uniforms.uNight.value = dark;
    haloMat.uniforms.uNight.value = lamps;
    sparkMat.uniforms.uGain.value = lerp(0.85, 1, n);
    stars.visible = dark > 0.01;
    halos.visible = lamps > 0.01;
  }
  // Turn the wheel to a phase: smoothly (the sun or the moon leaves to the left as the other one
  // rises on the right), or at once.
  function setSky(target, instant = false) {
    target = wrap(target);
    if (instant) { phase = goal = target; turning = 0; paint(); return; }
    let ahead = wrap(target - wrap(phase));
    if (ahead > 0.9995) ahead = 0;                  // already there, give or take rounding
    goal = phase + ahead;
    topSpeed = Math.max(TURN.speed, ahead / 3.2);   // a long way round still takes only a few seconds
  }
  function turn(dt) {
    if (phase === goal || dt <= 0) return;
    // critically damped, with a top speed: picks up gently, turns evenly, settles softly
    const omega = 2 / TURN.time, x = omega * dt, decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const gap = clamp(phase - goal, -topSpeed * TURN.time, topSpeed * TURN.time), aim = phase - gap;
    const push = (turning + omega * gap) * dt;
    turning = (turning - omega * push) * decay;
    phase = aim + (gap + push) * decay;
    if (goal - phase < 0.0003) {
      phase = goal = wrap(goal);
      turning = 0;
    }
  }
  paint();

  // ---------------------------------------------------------------- camera
  const cam = new PerspectiveCamera(30, 1.5, 0.3, 400);
  const mirrorCam = new PerspectiveCamera();
  const posCurve = new CatmullRomCurve3(KEYS.map((k) => b2t(k.pos)), false, 'centripetal');
  const tgtCurve = new CatmullRomCurve3(KEYS.map((k) => b2t(k.tgt)), false, 'centripetal');
  // distance walked at each key, and a smooth scroll -> distance curve through them: the camera
  // eases into the wait at the gates instead of changing pace at every key
  const walked = [0];
  {
    const N = KEYS.length - 1, a = new Vector3(), b = new Vector3();
    for (let i = 0; i < N; i++) {
      let len = 0;
      posCurve.getPoint(i / N, a);
      for (let j = 1; j <= 24; j++) { posCurve.getPoint((i + j / 24) / N, b); len += a.distanceTo(b); a.copy(b); }
      walked.push(walked[i] + len);
    }
  }
  const walkAt = monotone(KEYS.map((k) => k.p), walked);
  const hallFrom = { pos: b2t(HALL.from.pos), tgt: b2t(HALL.from.tgt) }, hallTo = { pos: b2t(HALL.to.pos), tgt: b2t(HALL.to.tgt) };
  const pos = new Vector3(), tgt = new Vector3(), right = new Vector3(), up = new Vector3(), fwd = new Vector3();
  const tilt = { x: 0, y: 0 };
  let aspect = 1.5, gateOpen = -1, w = 0, h = 0, wasHall = null, disposed = false;
  const qTmp = new Quaternion(), qYaw = new Quaternion(), UP = new Vector3(0, 1, 0);
  const bias = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

  function resize(force) {
    const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
    if (!force && cw === w && ch === h) return;
    w = cw; h = ch;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    aspect = w / h;
    cam.aspect = aspect;
    const px = renderer.getPixelRatio() * Math.min(1.6, Math.max(0.8, h / 800));
    sparkMat.uniforms.uSize.value = starMat.uniforms.uSize.value = haloMat.uniforms.uSize.value = px;
    petMat.uniforms.uSize.value = hallPetMat.uniforms.uSize.value = px * (h / 800);
    if (mirror) {
      const mw = Math.max(64, Math.round(w * renderer.getPixelRatio() * preset.reflection)), mh = Math.max(64, Math.round(h * renderer.getPixelRatio() * preset.reflection));
      mirror.setSize(mw, mh);
      floorMat.uniforms.uTexel.value = 1 / mh;
    }
  }

  function shootingStar(dt) {
    if (nightNow < 0.6) { meteor.visible = false; return; }
    if (!meteor.visible) {
      shot.wait -= dt;
      if (shot.wait > 0) return;
      // starts somewhere in the sky ahead of the camera and falls across it, to the left or to the right
      const side = Math.random() < 0.5 ? -1 : 1;
      fwd.subVectors(tgt, pos).normalize();
      shot.from.copy(pos).addScaledVector(fwd, 210).add(up.set((Math.random() - 0.5) * 150 - side * 30, 55 + Math.random() * 60, 0));
      shot.from.y = Math.max(shot.from.y, 45);
      shot.dir.set(side * (0.75 + Math.random() * 0.2), -(0.3 + Math.random() * 0.3), 0).normalize();
      shot.dur = 0.9 + Math.random() * 0.5;
      shot.len = 20 + Math.random() * 14;
      shot.t = 0;
      meteor.visible = true;
      meteor.rotation.set(0, 0, Math.atan2(shot.dir.y, shot.dir.x));
    }
    shot.t += dt;
    const f = shot.t / shot.dur;
    if (f >= 1) { meteor.visible = false; shot.wait = 5 + Math.random() * 9; return; }
    const grow = Math.min(1, f * 4), lenNow = shot.len * grow;
    // the plane's +x end is the head; it travels 85 m over its life
    meteor.position.copy(shot.from).addScaledVector(shot.dir, f * 85 - lenNow / 2);
    meteor.scale.set(lenNow, 0.55, 1);
    meteorMat.uniforms.uAlpha.value = Math.sin(Math.PI * Math.min(1, f * 1.15)) * nightNow;
  }

  // Where the sun and the moon stand, seen from the walk (before the guest looks around): fwd, right
  // and up are the camera's own axes there, and positions are tangents off its line of sight.
  // Their wheel is an ellipse behind the land, centred under the castle: the one in the sky rests up
  // on the right, a turn carries it over the towers and down on the left while the other one comes
  // up on the right. High above the garden the camera looks down, and the sky leans with it so the
  // resting place stays in the picture.
  function aimBodies(tanH) {
    const tv = Math.tan((cam.fov * Math.PI) / 360), th = tv * aspect, r = BODY * tanH;
    const ahead = restDir.dot(fwd);
    const ax = clamp(restDir.dot(right) / ahead, -0.72 * th, 0.72 * th), ay = Math.min(restDir.dot(up) / ahead, 0.74 * tv);
    bodyFar = lerp(ext.fog.near, ext.fog.far, 0.65);   // behind all that is still solid, in front of what is mostly haze
    const ground = Math.tan(-Math.asin(Math.min(0.9, pos.y / bodyFar)) - Math.asin(fwd.y));   // where the land ends, at that distance
    const cy = ground + 0.3 * (ay - ground), dy = ay - cy, top = 0.9 * tv - 1.3 * r;
    // a circle where it fits under the top of the picture, flatter where it does not
    const flat = clamp(Math.sqrt(Math.max(0, (top - cy) ** 2 - dy * dy)) / Math.max(1e-3, Math.abs(ax)), 0.12, 1);
    const A = Math.hypot(ax, dy / flat), B = flat * A, rest = Math.atan2(ax / A, dy / B), high = Math.cos(rest);
    // Half a turn of the wheel for half a turn of the sky, but not evenly: at twilight (a quarter turn)
    // one is setting on the left just as the other rises on the right, wherever the resting place is.
    const half = phase * 2, u = half - Math.floor(half);
    const turned = (Math.floor(half) + u) * Math.PI + clamp(rest, 0, 0.9) * Math.sin(Math.PI * u) ** 2;
    for (const b of bodies) {
      const a = rest - turned - b.lag * 2 * Math.PI, c = Math.cos(a);
      const show = smooth(span(c, [-0.32, Math.min(0.06, 0.5 * high)]));   // fades into the haze below the wheel's own horizon
      b.root.visible = show > 0.004;
      if (!b.root.visible) continue;
      b.x = A * Math.sin(a); b.y = cy + B * c;
      b.dir.copy(fwd).addScaledVector(right, b.x).addScaledVector(up, b.y).normalize();
      b.root.scale.setScalar(bodyFar * r);
      b.uniforms.uAlpha.value = show;
      b.uniforms.uLow.value = 1 - smooth(span(c, [0.05, 0.9 * high]));
    }
  }

  function frame(p, dt, tiltTarget, page = 0) {
    if (disposed) return p >= SWAP;
    resize();
    time.value += dt;
    const t = time.value;
    turn(dt);
    if (phase !== painted) paint();
    const e = 1 - Math.exp(-dt * 3.5);
    tilt.x += ((tiltTarget?.x || 0) - tilt.x) * e;
    tilt.y += ((tiltTarget?.y || 0) - tilt.y) * e;

    const inHall = p >= SWAP;
    let tanH, k;
    if (!inHall) {
      const d = walkAt(p);
      let i = 0;
      while (i < KEYS.length - 2 && d > walked[i + 1]) i++;
      const a = KEYS[i], b = KEYS[i + 1];
      const f = Math.min(1, Math.max(0, (d - walked[i]) / (walked[i + 1] - walked[i])));
      const u = (i + f) / (KEYS.length - 1);
      posCurve.getPoint(u, pos);
      tgtCurve.getPoint(u, tgt);
      tanH = lerp(lensTan(a.lens), lensTan(b.lens), f);
      k = lerp(a.k, b.k, f);
      pos.y += lerp(a.rise || 0, b.rise || 0, f) * Math.min(1, Math.max(0, (1.25 - aspect) / 0.65));
      ext.fog.near = lerp(a.fog[0], b.fog[0], f);
      ext.fog.far = lerp(a.fog[1], b.fog[1], f);
    } else {
      const f = smooth(span(p, [SWAP, 1]));
      pos.lerpVectors(hallFrom.pos, hallTo.pos, f);
      tgt.lerpVectors(hallFrom.tgt, hallTo.tgt, f);
      // once the letter is open the page scrolls on, and the hall drifts with it: a slow move in and up
      const g = smooth(Math.min(1, Math.max(0, page)));
      pos.z -= 2.4 * g; pos.y += 0.9 * g; tgt.y += 2.0 * g;
      tanH = lensTan(HALL.lens);
      k = HALL.k;
    }
    if (inHall !== wasHall) {            // each scene has its own depth range (finer depth where it is small)
      wasHall = inHall;
      cam.near = inHall ? 2 : 0.3;
      cam.far = inHall ? 140 : 400;
    }
    cam.fov = fovFor(tanH, k, aspect);
    cam.updateProjectionMatrix();

    // look-around: slide the camera sideways/up and keep it aimed at the same point
    fwd.subVectors(tgt, pos);
    const dist = fwd.length();
    fwd.normalize();
    right.crossVectors(fwd, up.set(0, 1, 0)).normalize();
    up.crossVectors(right, fwd);
    if (!inHall) aimBodies(tanH);
    const amp = dist * (inHall ? 0.03 : 0.045);
    pos.addScaledVector(right, tilt.x * amp).addScaledVector(up, -tilt.y * amp * 0.6);
    cam.position.copy(pos);
    cam.lookAt(tgt);

    if (!inHall) {
      const g = smooth(span(p, GATE));
      if (Math.abs(g - gateOpen) > 0.002) {
        gateOpen = g;
        if (gateL) gateL.rotation.y = g * GATE_ANGLE;
        if (gateR) gateR.rotation.y = -g * GATE_ANGLE;
        gateGlow.intensity = g * 16;
        renderer.shadowMap.needsUpdate = shadows;
      }
      for (const b of butterflies) {
        const a = t * b.sp + b.ph;
        b.root.position.set(b.base.x + Math.sin(a) * b.ax, b.base.y + Math.cos(a * 1.3) * b.az, b.base.z - Math.cos(a * 0.7) * b.ay);
        // turn into the direction of flight (sideways speed), a little nose-up when climbing
        const yaw = -Math.cos(a) * 0.75, climb = -Math.sin(a * 1.3) * 0.22;
        b.root.quaternion.copy(qYaw.setFromAxisAngle(UP, yaw)).multiply(b.q0).multiply(qTmp.setFromAxisAngle(right.set(1, 0, 0), climb));
        const flap = 0.2 + 1.15 * Math.abs(Math.sin(t * 7 + b.ph));
        for (const wg of b.wings) wg.m.quaternion.copy(qTmp.setFromAxisAngle(wg.axis, wg.ang * flap));
      }
      for (const c of clouds) c.m.position.x = c.base.x + Math.sin(t * 0.06 + c.ph) * 1.4;
      if (flagGeo) {
        const a = flagGeo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) a[i + 2] = flagBase[i + 2] + Math.sin(flagBase[i] * 4.5 - t * 6) * 0.1 * flagBase[i];
        flagGeo.attributes.position.needsUpdate = true;
        flagGeo.computeVertexNormals();
      }
      glow.color.setScalar((0.95 + 0.05 * Math.sin(t * 2.3)) * lerp(1, 1.22, nightNow));
      shootingStar(dt);
      for (const b of bodies) {
        if (!b.root.visible) continue;
        // looking around: they drift a little with the far clouds, but never as far as out of the picture
        b.dir.lerp(fwd.set(b.x, b.y, -1).normalize().applyQuaternion(cam.quaternion), 0.6).normalize();
        b.root.position.copy(cam.position).addScaledVector(b.dir, bodyFar);
        b.halo.quaternion.copy(cam.quaternion);
        b.ball.rotation.y += dt * 0.07;
      }
      skyMat.uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
      renderer.render(ext, cam);
    } else {
      hallGlow.color.setScalar(0.97 + 0.03 * Math.sin(t * 2.3));
      if (mirror && floor) {
        // the hall once more, seen from below the floor, into a small texture the floor then shows
        mirrorCam.copy(cam, false);
        mirrorCam.position.set(pos.x, -pos.y, pos.z);
        mirrorCam.up.set(0, -1, 0);
        mirrorCam.lookAt(tgt.x, -tgt.y, tgt.z);
        mirrorCam.updateMatrixWorld();
        floorMat.uniforms.uMirror.value.copy(bias).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
        floorMat.uniforms.uEye.value.copy(pos);
        floor.visible = false;
        renderer.setRenderTarget(mirror);
        renderer.render(hall, mirrorCam);
        renderer.setRenderTarget(null);
        floor.visible = true;
      }
      renderer.render(hall, cam);
    }
    return inHall;
  }

  // Compile shaders, draw the first shadow map and send both scenes to the GPU before the loader
  // lifts: the hall is drawn once here, so walking into it later costs no long frame.
  renderer.shadowMap.needsUpdate = shadows;
  resize(true);
  frame(0, 0.016, null);
  frame(1, 0, null);
  frame(0, 0, null);

  return {
    frame, renderer, setSky,
    get phase() { return wrap(phase); },
    setScale(s) { if (s !== scale) { scale = s; resize(true); } },
    dispose() {
      disposed = true;
      for (const d of disposables) d.dispose?.();
      mirror?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
