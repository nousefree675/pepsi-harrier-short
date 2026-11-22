// Shot plan for the Pepsi Harrier story - timed to voice.mp3 (50.80 s, 30 fps).
// Phrase times (s): 0.28-7.38 stare at manifest | 7.62-12.18 jet in driveway | 13.12-14.83 three months |
// 15.09-20.83 bulk soda / $700 t-shirt | 21.29-27.41 small print TV ad | 28.21-34.18 dogs howl, Civic |
// 34.86-36.37 weird part | 37.03-41.44 mechanical horse | 42.02-46.55 legal team, lawn ornament | 46.74-50.43 which explains why...
export const FPS = 30, TOTAL = 1524;
export const SHOTS = [
  { id: 'hook', a: 0, b: 110, light: 'day' },
  { id: 'manifest', a: 111, b: 228, light: 'day' },
  { id: 'jetreveal', a: 229, b: 392, light: 'day' },
  { id: 'crates', a: 393, b: 520, light: 'garage' },
  { id: 'tshirt', a: 521, b: 638, light: 'garage' },
  { id: 'tv', a: 639, b: 846, light: 'tvroom' },
  { id: 'dogs', a: 847, b: 1025, light: 'day' },
  { id: 'weird', a: 1026, b: 1110, light: 'day' },
  { id: 'horse', a: 1111, b: 1260, light: 'story' },
  { id: 'legal', a: 1261, b: 1401, light: 'golden' },
  { id: 'ornament', a: 1402, b: 1523, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ramp = (f, a, b) => clamp((f - a) / (b - a));
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

// ---------- lights ----------
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#b4cdf0', ground: '#7c7a50', hemi: 1.05, sun: '#ffe9c2', sunI: 2.75, fog: '#bcd2ee', fogNear: 60, fogFar: 700,
    skyTop: '#2a68cc', skyHor: '#a8ccf0', sat: 1.3, gain: '#fff4e0', waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.26, shadowExt: 18 },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 60, fogFar: 760,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.22, gain: '#fff2e2', waterDeep: '#3d5a86', waterShal: '#d99a6e',
    glint: '#ffe2a8', vig: 0.3, shadowExt: 18 },
  dusk: { az: 20, el: 7, sky: '#a58ac0', ground: '#5a4438', hemi: 0.95, sun: '#ff9650', sunI: 2.6, fog: '#e8a07c', fogNear: 45, fogFar: 620,
    skyTop: '#59508f', skyHor: '#ffb070', sunDisc: '#ffe0a8', sunSize: 0.004, sat: 1.15, gain: '#ffe6d0', waterDeep: '#3d5a86', waterShal: '#d99a6e',
    glint: '#ffe2a8', vig: 0.3, shadowExt: 22 },
  garage: { az: 150, el: 55, sky: '#c9d2da', ground: '#7a7264', hemi: 1.12, sun: '#fff4e0', sunI: 0.9, fog: '#d8dee4', fogNear: 60, fogFar: 500,
    skyTop: '#7a8ba0', skyHor: '#d5dce2', sat: 1.15, gain: '#fff2dc', waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.34, shadowExt: 14 },
  room: { az: 150, el: 50, sky: '#aab4c8', ground: '#6a6258', hemi: 0.95, sun: '#dfe8ff', sunI: 0.7, fog: '#c2c8d4', fogNear: 50, fogFar: 420,
    skyTop: '#55648a', skyHor: '#b8c2d4', sat: 1.1, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.3, shadowExt: 12 },
  // night living room, lit mostly by the TV glow (v5's neon-lit night grammar)
  tvroom: { az: 150, el: 50, sky: '#46527a', ground: '#36323a', hemi: 0.72, sun: '#8ea4d8', sunI: 0.35, fog: '#2a3242', fogNear: 40, fogFar: 380,
    skyTop: '#141c30', skyHor: '#33405e', sat: 1.05, gain: '#ccd8f8', waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.38, shadowExt: 12 },
  // sepia storybook cutaway for the mechanical-horse analogy (visibly distinct scene)
  story: { az: 60, el: 30, sky: '#e8d9b0', ground: '#7a6248', hemi: 1.1, sun: '#ffdf9c', sunI: 2.2, fog: '#e8d3a0', fogNear: 50, fogFar: 620,
    skyTop: '#c9a86a', skyHor: '#f2e2b8', sunDisc: '#fff4d0', sunSize: 0.004, sat: 1.0, gain: '#fff4d8', waterDeep: '#6a7a5c', waterShal: '#c9b988',
    glint: '#fff0c0', vig: 0.45, shadowExt: 18 },
};
export const lightFor = (S, f) => {
  const L = { ...LIGHTS[S.light] };
  if (S.id === 'hook') L.shadowExt = lerp(10, 24, smooth(ramp(f, 10, 80)));
  if (S.id === 'tv') { L.shadowExt = 16; }
  if (S.id === 'ornament') L.shadowExt = 30;
  return L;
};

