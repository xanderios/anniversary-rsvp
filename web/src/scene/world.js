// The 3D world: garden + castle (exterior) and the party hall (interior), both exported
// from Blender with colour and soft occlusion baked into vertex colours.
import {
  AdditiveBlending, BufferGeometry, CatmullRomCurve3, DirectionalLight, Float32BufferAttribute, Fog, HemisphereLight,
  Matrix4, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, PCFShadowMap, PerspectiveCamera, PointLight, Points,
  Quaternion, Scene, ShaderMaterial, Vector3, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GATE, GATE_ANGLE, HALL, KEYS, SWAP, fovFor, lensTan, monotone, smooth, span } from './journey.js';
import gardenUrl from '../models/garden.glb?url';
import hallUrl from '../models/hall.glb?url';

const b2t = ([x, y, z]) => new Vector3(x, z, -y); // Blender (Z up) -> three (Y up)
const lerp = (a, b, t) => a + (b - a) * t;

export async function createWorld(canvas, onProgress) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const mobile = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  // ---------------------------------------------------------------- load
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const sizes = { garden: 5.7e6, hall: 1.38e6 }, got = { garden: 0, hall: 0 };
  const report = () => onProgress?.(Math.min(1, (got.garden + got.hall) / (sizes.garden + sizes.hall)));
  const urls = { garden: gardenUrl, hall: hallUrl };
  const load = (name) => loader.loadAsync(urls[name], (e) => {
    if (e.total) sizes[name] = e.total;
    got[name] = e.loaded;
    report();
  });
  const [garden, hallGltf] = await Promise.all([load('garden'), load('hall')]);

  // ---------------------------------------------------------------- materials
  const time = { value: 0 };
  const lit = new MeshLambertMaterial({ vertexColors: true });
  const glow = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const twoSided = new MeshLambertMaterial({ vertexColors: true, side: 2 });

  const flowers = new MeshLambertMaterial({ vertexColors: true, side: 2 });
  flowers.onBeforeCompile = (s) => {
    s.uniforms.uTime = time;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = uv.y * 6.2832 + position.x * 0.35 + position.z * 0.27;
      float w = uv.x * uv.x * 0.055;
      transformed.x += sin(uTime * 1.5 + ph) * w;
      transformed.z += cos(uTime * 1.1 + ph * 1.3) * w * 0.7;`);
  };
  const balloons = new MeshPhongMaterial({ vertexColors: true, shininess: 55, specular: 0x4a3a3a });
  balloons.onBeforeCompile = (s) => {
    s.uniforms.uTime = time;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float bob = sin(uTime * 0.9 + position.y * 0.8 + position.x * 0.5);
      transformed.x += bob * 0.05;
      transformed.y += cos(uTime * 0.7 + position.y * 0.6) * 0.035;`);
  };

  function dress(root, rules) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const rule = rules.find(([re]) => re.test(o.name) || re.test(o.parent?.name || '')) || [null, {}];
      const r = rule[1];
      const isGlow = o.material?.name === 'GLOW';
      o.material = isGlow ? glow : r.mat || lit;
      o.castShadow = !isGlow && !!r.cast;
      o.receiveShadow = !isGlow && !!r.recv;
      o.frustumCulled = r.cull !== false;
    });
  }

  // ---------------------------------------------------------------- exterior
  const ext = new Scene();
  // Far land melts into the sky, so the garden has no edge. The colour sits between the two
  // ends of the page's sky gradient (see #sky in app.css).
  ext.fog = new Fog(0xfbdae0, KEYS[0].fog[0], KEYS[0].fog[1]);
  ext.add(garden.scene);
  dress(garden.scene, [
    [/^W_Ground/, { recv: true }],
    [/^W_Castle/, { cast: true, recv: true }],
    [/^W_Gate/, { cast: true, recv: true }],
    [/^W_Trees/, { cast: true, recv: true }],
    [/^W_Flowers/, { mat: flowers, cast: true, cull: false }],
    [/^W_Flag/, { mat: twoSided }],
    [/^W_Butterfly/, { mat: twoSided }],
    [/^W_Cloud/, {}],
  ]);
  const node = (n) => garden.scene.getObjectByName(n);
  const gateL = node('W_Gate_L'), gateR = node('W_Gate_R');

  ext.add(new HemisphereLight(0xfff4f2, 0xf6ddd6, 2.35));
  const sun = new DirectionalLight(0xfff1e4, 1.5);
  const sunDir = new Vector3(-0.42, 0.71, 0.57).normalize();
  // One still shadow map over the castle garden and the whole walk (x, height, depth in metres).
  const lit0 = new Vector3(-34, -0.5, -13), lit1 = new Vector3(34, 15.5, 67);
  const mid = lit0.clone().add(lit1).multiplyScalar(0.5);
  sun.position.copy(mid).addScaledVector(sunDir, 120);
  sun.target.position.copy(mid);
  sun.castShadow = true;
  {
    const view = new Matrix4().lookAt(sun.position, mid, new Vector3(0, 1, 0)).setPosition(sun.position).invert();
    const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity), c = new Vector3();
    for (let i = 0; i < 8; i++) {
      c.set(i & 1 ? lit1.x : lit0.x, i & 2 ? lit1.y : lit0.y, i & 4 ? lit1.z : lit0.z).applyMatrix4(view);
      lo.min(c); hi.max(c);
    }
    const sc = sun.shadow.camera;
    sc.left = lo.x; sc.right = hi.x; sc.bottom = lo.y; sc.top = hi.y; sc.near = -hi.z - 2; sc.far = -lo.z + 2;
    const cap = renderer.capabilities.maxTextureSize, big = Math.min(cap, mobile ? 2048 : 4096);
    const w = hi.x - lo.x, h = hi.y - lo.y;
    sun.shadow.mapSize.set(w > h ? big : big / 2, h >= w ? big : big / 2);
    if (Math.max(w, h) / Math.min(w, h) < 1.5) sun.shadow.mapSize.set(big, big);
  }
  sun.shadow.radius = mobile ? 4 : 7;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  ext.add(sun, sun.target);
  const gateGlow = new PointLight(0xffe2b8, 0, 9, 1.8);
  gateGlow.position.copy(b2t([0.6, 1.2, 1.9]));
  ext.add(gateGlow);

  // sparkles in the sky
  const SPARK = 90, sp = new Float32Array(SPARK * 3), sr = new Float32Array(SPARK);
  for (let i = 0; i < SPARK; i++) {
    sp[i * 3] = (Math.random() - 0.5) * 90; sp[i * 3 + 1] = 2 + Math.random() * 34; sp[i * 3 + 2] = -14 - Math.random() * 10;
    sr[i] = Math.random();
  }
  const sparkGeo = new BufferGeometry();
  sparkGeo.setAttribute('position', new Float32BufferAttribute(sp, 3));
  sparkGeo.setAttribute('aRnd', new Float32BufferAttribute(sr, 1));
  const sparkMat = new ShaderMaterial({
    uniforms: { uTime: time, uSize: { value: 1 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: `attribute float aRnd; uniform float uTime; uniform float uSize; varying float vA;
      void main(){ vA = 0.35 + 0.65 * abs(sin(uTime * (0.6 + aRnd) + aRnd * 40.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * (5.0 + aRnd * 9.0) * vA; }`,
    fragmentShader: `varying float vA; void main(){ vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
        float star = max(0.0, 1.0 - (p.x * p.y * 14.0 + p.x + p.y)); gl_FragColor = vec4(1.0, 0.97, 0.88, star * vA); }`,
  });
  ext.add(new Points(sparkGeo, sparkMat));

  // petals drifting down along the path
  const PET = mobile ? 130 : 240, pp = new Float32Array(PET * 3), pr = new Float32Array(PET);
  for (let i = 0; i < PET; i++) {
    pp[i * 3] = (Math.random() - 0.5) * 30; pp[i * 3 + 1] = Math.random() * 9; pp[i * 3 + 2] = -1 + Math.random() * 64;
    pr[i] = Math.random();
  }
  const petGeo = new BufferGeometry();
  petGeo.setAttribute('position', new Float32BufferAttribute(pp, 3));
  petGeo.setAttribute('aRnd', new Float32BufferAttribute(pr, 1));
  const petMat = new ShaderMaterial({
    uniforms: { uTime: time, uSize: { value: 1 } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float aRnd; uniform float uTime; uniform float uSize; varying float vR;
      void main(){ vec3 p = position; float t = uTime * (0.35 + aRnd * 0.3);
        p.y = mod(p.y - t, 9.0) + 0.2; p.x += sin(t * 1.7 + aRnd * 30.0) * 0.7; p.z += cos(t * 1.3 + aRnd * 17.0) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vR = aRnd * 6.2832 + t * 2.0;
        gl_PointSize = uSize * (60.0 + aRnd * 50.0) / -mv.z; }`,
    fragmentShader: `varying float vR; void main(){ vec2 q = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR);
        q = vec2(q.x * c - q.y * s, q.x * s + q.y * c); float d = length(q * vec2(1.0, 1.9));
        float a = smoothstep(0.5, 0.36, d); if (a < 0.02) discard; gl_FragColor = vec4(0.985, 0.80, 0.85, a * 0.92); }`,
  });
  const petals = new Points(petGeo, petMat);
  petals.frustumCulled = false;
  ext.add(petals);

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

  // ---------------------------------------------------------------- hall
  const hall = new Scene();
  hall.add(hallGltf.scene);
  dress(hallGltf.scene, [[/^W_Balloons/, { mat: balloons }], [/^W_HallFlowers/, { mat: twoSided }]]);
  hall.add(new HemisphereLight(0xfff3e8, 0xf4dccf, 2.5));
  const key = new DirectionalLight(0xfff0e0, 1.15);
  key.position.set(4, 14, 16);
  hall.add(key);
  for (const [x, z] of [[-5.5, -3.9], [5.5, -3.9], [0, -4.3]]) {
    const l = new PointLight(0xffcf8f, 26, 13, 1.7);
    l.position.set(x, 1.0, z);
    hall.add(l);
  }

  // ---------------------------------------------------------------- camera
  const cam = new PerspectiveCamera(30, 1.5, 0.3, 400);
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
  let aspect = 1.5, gateOpen = -1, w = 0, h = 0;
  const qTmp = new Quaternion(), qYaw = new Quaternion(), UP = new Vector3(0, 1, 0);

  function resize() {
    const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
    if (cw === w && ch === h) return;
    w = cw; h = ch;
    renderer.setSize(w, h, false);
    aspect = w / h;
    cam.aspect = aspect;
    const px = renderer.getPixelRatio() * Math.min(1.6, Math.max(0.8, h / 800));
    sparkMat.uniforms.uSize.value = px;
    petMat.uniforms.uSize.value = px * (h / 800);
  }

  function frame(p, dt, tiltTarget) {
    resize();
    time.value += dt;
    const t = time.value;
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
      tanH = lensTan(HALL.lens);
      k = HALL.k;
    }
    cam.fov = fovFor(tanH, k, aspect);
    cam.updateProjectionMatrix();

    // look-around: slide the camera sideways/up and keep it aimed at the same point
    fwd.subVectors(tgt, pos);
    const dist = fwd.length();
    fwd.normalize();
    right.crossVectors(fwd, up.set(0, 1, 0)).normalize();
    up.crossVectors(right, fwd);
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
        renderer.shadowMap.needsUpdate = true;
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
      glow.color.setScalar(0.95 + 0.05 * Math.sin(t * 2.3));
    } else {
      glow.color.setScalar(0.96 + 0.04 * Math.sin(t * 2.3));
    }
    renderer.render(inHall ? hall : ext, cam);
    return inHall;
  }

  // compile shaders and draw the first shadow map before the loader lifts
  renderer.shadowMap.needsUpdate = true;
  resize();
  frame(0, 0.016, null);
  renderer.compile(hall, cam);

  return { frame, renderer };
}