// ---------- cameras ----------
const HERO = [2.2, 0, 7.2];
const HERO_HOOK = [5.2, 0, 7.4];
// ~2s cut grammar (reference style): keyframes with cut:true are hard cuts - the camera holds the
// previous keyframe until the cut frame, then jumps. Segments without cut drift smoothly as before.
const CAMS = {
  hook: [
    { f: 0, pos: [12, 3.4, 14], look: [3, 1.5, 2], fov: 46 },
    { f: 55, pos: [10, 2.9, 12.4], look: [2.8, 1.5, 1.8], fov: 42 },
    { f: 56, pos: [8.4, 2.3, 11.2], look: [4.9, 1.5, 6.6], fov: 34, cut: true },
    { f: 110, pos: [8.2, 2.25, 10.9], look: [4.9, 1.5, 6.6], fov: 32 },
  ],
  manifest: [
    { f: 111, pos: [3.6, 2.1, 11.0], look: [2.2, 1.5, 6.8], fov: 36 },
    { f: 170, pos: [3.3, 2.05, 10.4], look: [2.2, 1.48, 6.8], fov: 34 },
    { f: 171, pos: [1.8, 2.0, 11.2], look: [2.35, 0.95, 7.4], fov: 27, cut: true },  // paper insert
    { f: 228, pos: [1.75, 1.95, 11.0], look: [2.35, 0.95, 7.4], fov: 26 },
  ],
  jetreveal: [
    { f: 229, pos: [3.0, 2.2, 12.5], look: [4.8, 1.5, 2.0], fov: 50 },
    { f: 285, pos: [3.0, 2.8, 10.8], look: [6.9, 1.3, 2.0], fov: 42 },
    { f: 286, pos: [2.0, 8.0, 16.5], look: [6.0, 1.0, 0.8], fov: 60, cut: true },   // elevated wide establishing: whole jet, hero, car, garage
    { f: 340, pos: [0.8, 3.2, 13.5], look: [5.2, 1.4, 1.5], fov: 48 },
    { f: 341, pos: [-2.5, 3.4, 17.5], look: [6.5, 1.6, 0.5], fov: 44, cut: true },  // scale wide from street (GLB jet is bulkier)
    { f: 392, pos: [0.5, 5.0, 17.5], look: [6.3, 1.6, 0.5], fov: 46 },
  ],
  crates: [
    { f: 393, pos: [-3.2, 1.7, 406.5], look: [-0.2, 1.3, 401.3], fov: 48 },
    { f: 455, pos: [-3.0, 1.68, 406.0], look: [-0.2, 1.3, 401.35], fov: 46 },
    { f: 456, pos: [1.2, 1.6, 405.0], look: [0.35, 1.25, 401.4], fov: 48, cut: true }, // front medium, margin right for the walk
    { f: 520, pos: [1.0, 1.6, 404.6], look: [0.35, 1.25, 401.4], fov: 46 },
  ],
  tshirt: [
    { f: 521, pos: [0.2, 1.8, 405.6], look: [0.6, 1.45, 401.3], fov: 34 },
    { f: 585, pos: [0.3, 1.78, 405.2], look: [0.6, 1.45, 401.3], fov: 32 },
    { f: 586, pos: [0.5, 1.65, 403.7], look: [0.6, 1.42, 401.45], fov: 24, cut: true }, // fabric insert
    { f: 638, pos: [0.5, 1.62, 403.5], look: [0.6, 1.42, 401.45], fov: 23 },
  ],
  tv: [
    { f: 639, pos: [-2.2, 1.9, -397.0], look: [0.8, 1.4, -403.8], fov: 46 },
    { f: 710, pos: [-1.4, 1.8, -398.2], look: [0.6, 1.42, -404.2], fov: 46 },
    { f: 711, pos: [0, 1.5, -399.0], look: [0, 1.4, -404.24], fov: 26, cut: true },   // TV screen insert, wide enough for the whole price line
    { f: 790, pos: [0, 1.48, -399.3], look: [0, 1.4, -404.24], fov: 25 },
    { f: 791, pos: [0.4, 1.7, -400.7], look: [1.45, 1.45, -403.2], fov: 26, cut: true }, // hero reaction
    { f: 846, pos: [0.5, 1.68, -400.9], look: [1.45, 1.45, -403.2], fov: 24 },
  ],
  dogs: [
    { f: 847, pos: [-9.5, 2.4, 11.5], look: [4.5, 1.2, 2.2], fov: 52 },
    { f: 940, pos: [-8.5, 2.2, 10.8], look: [4.5, 1.2, 2.2], fov: 50 },
    { f: 941, pos: [-10.2, 2.4, 14.6], look: [-3.6, 0.9, 7.2], fov: 50, cut: true },    // dogs closer, all three with margin
    { f: 1025, pos: [-9.8, 2.35, 14.2], look: [-3.6, 0.9, 7.2], fov: 48 },
  ],
  weird: [
    { f: 1026, pos: [3.2, 2.0, 10.2], look: [2.2, 1.65, 7.2], fov: 28 },
    { f: 1110, pos: [3.0, 1.95, 9.5], look: [2.2, 1.62, 7.2], fov: 26 },
  ],
  horse: [
    { f: 1111, pos: [2.8, 1.9, 10.8], look: [-5.8, 1.8, 2], fov: 40 },
    { f: 1185, pos: [2.0, 1.8, 9.7], look: [-5.8, 1.8, 2], fov: 38 },
    { f: 1186, pos: [1.5, 2.0, 12.0], look: [-5.5, 1.8, 1.8], fov: 40, cut: true },   // whole horse + drum in profile
    { f: 1260, pos: [1.2, 1.9, 11.4], look: [-5.5, 1.85, 1.8], fov: 38 },
  ],
  legal: [
    { f: 1261, pos: [0.2, 2.6, 13.0], look: [4.6, 1.3, 4.6], fov: 46 },
    { f: 1330, pos: [0.5, 2.4, 12.3], look: [4.65, 1.32, 4.55], fov: 44 },
    { f: 1331, pos: [3.0, 1.9, 8.9], look: [4.55, 1.0, 5.3], fov: 28, cut: true },    // fine-print insert
    { f: 1401, pos: [3.1, 1.88, 8.7], look: [4.55, 1.0, 5.3], fov: 26 },
  ],
  ornament: [
    { f: 1402, pos: [12.5, 4.2, 15.5], look: [2.5, 1.6, 0.5], fov: 46 },
    { f: 1523, pos: [15, 5.5, 19], look: [2.5, 1.5, 0], fov: 49 },
  ],
};
const KICKS = [{ f: 229, a: 0.04 }, { f: 1046, a: 0.03 }];
export const camAt = (f) => {
  const S = shotAt(f), K = CAMS[S.id];
  let c;
  if (f <= K[0].f) c = { ...K[0] };
  else if (f >= K[K.length - 1].f) c = { ...K[K.length - 1] };
  else for (let i = 0; i < K.length - 1; i++) if (f >= K[i].f && f <= K[i + 1].f) {
    const a = K[i], b = K[i + 1];
    if (b.cut) { c = { ...a }; break; } // hold the previous angle until the cut frame, then jump
    const t = smooth((f - a.f) / (b.f - a.f));
    c = { pos: lerp3(a.pos, b.pos, t), look: lerp3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll || 0, b.roll || 0, t) };
  }
  for (const k of KICKS) { const d = f - k.f; if (d >= 0 && d < 7) { const s = (d % 2 ? -1 : 1) * k.a * (1 - d / 7); c.look = [c.look[0], c.look[1] + s * 3, c.look[2] + s * 2]; c.roll = (c.roll || 0) + s * 20; } }
  // white flash on the time jumps (garage flashback, living room, return, weird-part turn)
  c.flash = (f >= 393 && f < 397) ? 0.7 * (1 - (f - 393) / 4)
    : (f >= 639 && f < 643) ? 0.7 * (1 - (f - 639) / 4)
    : (f >= 847 && f < 851) ? 0.55 * (1 - (f - 847) / 4)
    : (f >= 1111 && f < 1115) ? 0.5 * (1 - (f - 1111) / 4) : 0;
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, [4.2, 1.6, 4.0]), cinf: 6 };
    case 'manifest': return { focus: dist(C.pos, f >= 171 ? [2.32, 1.05, 7.55] : [2.2, 1.5, 7.2]), cinf: 10 };
    case 'jetreveal': return { focus: dist(C.pos, C.look), cinf: 7 };
    case 'crates': return { focus: dist(C.pos, [0, 1.2, 401.5]), cinf: 8 };
    case 'tshirt': return { focus: dist(C.pos, [0.6, 1.2, 401.45]), cinf: 9 };
    case 'tv': return { focus: dist(C.pos, f >= 711 && f <= 790 ? [0, 1.55, -404.22] : [1.45, 1.45, -403.2]), cinf: 8 };
    case 'dogs': return { focus: dist(C.pos, f >= 941 ? [-2.8, 0.9, 6.9] : [2, 1.4, 3]), cinf: 6 };
    case 'weird': return { focus: dist(C.pos, [1.4, 1.65, 6.2]), cinf: 12 };
    case 'horse': return { focus: dist(C.pos, [-5.8, 2.0, 1.9]), cinf: 8 };
    case 'legal': return { focus: dist(C.pos, f >= 1331 ? [4.5, 1.15, 5.3] : [4.8, 1.4, 4.7]), cinf: 8 };
    case 'ornament': return { focus: dist(C.pos, [3, 1.7, 0.5]), cinf: 4 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    horse: f >= 1111,                    // mechanical horse + fuel drum appear from the metaphor on
    tv: S.id === 'tv',
    hoseT: q(Math.sin(f * 0.06) * 0.5 + 0.5, 3),
  };
};

// ---------- actors (2D cards) ----------
const blinkAt = (f, seed) => { const per = 38 + (seed * 17) % 31, ph = (f + seed * 13) % per; return ph < 2 ? 0.5 : ph < 4 ? 1 : 0; };
const R = (T, who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'c' + (o.seed || 3)) + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const HERO_OUT = { tunic: '#3f7fbf', skin: '#f5c9a0', hair: '#2b211c' };
const SUIT_A = { tunic: '#333c4a', skin: '#f5c9a0', hair: '#1e1714' };
const SUIT_B = { tunic: '#4a4038', skin: '#c99067', hair: '#2b211c', stout: true };
const SUIT_C = { tunic: '#5a4a5e', skin: '#ecd0b6', hair: '#4a3020', dress: '#6a5a72' };

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = S.light === 'golden' || S.light === 'dusk' ? '#ffe2c8' : '#ffffff';
  const hero = (o, pos = HERO, extra = {}) => out.push(R(T, HERO_OUT, { seed: 3, expr: 'neutral', blink: blinkAt(f, 3), ...o }, pos, { tint, ...extra }));
  switch (S.id) {
    case 'hook': {
      hero({ expr: 'shock', L: 'cross', R: 'belly', headTilt: q(2 * Math.sin(f * 0.2), 1) }, HERO_HOOK);
      break;
    }
    case 'manifest': {
      hero({ expr: f > 190 ? 'squint' : 'shock', L: 'cross', R: 'belly', headTilt: q(-4 + 3 * Math.sin(f * 0.25), 1), look: -0.4 });
      break;
    }
    case 'jetreveal': {
      hero({ expr: 'shock', L: 'hang', R: 'point', look: 0.6, headTilt: q(-4, 1) }, [2.8, 0, 4.8]);
      break;
    }
    case 'crates': {
      // carrying a crate across the garage, left to right
      const t = ramp(f, 393, 495), x = lerp(-1.7, 0.35, t), w = q((f * 0.055) % 1, 2);
      hero({ expr: 'stubborn', L: 'belly', R: 'belly', step: w, bob: 0.02, headTilt: q(2.5, 1) }, [q(x, 2), 0, 401.6]);
      break;
    }
    case 'tshirt': {
      hero({ expr: 'grin', L: 'lift', R: 'lift', bob: f % 30 < 15 ? 0.015 : 0 }, [0.6, 0, 401.3]);
      break;
    }
    case 'tv': {
      hero({ expr: f > 790 ? 'shock' : 'squint', L: 'hip', R: 'point', look: -0.5, headTilt: q(3 * Math.sin(f * 0.3), 1) }, [1.45, 0, -403.2]);
      break;
    }
    case 'dogs': {
      hero({ expr: 'nervous', L: 'temple', R: 'hang', swirl: q((f * 0.3) % 6.283, 1), look: 0.5 }, [7.8, 0, 6.4]);
      break;
    }
    case 'weird': {
      hero({ expr: 'squint', L: 'cheek', R: 'hip', headTilt: q(5 * Math.sin(f * 0.15), 1), look: 0.4 });
      break;
    }
    case 'horse': {
      hero({ expr: 'grin', L: 'hang', R: 'point', look: -0.5 }, [-1.2, 0, 6.9]);
      break;
    }
    case 'legal': {
      hero({ expr: 'nervous', L: 'hang', R: 'hang', look: 0.6 }, [2.6, 0, 6.4]);
      const shrug = q(Math.sin(f * 0.12) * 2, 1);
      out.push(R(T, SUIT_A, { seed: 11, expr: 'neutral', L: 'cross', R: 'hang', blink: blinkAt(f, 11), headTilt: shrug }, [4.4, 0, 5.0], { tint }));
      out.push(R(T, SUIT_B, { seed: 12, expr: 'grin', L: 'belly', R: 'belly', blink: blinkAt(f, 12), bob: f % 40 < 20 ? 0.012 : 0 }, [5.4, 0, 4.5], { tint }));
      out.push(R(T, SUIT_C, { seed: 13, expr: 'smile', L: 'hang', R: 'thumb', facing: -1, blink: blinkAt(f, 13) }, [6.3, 0, 5.2], { tint }));
      break;
    }
    case 'ornament': {
      hero({ expr: 'stubborn', L: 'hip', R: 'hip', look: 0.4, headTilt: q(-3, 1) }, [6.5, 0, 8.8]);
      break;
    }
  }
  return out;
};

// ---------- 2D props & effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

// delivery manifest sheet
const paperCard = (p) => {
  p.poly([[160, 260], [440, 260], [440, 740], [160, 740]], '#f6f2e6', 12);
  p.poly([[160, 260], [440, 260], [440, 330], [160, 330]], '#d9d2c0', 8);
  p.stroke([[190, 298], [410, 298]], 7, '#5a5244');
  for (let i = 0; i < 6; i++) p.stroke([[190, 380 + i * 52], [190 + 170 + (i % 3) * 25, 380 + i * 52]], 5, '#8a8272');
  p.ell(360, 640, 62, 62, 'rgba(0,0,0,0)', 10);
  p.g.save(); p.g.fillStyle = '#b8302c'; p.g.font = 'bold 44px sans-serif'; p.g.textAlign = 'center';
  p.g.fillText('7M', 360, 655); p.g.restore();
  p.stroke([[200, 700], [280, 700], [255, 720]], 5, '#5a5244');
};
// wooden crate of soda cans
const crateCard = (p) => {
  p.poly([[90, 380], [510, 380], [510, 680], [90, 680]], '#a5763f', 14);
  p.stroke([[90, 470], [510, 470]], 10, '#7a5434');
  p.stroke([[90, 590], [510, 590]], 10, '#7a5434');
  for (let i = 0; i < 5; i++) { const x = 150 + i * 75; p.ell(x, 360, 32, 18, i % 2 ? '#c2453c' : '#3f6fb5', 6); p.poly([[x - 30, 360], [x + 30, 360], [x + 26, 395], [x - 26, 395]], i % 2 ? '#a8362e' : '#355e9e', 5); }
  p.poly([[250, 500], [350, 500], [350, 560], [250, 560]], '#e8e0cc', 6);
};
// goofy pilot t-shirt
const shirtCard = (p) => {
  const body = [[200, 320], [400, 320], [470, 400], [430, 470], [400, 440], [400, 720], [200, 720], [200, 440], [170, 470], [130, 400]];
  p.poly(body, '#f2eee2', 12);
  p.ell(300, 330, 46, 26, '#d9d2c0', 8);
  p.g.save(); p.g.fillStyle = '#8a8272'; p.g.font = 'bold 52px sans-serif'; p.g.textAlign = 'center';
  p.g.fillText('JET', 300, 500); p.g.fillText('PILOT', 300, 565); p.g.restore();
  p.ell(300, 620, 60, 34, '#c9b26a', 6);
};
// howling dog (side profile, nose to the sky, facing +x of the card)
const dogCard = (col) => (p) => {
  // seated howling dog: haunch + chest (not one round body), upraised tail, floppy ear (user read pointed-ear round body as a cat)
  p.stroke([[230, 720], [175, 660], [168, 592]], 22, col);  // tail held high
  p.dot(166, 584, 20, col);                                 // tail tuft
  p.ell(295, 690, 145, 118, col, 12);                       // haunch
  p.ell(345, 545, 92, 130, col, 12);                        // chest
  p.stroke([[385, 740], [390, 928]], 26, col);              // front leg
  p.stroke([[430, 748], [450, 928]], 26, col);              // front leg 2
  p.ell(390, 934, 34, 15, col, 6);                          // front paw
  p.ell(452, 934, 34, 15, col, 6);                          // front paw 2
  p.ell(240, 908, 58, 26, col, 8);                          // hind paw
  p.ell(300, 912, 150, 34, col, 8);                         // seated base
  p.ell(398, 458, 88, 82, col, 12);                         // head (wider than tall)
  p.poly([[352, 408], [318, 470], [326, 542], [358, 530], [374, 452]], '#241726', 8); // floppy ear hanging down
  p.poly([[420, 432], [505, 338], [536, 368], [458, 462]], col, 10); // long muzzle up
  p.dot(522, 346, 20, '#241726');                           // big nose
  p.stroke([[382, 452], [402, 447]], 6);                    // closed eye
  p.ell(500, 372, 16, 22, '#5a1e28', 5);                    // open howl mouth at the muzzle tip
  p.dot(501, 383, 8, '#c85a6a');                            // tongue
};
// briefcase held by a suit (drawn at the hanging-hand spot)
const caseCard = (col) => (p) => {
  p.poly([[140, 560], [330, 560], [330, 750], [140, 750]], col, 12);
  p.stroke([[205, 560], [205, 520], [265, 520], [265, 560]], 10, '#241726');
  p.stroke([[140, 620], [330, 620]], 7, '#24172666');
  p.dot(235, 615, 10, '#e6c068');
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' || S.id === 'manifest') {
    const hp = S.id === 'hook' ? HERO_HOOK : HERO;
    out.push(FX('paper', paperCard, [hp[0] + 0.12, 0.78, hp[2] + 0.35], 0.3, { order: 4, shadow: true, yaw: 0 }));
  }
  if (S.id === 'manifest') {
    const t = q(((f - 120) / 40) % 1, 2);
    out.push(FX('stars' + t, (p) => T.fxStars(p, t), [HERO[0] + 0.05, 2.15, HERO[2]], 0.5, { order: 6 }));
  }
  if (S.id === 'crates') {
    const t = ramp(f, 393, 495), x = lerp(-1.65, 0.4, t);
    out.push(FX('crate', crateCard, [x, 0.72, 401.6 + 0.25], 0.45, { order: 4, shadow: true }));
  }
  if (S.id === 'tshirt') {
    out.push(FX('shirt', shirtCard, [0.6, 0.88, 401.45], 0.55, { order: 4, shadow: true }));
  }
  if (S.id === 'dogs') {
    const cols = ['#8a5d3b', '#3a3230', '#c9a06a'];
    const spots = [[-2.5, 6.5, 1], [-1, 7.3, 0.85], [-4, 7.7, 0.7]];
    spots.forEach(([x, z, s], i) => {
      const bobY = (f + i * 9) % 45 < 8 ? 0.05 : 0;
      out.push(FX('dog' + i, dogCard(cols[i]), [x, bobY, z], s, { order: 4, shadow: true, blob: true, ground: 0 }));
      const nt = q(((f + i * 13) / 55) % 1, 2);
      out.push(FX('note' + i + nt, (p) => T.fxNote(p, i % 2 ? 'double' : 'single', '#31435c'), [x + 0.45, 1.9 + nt * 0.5, z], 0.5, { alpha: 1 - nt, order: 6 }));
    });
  }
  if (S.id === 'weird') {
    const t = q(((f - 1026) / 50) % 1, 2);
    out.push(FX('wstars' + t, (p) => T.fxStars(p, t), [HERO[0] - 0.4, 2.2, HERO[2]], 0.45, { order: 6 }));
  }
  if (S.id === 'legal') {
    out.push(FX('caseA', caseCard('#4a3a2c'), [4.0, 0.55, 5.4], 0.5, { order: 4, shadow: true }));
    out.push(FX('caseC', caseCard('#2e2a33'), [6.65, 0.55, 5.5], 0.5, { order: 4, shadow: true }));
    // the fine print itself, held by suit A (legible close-up insert, recipe-poster grammar)
    out.push(FX('paperL', paperCard, [4.52, 0.78, 5.35], 0.3, { order: 4, shadow: true, yaw: 0 }));
  }
  return out;
};
