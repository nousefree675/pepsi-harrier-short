import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt } from './story.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import * as BufferGeometryUtils from './lib/BufferGeometryUtils.js';

// CC0 GLB hero jet (Innerscene 'Unarmed VTOL jet', public domain): loaded up front; procedural jet stays as fallback
let glbJet = null;
try {
  const buf = await (await fetch('./lib/unarmed-vtol-jet.glb')).arrayBuffer();
  glbJet = (await new GLTFLoader().parseAsync(buf, '')).scene;
  glbJet.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // camo tint on the grey paint materials, matching the reference world's palette while keeping the PBR detail
  glbJet.traverse((o) => { if (o.isMesh && o.material && /paint/i.test(o.material.name || '')) o.material.color.set('#b9c49c').multiplyScalar(2.0); }); // camo tint x2: paint maps are very dark
  // PBR lift: the model is military-dark + metallic, which reads black under the kit's simple lights
  { const seen = new Set(); const lift = new THREE.Color('#a8b19a');
    glbJet.traverse((o) => { if (!(o.isMesh && o.material) || seen.has(o.material)) return; seen.add(o.material); const m = o.material;
      if ('metalness' in m) m.metalness = Math.min(m.metalness ?? 0, 0.25);
      if ('roughness' in m) m.roughness = Math.min(Math.max(m.roughness ?? 1, 0.55), 0.9);
      if (m.map && !/paint/i.test(m.name || '')) m.color.setRGB(1.5, 1.5, 1.45); // brighten dark military textures
      else if (m.color && (m.color.r + m.color.g + m.color.b) < 1.1) m.color.lerp(lift, 0.62); }); }
  // (warm fill lives after scene init now; a TDZ throw here was silently killing it)
} catch (e) { console.log('GLB jet init issue: ' + e.message); }

// Poly Haven shrub_01 (CC0) for real-foliage garden bushes
let shrubSrc = null;
try {
  shrubSrc = (await new GLTFLoader().loadAsync('./lib/ph/shrub_01/shrub_01_1k.gltf')).scene;
  shrubSrc.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.side = THREE.DoubleSide; if (o.material.transparent) o.material.alphaTest = Math.max(o.material.alphaTest || 0, 0.4); } } });
} catch (e) { console.log('shrub load failed: ' + e.message); }

// Innerscene CC0: red four-door sedan + street trees (real geometry, no alpha cards), replacing the rejected box car / blob canopies
let sedanSrc = null, oakM = null, lindenM = null;
const liftPBR = (root, maxMetal = 0.3) => { const seen = new Set();
  root.traverse((o) => { if (!(o.isMesh && o.material) || seen.has(o.material)) return; seen.add(o.material); const m = o.material;
    if ('metalness' in m) m.metalness = Math.min(m.metalness ?? 0, maxMetal);
    if ('roughness' in m) m.roughness = Math.min(Math.max(m.roughness ?? 1, 0.4), 0.85); }); };
try {
  const buf = await (await fetch('./lib/sedan_red.glb')).arrayBuffer();
  sedanSrc = (await new GLTFLoader().parseAsync(buf, '')).scene;
  sedanSrc.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  liftPBR(sedanSrc);
} catch (e) { console.log('sedan load failed: ' + e.message); }
const mergeTree = (scene_, brighten) => {
  scene_.updateMatrixWorld(true);
  const byMat = new Map();
  scene_.traverse((o) => { if (!o.isMesh) return; const n = (o.material && o.material.name) || 'm';
    if (!byMat.has(n)) byMat.set(n, { mat: o.material, geos: [] });
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const keep = { position: g.attributes.position, normal: g.attributes.normal };
    g.attributes = keep; if (g.attributes.normal === undefined) { g.computeVertexNormals(); }
    g.applyMatrix4(o.matrixWorld); byMat.get(n).geos.push(g); });
  const grp = new THREE.Group();
  for (const { mat, geos } of byMat.values()) {
    const merged = BufferGeometryUtils.mergeGeometries(geos, false);
    if (!merged) continue;
    for (const an of ['position', 'normal']) { const a = merged.attributes[an]; if (!a) continue; const arr = a.array; // sanitize NaN/Inf: one bad vertex blacks the whole frame once DOF samples it
      for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) arr[i] = 0; a.needsUpdate = true; }
    const m2 = mat.clone(); m2.side = THREE.DoubleSide; if (brighten && m2.name !== 'bark' && m2.color) m2.color.multiplyScalar(brighten);
    const mesh = new THREE.Mesh(merged, m2); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh); }
  const bb = new THREE.Box3().setFromObject(grp);
  console.log('TREEBB', JSON.stringify(bb));
  return { grp, h: bb.max.y - bb.min.y }; };
try {
  const lb = await (await fetch('./lib/tree_linden.glb')).arrayBuffer();
  lindenM = mergeTree((await new GLTFLoader().parseAsync(lb, '')).scene, 1.9);
} catch (e) { console.log('tree load failed: ' + e.message); }

const SCm = location.hash.match(/sc([\d.]+)/); const SC = SCm ? +SCm[1] : (location.hash.includes('half') ? 0.5 : 1); const W = Math.round(1080 * SC), H = Math.round(1920 * SC);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
// turf: Poly Haven leafy_grass base + painted blade strokes and patch variation (user: realistic grass detail)
const grassT = await (async () => {
  const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = './lib/ph/leafy_grass/Diffuse.jpg'; });
  const gc = document.createElement('canvas'); gc.width = gc.height = 1024; const gg = gc.getContext('2d');
  gg.drawImage(img, 0, 0, 1024, 1024);
  const gr = P.rng(4242);
  for (let i = 0; i < 7; i++) { // large soft patchiness
    const x = gr() * 1024, y = gr() * 1024, r = 180 + gr() * 260;
    const rg = gg.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${52 + gr() * 30 | 0},${86 + gr() * 40 | 0},${30 + gr() * 22 | 0},0.16)`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    gg.fillStyle = rg; gg.beginPath(); gg.arc(x, y, r, 0, 7); gg.fill();
  }
  for (let i = 0; i < 5200; i++) { // blade strokes
    const x = gr() * 1024, y = gr() * 1024, h = 10 + gr() * 30, w = 1.2 + gr() * 2.2;
    const gsh = 80 + gr() * 100 | 0;
    gg.strokeStyle = `rgba(${gsh * 0.55 | 0},${gsh},${34 + gr() * 46 | 0},${0.2 + gr() * 0.3})`;
    gg.lineWidth = w; gg.beginPath(); gg.moveTo(x, y); gg.quadraticCurveTo(x + (gr() - 0.5) * 6, y - h * 0.6, x + (gr() - 0.5) * 9, y - h); gg.stroke();
  }
  const t = new THREE.CanvasTexture(gc); return t;
})();
grassT.wrapS = grassT.wrapT = THREE.RepeatWrapping; grassT.repeat.set(40, 20); grassT.colorSpace = THREE.SRGBColorSpace;
const phT = async (p, rx_, ry_) => { const t = await new THREE.TextureLoader().loadAsync(p); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx_, ry_); t.colorSpace = THREE.SRGBColorSpace; return t; };
const asphT = await phT('./lib/ph/asphalt_02_diff.jpg', 45, 2);   // Poly Haven asphalt_02 (CC0): real road surface
const pavT = await phT('./lib/ph/concrete_pavement_diff.jpg', 60, 1); // Poly Haven concrete_pavement (CC0): sidewalk flags
const drvT = await phT('./lib/ph/brushed_concrete_diff.jpg', 1.5, 4.5); // Poly Haven brushed_concrete (CC0): driveway slab
const stuT = await phT('./lib/ph/white_stucco_diff.jpg', 3, 1.6);   // Poly Haven white_stucco (CC0): house/garage walls
const roofT = await phT('./lib/ph/clay_roof_tiles_diff.jpg', 3, 3);   // Poly Haven clay_roof_tiles (CC0): terracotta roof
const M = {
  grass: toon({ map: grassT, color: '#a9cc6d' }), // Poly Haven leafy_grass (CC0), brighter tint (was muddy)
  asphalt: toon({ map: asphT, color: '#9a9aa0' }),
  concrete: toon({ map: pavT, color: '#c7c5c0' }),
  drvway: toon({ map: drvT, color: '#b2b1ab' }),
  siding: toon({ map: stuT, color: '#e8ddc8' }),
  siding2: toon({ map: stuT, color: '#ded8cc' }),
  brick: texM(P.stone(35, 12, 30, 48), 3, 1.5),
  roof: toon({ map: roofT, color: '#c98a5e' }),
  plank: texM(P.planks(1), 1, 6),
  beam: texM(P.beam(2), 1, 2),
  dirt: texM(P.dirt(7), 6, 30),
  trunk: toon({ color: '#6a4a32' }), pine: toon({ color: '#4a7a34' }), bush: toon({ color: '#5c8a3c' }),
  door: toon({ color: '#7a3a2a' }), window: toon({ color: '#2b3040' }), white: toon({ color: '#f2eee4' }),
  jetBody: toon({ color: '#7d8a7a' }), jetDark: toon({ color: '#5c6659' }), canopy: toon({ color: '#2e4452' }),
  steel: toon({ color: '#b8c0c6' }), tire: toon({ color: '#26221f' }), hub: toon({ color: '#c9cfd4' }),
  carBody: toon({ color: '#b8c2c9' }), carGlass: toon({ color: '#31404e' }),
  crate: texM(P.planks(41, 0), 1, 1), drum: toon({ color: '#b8402f' }),
  couch: toon({ color: '#8a4a3c' }), wallIn: texM(P.plaster(36, 30), 2, 1), floorIn: texM(P.planks(37, 0), 2, 2),
  fence: texM(P.planks(38, 0), 1, 2),
};

// jet skin: two-tone camo blotches + panel lines + rivets (reference-style surface detail)
const jetSkinC = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const rnd = P.rng(77);
  g.fillStyle = '#7d8a7a'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 512, y = rnd() * 256, r = 24 + rnd() * 60;
    g.fillStyle = i % 2 ? 'rgba(92,102,89,0.75)' : 'rgba(141,153,133,0.5)';
    g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rnd() * 0.6), rnd() * 3.2, 0, 6.3); g.fill();
  }
  g.strokeStyle = 'rgba(50,58,48,0.55)'; g.lineWidth = 1.4;
  for (let x = 24; x < 512; x += 44) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (let y = 32; y < 256; y += 56) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.fillStyle = 'rgba(40,46,38,0.5)';
  for (let x = 24; x < 512; x += 44) for (let y = 6; y < 256; y += 14) g.fillRect(x - 1, y, 2, 2);
  return c;
})();
M.jetSkin = texM(jetSkinC, 2, 1);
// decals: generic tail code + roundel (no brand marks)
const codeTex = P.tex((() => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#f2eee4'; g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.fillText('07', 64, 92); return c; })());
const roundelTex = P.tex((() => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#3f6fb5'; g.beginPath(); g.arc(64, 64, 56, 0, 6.3); g.fill(); g.fillStyle = '#f2eee4'; g.beginPath(); g.arc(64, 64, 36, 0, 6.3); g.fill(); g.fillStyle = '#b8402f'; g.beginPath(); g.arc(64, 64, 18, 0, 6.3); g.fill(); return c; })());
const jetBlobTex = P.tex(P.radial('20,14,30', 0.6));

// ---------- ink / normal-depth contract ----------
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);
if (location.hash.includes('nosky')) sky.visible = false; // debug bisect switch

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
// practicals: TV glow (flickers during the tv shot) + warm garage bulb
const tvLight = new THREE.PointLight('#9ab8ff', 0, 9, 1.6); tvLight.position.set(0, 1.6, -402.6); scene.add(tvLight);
const bulbLight = new THREE.PointLight('#ffd9a0', 11, 12, 1.7); bulbLight.position.set(0, 2.5, 401.6); scene.add(bulbLight);
sun.shadow.mapSize.set(1024, 1024); // memory: 4x less than 2048, soft shadows still read at phone size sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- world: suburban lot ----------
const world = new THREE.Group(); scene.add(world);
// lawn
add(new THREE.PlaneGeometry(180, 90), M.grass, 0, -0.01, 0, world, { cast: false }).rotation.x = -Math.PI / 2;
// 3D grass tufts: near/mid-ground turf depth and parallax (user repeatedly asked for realistic grass, texture alone rejected)
{ // thin irregular blades, sunk below grade (no visible bases), olive shades matched to the lawn photo texture
  const pos = [];
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4, w = 0.011 + (i % 2) * 0.004, bx = Math.cos(a) * 0.028, bz = Math.sin(a) * 0.028,
      h = 0.13 + (i % 3) * 0.06, la = a + 0.7, tx = bx + Math.cos(la) * 0.05, tz = bz + Math.sin(la) * 0.05;
    pos.push(bx - w, -0.04, bz, bx + w, -0.04, bz, tx, h, tz); }
  const tuftGeo = new THREE.BufferGeometry(); tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tuftGeo.computeVertexNormals();
  const mkTufts = (n, x0, x1, z0, z1, smin, svar, colr, seed) => {
    const im = new THREE.InstancedMesh(tuftGeo, toon({ color: colr, side: THREE.DoubleSide }), n);
    const r_ = P.rng(seed), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), S = new THREE.Vector3(), Pv = new THREE.Vector3();
    let placed = 0, guard = 0;
    while (placed < n && guard++ < n * 40) { const x = x0 + r_() * (x1 - x0), z = z0 + r_() * (z1 - z0);
      if (x > 5.9 && x < 11.2 && z > -6.6 && z < 7.4) continue; // driveway
      if (z > 5.3 && z < 14.5) continue;                        // sidewalk + street
      const s = smin + r_() * svar; Q.setFromAxisAngle(UP, r_() * 6.283);
      M4.compose(Pv.set(x, -0.01, z), Q, S.set(s, s * (0.75 + r_() * 0.8), s)); im.setMatrixAt(placed++, M4); }
    im.count = placed; im.castShadow = false; im.receiveShadow = false; im.instanceMatrix.needsUpdate = true; world.add(im); };
  mkTufts(4500, -17, 18, -13, 5.3, 0.6, 0.7, '#5c6836', 5150);   // near yard
  mkTufts(2600, -30, 30, -32, -13, 1.1, 1.0, '#556231', 5151); }  // mid ground ring
// street along x at z=10
add(new THREE.PlaneGeometry(180, 7.5), M.asphalt, 0, 0, 10.2, world, { cast: false }).rotation.x = -Math.PI / 2;
add(new THREE.PlaneGeometry(180, 1.1), M.concrete, 0, 0.005, 5.9, world, { cast: false }).rotation.x = -Math.PI / 2; // sidewalk
// driveway from street to garage (garage at x=8.5)
add(new THREE.PlaneGeometry(4.6, 13), M.drvway, 8.5, 0.01, 0.4, world, { cast: false }).rotation.x = -Math.PI / 2;
for (const jz of [-4.2, -1.7, 0.8, 3.3]) add(box(4.6, 0.012, 0.07), toon({ color: '#8a8a86' }), 8.5, 0.018, jz, world, { cast: false }); // driveway expansion joints

// main house
const house = new THREE.Group(); house.position.set(-5, 0, -8.5); world.add(house);
add(tbox(13, 4.6, 8, 2), M.siding, 0, 2.3, 0, house);
{ const rf = add(new THREE.ConeGeometry(9.6, 2.6, 4), M.roof, 0, 5.9, 0, house); rf.rotation.y = Math.PI / 4; rf.scale.set(1.08, 1, 0.68); }
add(box(1.1, 2.1, 0.12), M.door, -3.4, 1.05, 4.05, house, { cast: false });
for (const x of [-0.6, 2.2, 5.0]) { add(box(1.3, 1.2, 0.1), M.window, x - 3.4, 2.6, 4.05, house, { cast: false }); add(box(1.5, 0.12, 0.16), M.white, x - 3.4, 1.95, 4.05, house, { cast: false });
  for (const s of [-1, 1]) add(box(0.28, 1.2, 0.08), M.door, x - 3.4 + s * 0.82, 2.6, 4.05, house, { cast: false }); } // shutters
add(tbox(1.0, 1.8, 1.0, 1), M.brick, 2.8, 6.4, -1.5, house); // chimney
// porch: slab, posts, awning, pots
add(tbox(2.6, 0.18, 1.4, 1), M.concrete, -3.4, 0.09, 4.6, house, { cast: false });
for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 8), M.white, -3.4 + s * 1.1, 1.1, 5.1, house);
add(tbox(2.8, 0.1, 1.5, 1), M.roof, -3.4, 2.2, 4.7, house);
for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.16, 0.13, 0.24, 10), toon({ color: '#a8522e' }), -3.4 + s * 0.9, 0.3, 4.7, house); add(new THREE.SphereGeometry(0.16, 8, 6), M.bush, -3.4 + s * 0.9, 0.5, 4.7, house); }
// attached garage
const garage = new THREE.Group(); garage.position.set(8.5, 0, -5.5); world.add(garage);
add(tbox(5.4, 3.2, 6, 2), M.siding2, 0, 1.6, 0, garage);
{ const rf = add(new THREE.ConeGeometry(4.6, 1.6, 4), M.roof, 0, 4.0, 0, garage); rf.rotation.y = Math.PI / 4; rf.scale.set(1.25, 1, 0.9); }
add(tbox(4.2, 2.6, 0.15, 1), M.white, 0, 1.3, 3.05, garage, { cast: false });
for (let i = 0; i < 3; i++) add(box(4.2, 0.06, 0.06), M.beam, 0, 0.7 + i * 0.7, 3.13, garage, { cast: false });
// basketball hoop over the garage door, garbage bins, hose coil
add(tbox(1.0, 0.7, 0.06, 1), toon({ color: '#c9d6e2' }), 0, 3.05, 3.14, garage, { cast: false }); // backboard: distinct tone, flush to the door so the rim stops floating
{ const rim = add(new THREE.TorusGeometry(0.22, 0.03, 8, 18), toon({ color: '#b8402f' }), 0, 2.72, 3.55, garage); rim.rotation.x = Math.PI / 2; }
add(new THREE.CylinderGeometry(0.34, 0.3, 0.8, 12), toon({ color: '#4a5244' }), 3.3, 0.4, 2.6, garage);
add(new THREE.CylinderGeometry(0.34, 0.3, 0.8, 12), toon({ color: '#3f4a5a' }), 4.1, 0.4, 2.6, garage);
{ const hc = add(new THREE.TorusGeometry(0.26, 0.05, 8, 20), toon({ color: '#3f6e2c' }), -3.4, 0.07, 4.6, garage); hc.rotation.x = Math.PI / 2; hc.scale.y = 0.75; } // coiled hose flat on the lawn strip
// mailbox
add(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), M.beam, 11.0, 0.55, 7.0, world);
add(box(0.55, 0.3, 0.3), toon({ color: '#3f6fb5' }), 11.0, 1.2, 7.0, world);
add(box(0.2, 0.12, 0.1), toon({ color: '#b8302c' }), 11.25, 1.28, 7.0, world); // flag up
// power poles + sagging wire along the street
for (const px of [-14, 12]) { add(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 8), M.beam, px, 3.2, 6.6, world); add(tbox(1.6, 0.12, 0.12, 1), M.beam, px, 5.7, 6.6, world); }
{ const pts = new THREE.CatmullRomCurve3([new THREE.Vector3(-14.7, 5.7, 6.6), new THREE.Vector3(-1, 4.75, 6.6), new THREE.Vector3(12.7, 5.7, 6.6)]); add(new THREE.TubeGeometry(pts, 20, 0.02, 6), toon({ color: '#2c2620' }), 0, 0, 0, world, { cast: false }); }
// hydrant + street lamp
add(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 10), toon({ color: '#b8402f' }), 5.5, 0.28, 6.4, world);
add(new THREE.SphereGeometry(0.14, 10, 8), toon({ color: '#b8402f' }), 5.5, 0.6, 6.4, world);
add(new THREE.CylinderGeometry(0.05, 0.07, 3.4, 8), toon({ color: '#3a3f46' }), -6, 1.7, 6.2, world);
add(box(0.5, 0.14, 0.24), toon({ color: '#3a3f46' }), -5.7, 3.42, 6.2, world);
// garden gnome by the front path (lawn-ornament foreshadowing)
add(new THREE.ConeGeometry(0.16, 0.34, 10), toon({ color: '#b8302c' }), -2.5, 0.52, -3.2, world);
add(new THREE.SphereGeometry(0.12, 10, 8), toon({ color: '#f5c9a0' }), -2.5, 0.3, -3.2, world);
add(new THREE.CylinderGeometry(0.12, 0.16, 0.24, 10), toon({ color: '#3f6fb5' }), -2.5, 0.12, -3.2, world);
// flower bed along the house front
{ const r = P.rng(41); const cols = ['#c2453c', '#e8a03c', '#c95a8a', '#e8e4da'];
  for (let i = 0; i < 14; i++) { const x = -10.5 + i * 0.72, z = -4.2 + r() * 0.3;
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 5), M.bush, x, 0.11, z, world, { cast: false });
    add(new THREE.SphereGeometry(0.07 + r() * 0.03, 8, 6), toon({ color: cols[i % 4] }), x, 0.26, z, world); } }
// driveway wear: oil stains + cracks
{ const stain = (x, z, s) => { const m = add(new THREE.CircleGeometry(s, 14), new THREE.MeshBasicMaterial({ color: '#26241f', transparent: true, opacity: 0.35, depthWrite: false }), x, 0.02, z, world, { cast: false }); m.rotation.x = -Math.PI / 2; m.userData.ndSkip = true; m.renderOrder = 1; };
  stain(8.0, 1.8, 0.55); stain(9.3, 3.4, 0.4); stain(7.6, -1.2, 0.35); }
for (const [x, z, w, rot] of [[8.9, 1.0, 1.6, 0.4], [7.8, 3.0, 1.2, -0.7], [9.6, -0.6, 1.4, 1.1]]) { const m = add(box(w, 0.012, 0.05), toon({ color: '#4a463c' }), x, 0.02, z, world, { cast: false }); m.rotation.y = rot; }
// kid's bike dropped on the lawn
{ const bk = new THREE.Group(); bk.position.set(-7.5, 0.12, 2.6); bk.rotation.x = Math.PI / 2; world.add(bk);
  for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.3, 0.05, 8, 18), M.tire, s * 0.55, 0, 0, bk);
  add(box(1.0, 0.06, 0.06), toon({ color: '#c2453c' }), 0, 0.12, 0, bk); }
// wooden fence along the back
for (let x = -26; x <= 20; x += 2.1) add(tbox(0.18, 1.3, 0.18, 1), M.fence, x, 0.65, -13.5, world);
for (const y of [0.45, 1.05]) add(tbox(47, 0.14, 0.1, 1), M.fence, -3, y, -13.5, world);
// neighbors across the street
const nbhouse = (x, z, w, d, h, rot, mat) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; world.add(g);
  add(tbox(w, h, d, 2), mat, 0, h / 2, 0, g);
  const rf = add(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.5, 2.0, 4), M.roof, 0, h + 1.0, 0, g); rf.rotation.y = Math.PI / 4; rf.scale.set(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
  add(box(0.9, 1.8, 0.1), M.door, 0, 0.9, d / 2 + 0.03, g, { cast: false });
  for (const s of [-1, 1]) add(box(0.7, 0.8, 0.1), M.window, s * w * 0.3, h * 0.6, d / 2 + 0.03, g, { cast: false });
};
nbhouse(-16, 22, 10, 7, 4.2, Math.PI, M.brick);
nbhouse(2, 24, 11, 8, 4.6, Math.PI, M.siding);
nbhouse(20, 22, 9, 7, 3.9, Math.PI + 0.15, M.siding2);
nbhouse(-34, 20, 10, 7, 4.3, Math.PI - 0.12, M.siding);
const NOTREES = location.hash.includes('notrees');
const NOJET = location.hash.includes('nojet'); const NOCAR = location.hash.includes('nocar');
// trees + bushes
const blobGeo = (seed) => { const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position; const rnd = P.rng(seed);
  for (let i = 0; i < p.count; i++) { const j = 1 + (rnd() - 0.5) * 0.42; p.setXYZ(i, p.getX(i) * j, p.getY(i) * j, p.getZ(i) * j); }
  g.computeVertexNormals(); return g; };
const tree = (x, z, h = 6, which = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  const T_ = lindenM || oakM; // linden only: oak's merged geometry doubled tree memory and tipped the software renderer into context loss
  if (T_) { const c = T_.grp.clone(); c.scale.setScalar(h / T_.h); c.rotation.y = ((x * 13.7) % 6.28 + 6.28) % 6.28; g.add(c); return g; }
  add(new THREE.CylinderGeometry(0.2, 0.3, h * 0.55, 6), M.trunk, 0, h * 0.27, 0, g);
  const blob = (mat, bx, by, bz, s, seed) => { const c = add(blobGeo(seed), mat, bx, by, bz, g); c.scale.set(s, s * 0.75, s); };
  if (useShrub && shrubSrc) { // real-foliage canopy: a crown of Poly Haven shrub_01 clusters fanned outward
    const sh = new THREE.Box3().setFromObject(shrubSrc).getSize(new THREE.Vector3());
    const dirs = [[0, 0.95, 0], [0.7, 0.5, 0.2], [-0.7, 0.5, -0.2], [0.2, 0.55, 0.7], [-0.2, 0.55, -0.7], [0.55, 0.8, -0.55], [-0.55, 0.8, 0.55]];
    let k = 0;
    for (const [dx, dy, dz] of dirs) {
      const c = shrubSrc.clone(); k++;
      c.position.set(dx * h * 0.3, h * 0.5 + dy * h * 0.3, dz * h * 0.3);
      c.rotation.set(dz * 1.1, (k * 2.4 + x) % 6.28, -dx * 1.1);
      c.scale.setScalar((h * 0.34) / (sh.y || 1));
      g.add(c);
    }
  } else {
  blob(M.pine, 0.15, h * 0.75, 0, h * 0.42, x * 7 + 1);
  blob(M.bush, -h * 0.18, h * 0.6, h * 0.12, h * 0.28, x * 7 + 2);
  blob(M.pine, h * 0.22, h * 0.88, -h * 0.08, h * 0.3, x * 7 + 3);
  blob(M.bush, h * 0.05, h * 0.7, h * 0.2, h * 0.24, x * 7 + 4);
  }
  return g; };
if (!NOTREES) { tree(-14, -4, 7); tree(-20, 6, 6, 1); tree(15.5, -9, 6.5); tree(26, 4, 7.5, 1); tree(-28, -8, 8); tree(36, 14, 6, 1); } // Innerscene CC0 linden street trees
// distant treeline closing the horizon
for (let i = 0; i < (NOTREES ? 0 : 6); i++) { const th = 6 + (i * 37 % 5); const T_ = lindenM; const tx = -50 + i * 17, tz = -45 - (i % 3) * 4;
  if (T_) { const c = T_.grp.clone(); c.scale.setScalar(th / T_.h); c.position.set(tx, 0, tz); c.rotation.y = i * 1.7; c.traverse((o) => { o.castShadow = false; }); world.add(c); }
  else { const c = add(new THREE.SphereGeometry(1, 10, 7), i % 2 ? M.pine : M.bush, tx, th * 0.55, tz, world, { cast: false }); c.scale.set(5 + (i % 3) * 2, th * 0.6, 4); } }
{ const r = P.rng(77); const sh = shrubSrc ? new THREE.Box3().setFromObject(shrubSrc).getSize(new THREE.Vector3()) : null;
  for (let i = 0; i < 16; i++) { const x = -26 + r() * 48, z = -12.6 + r() * 1.2;
    if (shrubSrc && i % 2 === 0) { const b = shrubSrc.clone(); b.position.set(x, 0, z); b.rotation.y = r() * 6.28; b.scale.setScalar((0.55 + r() * 0.5) / (sh.y || 1)); world.add(b); }
    else add(new THREE.SphereGeometry(0.7 + r() * 0.7, 10, 8), M.bush, x, 0.4, z, world).scale.y = 0.72; } }

// ---------- the Harrier-style jump jet ----------
const jet = new THREE.Group(); jet.position.set(8.0, 0, 1.15); jet.rotation.y = -0.95; world.add(jet); // parked diagonally: nose toward street-left, tail clear of the garage door (z=-2.45)
{
  // smooth lathe fuselage: exhaust nozzle -> rounded nose tip
  const prof = [[0.30, 0], [0.36, 0.25], [0.46, 1.2], [0.58, 2.4], [0.68, 4.0], [0.72, 6.0], [0.69, 7.6], [0.56, 9.4], [0.36, 10.7], [0.13, 11.5], [0.01, 11.9]];
  const fus = add(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 24), M.jetSkin, 0, 1.5, -7.2, jet);
  fus.rotation.x = Math.PI / 2;
  const pitot = add(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6), M.steel, 0, 1.5, 5.1, jet); pitot.rotation.x = Math.PI / 2;
  // exhaust nozzle: steel ring + dark interior
  add(new THREE.TorusGeometry(0.3, 0.07, 8, 18), M.steel, 0, 1.5, -7.25, jet);
  const exIn = add(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 14), toon({ color: '#1c1a17' }), 0, 1.5, -7.2, jet); exIn.rotation.x = Math.PI / 2;
  // canopy bubble + frame + glint + dorsal spine + refuel probe
  const canopy = add(new THREE.SphereGeometry(0.62, 24, 16), M.canopy, 0, 2.24, 2.2, jet); canopy.scale.set(0.8, 0.7, 1.7);
  add(box(0.9, 0.07, 2.0), M.jetDark, 0, 1.98, 2.2, jet);
  add(new THREE.SphereGeometry(0.5, 12, 8), toon({ color: '#9fc0d4' }), 0.14, 2.4, 2.45, jet, { cast: false }).scale.set(0.5, 0.26, 1.25);
  add(box(0.28, 0.16, 3.6), M.jetDark, 0, 2.28, -1.4, jet);
  const probe = add(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), M.steel, 0.28, 2.35, 3.5, jet); probe.rotation.x = rx(76);
  for (const s of [-1, 1]) { // round intake pods with dark lips
    const pod = add(new THREE.CylinderGeometry(0.4, 0.36, 1.5, 18), M.jetSkin, s * 0.78, 1.72, 2.0, jet); pod.rotation.x = Math.PI / 2;
    add(new THREE.TorusGeometry(0.3, 0.07, 8, 20), M.jetDark, s * 0.78, 1.72, 2.78, jet);
    add(new THREE.CircleGeometry(0.28, 18), toon({ color: '#22281f' }), s * 0.78, 1.72, 2.74, jet, { cast: false });
    // vector-thrust nozzles, 2 per side
    for (const z of [0.4, -1.4]) { const n = add(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 10), M.steel, s * 0.8, 1.28, z, jet); n.rotation.z = s * Math.PI / 2; }
    // roundel on the rear fuselage
    add(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ map: roundelTex, transparent: true, fog: true }), s * 0.62, 1.62, -3.4, jet, { cast: false }).rotation.y = s * Math.PI / 2;
  }
  // swept wings as extruded planforms with anhedral
  const wingGeo = (s) => {
    const sh = new THREE.Shape();
    sh.moveTo(s * 0.4, 0.75); sh.lineTo(s * 0.4, -1.95); sh.lineTo(s * 3.4, -1.15); sh.lineTo(s * 3.4, -0.35); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.13, bevelEnabled: false }); g.rotateX(Math.PI / 2); return g;
  };
  for (const s of [-1, 1]) {
    const w = add(wingGeo(s), M.jetSkin, 0, 2.02, -0.1, jet); w.rotation.z = s * rx(-7);
    for (const pz of [-0.2, -1.1]) add(box(0.5, 0.34, 0.9), M.jetDark, s * 2.1, 1.75, pz, jet); // empty pylons
    add(box(0.1, 0.09, 0.26), toon({ color: s < 0 ? '#c23a3a' : '#3ac26a' }), s * 3.42, 1.9, -1.35, jet, { cast: false }); // wingtip nav light
    // outrigger gear
    add(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), M.steel, s * 3.3, 0.95, -1.05, jet);
    const ow = add(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10), M.tire, s * 3.3, 0.22, -1.05, jet); ow.rotation.z = Math.PI / 2;
    const owh = add(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 10), M.hub, s * 3.3, 0.22, -1.05, jet); owh.rotation.z = Math.PI / 2;
  }
  // swept tail fin as extruded profile + tail code decals
  const finSh = new THREE.Shape();
  finSh.moveTo(4.7, 2.1); finSh.lineTo(5.35, 4.3); finSh.lineTo(5.95, 4.2); finSh.lineTo(6.7, 2.1); finSh.closePath();
  const finG = new THREE.ExtrudeGeometry(finSh, { depth: 0.14, bevelEnabled: false }); finG.rotateY(Math.PI / 2);
  add(finG, M.jetSkin, -0.14, 0, 0, jet);
  for (const s of [-1, 1]) {
    add(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ map: codeTex, transparent: true, fog: true }), s * 0.16, 3.35, -5.55, jet, { cast: false }).rotation.y = s * Math.PI / 2;
  }
  for (const s of [-1, 1]) { const st = add(box(1.9, 0.12, 1.1), M.jetSkin, s * 1.05, 3.1, -5.8, jet); st.rotation.z = s * rx(-10); }
  // bicycle gear
  add(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6), M.steel, 0, 0.85, 3.4, jet);
  const nw = add(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 12), M.tire, 0, 0.3, 3.4, jet); nw.rotation.z = Math.PI / 2;
  const nwh = add(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 10), M.hub, 0, 0.3, 3.4, jet); nwh.rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), M.steel, 0, 0.6, -4.2, jet);
  const rw = add(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 12), M.tire, 0, 0.32, -4.2, jet); rw.rotation.z = Math.PI / 2;
  const rwh = add(new THREE.CylinderGeometry(0.15, 0.15, 0.18, 10), M.hub, 0, 0.32, -4.2, jet); rwh.rotation.z = Math.PI / 2;
}

// soft contact shadow grounding the jet on the driveway
{ const sh = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 9), new THREE.MeshBasicMaterial({ map: jetBlobTex, transparent: true, depthWrite: false, fog: true, opacity: 0.8 }));
  sh.rotation.x = -Math.PI / 2; sh.rotation.z = -0.95; sh.position.set(8.0, 0.015, 1.2); sh.userData.ndSkip = true; sh.renderOrder = 1; world.add(sh); }

// ---------- generic silver sedan ----------
if (glbJet && !NOJET) {
  const gj = glbJet;
  // model is Y-up with nose at +Z already: no flip needed (bounds: tail -13.7, nose +0.6)
  let bb = new THREE.Box3().setFromObject(gj);
  const size = bb.getSize(new THREE.Vector3());
  const s = 8.5 / size.z; // fits the driveway depth (garage door z=-2.45 to street z~6.5)
  gj.scale.setScalar(s);
  bb = new THREE.Box3().setFromObject(gj);
  const c = bb.getCenter(new THREE.Vector3());
  gj.position.x -= c.x;                 // center on the jet group's axis
  gj.position.z -= c.z;                 // group origin = jet center
  gj.position.y -= bb.min.y;            // gear on the ground
  jet.updateMatrixWorld(true);
  const wb = new THREE.Box3().setFromObject(jet);
  console.log('JETBB', JSON.stringify({ min: wb.min.toArray().map(v => +v.toFixed(2)), max: wb.max.toArray().map(v => +v.toFixed(2)) }));
  for (const ch of [...jet.children]) ch.visible = false; // procedural jet becomes fallback-only
  jet.add(gj);
}

const car = new THREE.Group(); car.position.set(6.6, 0, 6.0); car.rotation.y = -0.06; world.add(car); // parked at the curb by the driveway mouth: clear of the jet below the high wide
if (sedanSrc) { // Innerscene CC0 red four-door sedan: real coachwork/glazing/wheels, replaces the rejected box car
  const bb = new THREE.Box3().setFromObject(sedanSrc); const sz = bb.getSize(new THREE.Vector3());
  if (sz.z > sz.x) sedanSrc.rotation.y = Math.PI / 2; // length along local x, matching the old car's framing
  const s4 = 4.4 / Math.max(sz.x, sz.z); sedanSrc.scale.setScalar(s4); // slightly under nominal 4.87m so the mailbox stays clear
  const bb2 = new THREE.Box3().setFromObject(sedanSrc); const c4 = bb2.getCenter(new THREE.Vector3());
  sedanSrc.position.x -= c4.x; sedanSrc.position.z -= c4.z; sedanSrc.position.y -= bb2.min.y - 0.01;
  if (!NOCAR) car.add(sedanSrc);
} else {
  add(box(4.1, 0.85, 1.75), M.carBody, 0, 0.82, 0, car);
  add(box(4.24, 0.2, 1.88), toon({ color: '#9aa4ac' }), 0, 0.48, 0, car); // bumper band
  const cab = add(new THREE.SphereGeometry(1, 18, 12), M.carBody, -0.15, 1.35, 0, car); cab.scale.set(1.25, 0.62, 0.82); // rounded cabin
  const glz = add(box(2.1, 0.32, 1.68), M.carGlass, -0.15, 1.42, 0, car, { cast: false }); // window band through the cabin
  const ws = add(box(0.5, 0.28, 1.6), M.carGlass, 1.05, 1.3, 0, car, { cast: false }); ws.rotation.z = rx(-18); // raked windshield
  const hood = add(box(1.3, 0.1, 1.7), M.carBody, 1.65, 1.22, 0, car); hood.rotation.z = rx(-9); // sloped hood
  const trunk = add(box(0.9, 0.1, 1.7), M.carBody, -1.85, 1.24, 0, car); trunk.rotation.z = rx(7);
  for (const s of [-1, 1]) add(box(0.16, 0.1, 0.06), M.carBody, 0.55, 1.35, s * 0.98, car); // mirrors
  for (const [x, z] of [[-1.45, 0.85], [1.45, 0.85], [-1.45, -0.85], [1.45, -0.85]]) {
    const w = add(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14), M.tire, x, 0.36, z, car); w.rotation.x = Math.PI / 2;
    const hb = add(new THREE.CylinderGeometry(0.16, 0.16, 0.26, 10), M.hub, x, 0.36, z, car); hb.rotation.x = Math.PI / 2;
  }
  add(box(0.06, 0.18, 0.9), toon({ color: '#e8e4da' }), 2.32, 0.85, 0, car, { cast: false }); // headlight strip
}

// ---------- mechanical horse (the metaphor), hidden until shot 9 ----------
const horseG = new THREE.Group(); horseG.position.set(-5.5, 0, 1.8); horseG.rotation.y = 0.785; world.add(horseG);
const drum = new THREE.Group(); drum.position.set(-9.2, 0, 4.6); world.add(drum);
let hose;
{
  add(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 16), M.drum, 0, 0.55, 0, drum);
  add(new THREE.TorusGeometry(0.55, 0.05, 8, 24), M.jetDark, 0, 1.02, 0, drum).rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.55, 0.05, 8, 24), M.jetDark, 0, 0.35, 0, drum).rotation.x = Math.PI / 2;
  // horse: jet-engine body on legs
  const body = add(new THREE.CylinderGeometry(0.85, 0.7, 3.6, 16), M.steel, 0, 2.1, 0, horseG); body.rotation.z = Math.PI / 2;
  add(new THREE.ConeGeometry(0.7, 1.0, 14), M.jetDark, -2.25, 2.1, 0, horseG).rotation.z = -Math.PI / 2; // tail exhaust
  const neck = add(new THREE.CylinderGeometry(0.4, 0.55, 1.6, 12), M.steel, 1.9, 3.0, 0, horseG); neck.rotation.z = rx(-38);
  add(box(0.95, 0.75, 0.65), M.steel, 2.6, 3.85, 0, horseG); // head
  add(new THREE.CylinderGeometry(0.16, 0.22, 0.8, 8), M.jetDark, 2.95, 3.55, 0, horseG).rotation.z = rx(70); // intake snout
  for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.16, 0.7, 6), M.jetDark, 2.45, 4.4, s * 0.26, horseG); // ear intakes
  for (const [x, z] of [[-1.2, 0.45], [-1.2, -0.45], [1.2, 0.45], [1.2, -0.45]]) {
    add(new THREE.CylinderGeometry(0.16, 0.13, 1.7, 8), M.jetDark, x, 0.85, z, horseG);
    add(new THREE.SphereGeometry(0.2, 8, 8), M.steel, x, 1.55, z, horseG);
    add(box(0.42, 0.16, 0.42), M.tire, x, 0.08, z, horseG);
  }
  for (let i = 0; i < 8; i++) add(new THREE.SphereGeometry(0.05, 6, 6), M.jetDark, -1.4 + i * 0.4, 2.86, 0, horseG); // rivet line
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12), M.jetDark, -0.3, 3.0, 0, horseG); // saddle tank cap
  // fuel hose drum -> horse mouth
  const pts = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-9.2, 1.1, 4.6), new THREE.Vector3(-8.2, 0.35, 5.4), new THREE.Vector3(-6.2, 0.35, 5.0),
    new THREE.Vector3(-4.8, 1.8, 2.6), new THREE.Vector3(-3.9, 3.4, 0.2),
  ]);
  hose = add(new THREE.TubeGeometry(pts, 24, 0.055, 8), toon({ color: '#6a5a48' }), 0, 0, 0, world);
}

// ---------- garage interior set (z=+400) ----------
const GZ = 400;
const gar = new THREE.Group(); gar.position.set(0, 0, GZ); world.add(gar);
{
  add(new THREE.PlaneGeometry(9, 8), M.concrete, 0, 0.01, 1.5, gar, { cast: false }).rotation.x = -Math.PI / 2;
  add(tbox(9, 3.4, 0.3, 2), M.wallIn, 0, 1.7, -2.4, gar);
  add(tbox(0.3, 3.4, 8, 2), M.wallIn, -4.5, 1.7, 1.5, gar);
  add(tbox(0.3, 3.4, 8, 2), M.wallIn, 4.5, 1.7, 1.5, gar);
  add(box(1.0, 1.4, 0.1), M.window, -2.6, 2.0, -2.24, gar, { cast: false });
  // shelves on the right wall
  for (const y of [0.9, 1.7, 2.5]) add(tbox(0.8, 0.08, 5.6, 1), M.plank, 3.9, y, 1.2, gar);
  for (const z of [-1.2, 3.6]) add(tbox(0.8, 2.9, 0.12, 1), M.beam, 3.9, 1.45, z, gar);
  // crates: on shelves and stacked on the floor
  const crateAt = (x, y, z, s = 1) => { add(tbox(0.62 * s, 0.62 * s, 0.62 * s, 0.6), M.crate, x, y + 0.31 * s, z, gar); };
  const rc = P.rng(9);
  for (const y of [0.94, 1.74, 2.54]) for (let z = -0.8; z < 3.4; z += 0.85) if (rc() > 0.2) crateAt(3.9, y, z, 0.9);
  for (let i = 0; i < 3; i++) crateAt(-3.2, i * 0.66, -1.4, 1.05);
  for (let i = 0; i < 2; i++) crateAt(-2.2, i * 0.66, -1.5, 1.05);
  crateAt(-2.7, 0, -0.3, 1.05);
  // delivery pile the hero is adding to, center of the room
  for (let i = 0; i < 3; i++) crateAt(1.6, i * 0.66, 1.8, 1.1);
  for (let i = 0; i < 2; i++) crateAt(2.6, i * 0.66, 1.7, 1.1);
  crateAt(2.1, 0, 2.8, 1.1); crateAt(3.1, 0, 2.6, 1.1);
  // workbench + tools on the left
  add(tbox(2.6, 0.12, 1.0, 1), M.plank, -3.0, 1.0, 3.2, gar);
  for (const [x, z] of [[-4.1, 2.8], [-1.9, 2.8], [-4.1, 3.6], [-1.9, 3.6]]) add(tbox(0.1, 1.0, 0.1, 1), M.beam, x, 0.5, z, gar);
  add(box(0.6, 0.35, 0.4), toon({ color: '#b8402f' }), -3.4, 1.24, 3.1, gar);
  // pegboard with hanging tools on the back wall
  add(tbox(2.2, 1.4, 0.06, 1), toon({ color: '#8a6a48' }), 0.8, 1.9, -2.22, gar, { cast: false });
  { const tool = (x, y, w, h) => add(box(w, h, 0.05), toon({ color: '#2e2a26' }), x, y, -2.16, gar, { cast: false });
    tool(0.2, 1.9, 0.1, 0.7); tool(0.55, 2.0, 0.34, 0.12); tool(0.9, 1.85, 0.08, 0.55); tool(1.25, 1.95, 0.26, 0.3); tool(1.6, 1.9, 0.09, 0.62); }
  // hanging bulb (the practical behind bulbLight)
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6), toon({ color: '#2c2620' }), 0, 3.05, 1.6, gar, { cast: false });
  { const b = add(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe8b0' }), 0, 2.66, 1.6, gar, { cast: false }); b.userData.ndSkip = true; }
  // window light shaft (fake volumetric)
  { const shaft = add(new THREE.PlaneGeometry(1.3, 3.4), new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide }), -2.0, 1.3, -0.9, gar, { cast: false });
    shaft.rotation.set(-0.5, 0.25, 0); shaft.userData.ndSkip = true; shaft.renderOrder = 1; }
  // oil stains on the floor
  { const stain2 = (x, z, s) => { const m = add(new THREE.CircleGeometry(s, 12), new THREE.MeshBasicMaterial({ color: '#26241f', transparent: true, opacity: 0.3, depthWrite: false }), x, 0.02, z, gar, { cast: false }); m.rotation.x = -Math.PI / 2; m.userData.ndSkip = true; m.renderOrder = 1; };
    stain2(-0.6, 0.6, 0.5); stain2(0.9, 3.2, 0.35); }
  // step ladder leaning on the left wall
  { const lad = new THREE.Group(); lad.position.set(-4.0, 0, 0.4); lad.rotation.z = 0.1; gar.add(lad);
    for (const s of [-1, 1]) add(tbox(0.06, 2.2, 0.3, 1), M.plank, 0, 1.1, s * 0.35, lad);
    for (let i = 0; i < 4; i++) add(tbox(0.3, 0.05, 0.62, 1), M.plank, 0.12 + i * 0.06, 0.4 + i * 0.5, 0, lad); }
  // cardboard boxes
  add(box(0.7, 0.5, 0.6), toon({ color: '#a8825a' }), -0.6, 0.25, 3.5, gar);
  add(box(0.55, 0.4, 0.5), toon({ color: '#b8906a' }), -0.6, 0.7, 3.5, gar);
  // wall clock
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18), toon({ color: '#2e2a26' }), 1.6, 2.5, -2.22, gar, { cast: false }).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 18), toon({ color: '#f2eee4' }), 1.6, 2.5, -2.23, gar, { cast: false }).rotation.x = Math.PI / 2;
  // jet poster on the right wall (legible-text prop, reference grammar)
  { const c = document.createElement('canvas'); c.width = 256; c.height = 340; const g = c.getContext('2d');
    g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, 256, 340); g.strokeStyle = '#8a8272'; g.lineWidth = 8; g.strokeRect(8, 8, 240, 324);
    g.fillStyle = '#5a6a72'; g.beginPath(); g.moveTo(30, 210); g.lineTo(110, 185); g.lineTo(220, 178); g.lineTo(240, 190); g.lineTo(150, 205); g.lineTo(50, 222); g.closePath(); g.fill();
    g.fillStyle = '#22303c'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.fillText('JET', 128, 80);
    g.fillStyle = '#6a7680'; g.font = '20px sans-serif'; g.fillText('7,000,000 pts', 128, 300);
    const ptex = new THREE.CanvasTexture(c); ptex.colorSpace = THREE.SRGBColorSpace;
    const pm = add(new THREE.PlaneGeometry(0.8, 1.06), new THREE.MeshBasicMaterial({ map: ptex }), 4.33, 1.9, 0.6, gar, { cast: false });
    pm.rotation.y = -Math.PI / 2; pm.userData.ndSkip = true; }
  // radio + flat of soda cans on the workbench
  add(box(0.4, 0.22, 0.18), toon({ color: '#7a3a2a' }), -2.5, 1.17, 3.2, gar);
  add(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 6), M.steel, -2.35, 1.45, 3.2, gar);
  { add(box(0.55, 0.1, 0.4), toon({ color: '#b8b0a0' }), -3.5, 1.11, 3.4, gar);
    for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 10), toon({ color: i % 2 ? '#c2453c' : '#3f6fb5' }), -3.65 + (i % 3) * 0.15, 1.22, 3.3 + Math.floor(i / 3) * 0.18, gar); }
}

// ---------- living room set (z=-400) ----------
const LZ = -400;
const liv = new THREE.Group(); liv.position.set(0, 0, LZ); world.add(liv);
let tvGlow;
{
  add(new THREE.PlaneGeometry(9, 8), M.floorIn, 0, 0.01, 0, liv, { cast: false }).rotation.x = -Math.PI / 2;
  add(tbox(9, 3.4, 0.3, 2), M.wallIn, 0, 1.7, -4.6, liv);
  add(tbox(0.3, 3.4, 8, 2), M.wallIn, -4.5, 1.7, -0.8, liv);
  add(tbox(0.3, 3.4, 8, 2), M.wallIn, 4.5, 1.7, -0.8, liv);
  // TV on a stand against the back wall
  add(tbox(2.8, 0.5, 0.6, 1), M.beam, 0, 0.25, -4.2, liv);
  add(box(2.5, 1.45, 0.14), toon({ color: '#1c1a20' }), 0, 1.55, -4.3, liv);
  // the commercial: jet silhouette + small print, drawn once
  const c = document.createElement('canvas'); c.width = 512; c.height = 288; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 288); grd.addColorStop(0, '#7ab2e8'); grd.addColorStop(1, '#dcecf8'); g.fillStyle = grd; g.fillRect(0, 0, 512, 288);
  g.fillStyle = '#5a6a72';
  g.beginPath(); g.moveTo(70, 190); g.lineTo(200, 160); g.lineTo(400, 150); g.lineTo(440, 165); g.lineTo(300, 185); g.lineTo(120, 205); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(200, 160); g.lineTo(240, 110); g.lineTo(280, 105); g.lineTo(260, 158); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(230, 185); g.lineTo(270, 230); g.lineTo(310, 225); g.lineTo(280, 180); g.closePath(); g.fill();
  g.fillStyle = '#39434a'; g.fillRect(388, 120, 14, 42);
  g.fillStyle = '#22303c'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('THE JET', 256, 48);
  g.fillStyle = '#4a5660'; g.font = '17px sans-serif'; g.fillText('yours for only', 256, 76);
  // center-stacked so the portrait insert crop keeps every key line readable
  g.fillStyle = '#b8302c'; g.font = 'bold 34px sans-serif'; g.fillText('7,000,000', 256, 246);
  g.font = 'bold 20px sans-serif'; g.fillText('points*', 256, 268);
  g.fillStyle = '#6a7680'; g.font = '11px sans-serif'; g.fillText('*actual military aircraft. t-shirt not included.', 256, 284);
  const adTex = new THREE.CanvasTexture(c); adTex.colorSpace = THREE.SRGBColorSpace;
  tvGlow = add(new THREE.PlaneGeometry(2.3, 1.3), new THREE.MeshBasicMaterial({ map: adTex, fog: false }), 0, 1.55, -4.22, liv, { cast: false });
  tvGlow.userData.ndSkip = true;
  // couch facing the TV
  add(box(3.0, 0.55, 1.2), M.couch, -0.4, 0.28, -0.9, liv);
  add(box(3.0, 0.9, 0.3), M.couch, -0.4, 0.75, -0.28, liv);
  for (const s of [-1, 1]) add(box(0.35, 0.75, 1.2), M.couch, -0.4 + s * 1.65, 0.55, -0.9, liv);
  // rug + lamp
  add(new THREE.CircleGeometry(1.8, 24), toon({ color: '#7a5a8a' }), -0.4, 0.02, -2.4, liv, { cast: false }).rotation.x = -Math.PI / 2;
  add(new THREE.CylinderGeometry(0.05, 0.09, 1.5, 8), M.beam, 3.6, 0.75, -3.8, liv);
  add(new THREE.ConeGeometry(0.42, 0.5, 12), toon({ color: '#e8d9a0' }), 3.6, 1.75, -3.8, liv);
  add(box(1.0, 1.3, 0.1), M.window, -4.34, 1.9, -1.5, liv, { cast: false });
  // night curtains, side table with a soda can, popcorn bowl, framed picture, wall clock
  for (const s of [-1, 1]) add(box(0.12, 1.6, 0.5), toon({ color: '#5a3a4a' }), -4.38, 1.9, -1.5 + s * 0.85, liv, { cast: false });
  add(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 12), M.plank, -2.6, 0.62, -0.9, liv);
  add(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 8), M.beam, -2.6, 0.3, -0.9, liv);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), toon({ color: '#3f6fb5' }), -2.6, 0.72, -0.85, liv);
  add(new THREE.CylinderGeometry(0.16, 0.11, 0.14, 12), toon({ color: '#c2453c' }), 0.6, 0.62, -0.7, liv);
  { const r = P.rng(5); for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.03, 6, 5), toon({ color: '#f2e8c8' }), 0.6 + (r() - 0.5) * 0.18, 0.7, -0.7 + (r() - 0.5) * 0.18, liv); }
  add(box(0.7, 0.55, 0.06), M.beam, 2.4, 2.1, -4.42, liv, { cast: false });
  add(box(0.58, 0.43, 0.07), toon({ color: '#7ab2e8' }), 2.4, 2.1, -4.42, liv, { cast: false });
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 18), toon({ color: '#f2eee4' }), -2.0, 2.4, -4.42, liv, { cast: false }).rotation.x = Math.PI / 2;
}

// clouds: painted billboards far away
const clouds = [];
{ const r = P.rng(90); if (!location.hash.includes("noclouds"))
  for (let i = 0; i < 12; i++) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const g2 = c.getContext('2d'); const rr = P.rng(900 + i);
    const puff = (x, y, r, a) => { const rg = g2.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(0.55, `rgba(252,253,255,${a * 0.55})`); rg.addColorStop(1, 'rgba(250,252,255,0)'); g2.fillStyle = rg; g2.beginPath(); g2.arc(x, y, r, 0, 7); g2.fill(); };
    const by = 150 + rr() * 30; // soft puffy cloud, irregular transparent edges (user: reference-like sky)
    puff(300, by + 30, 120, 0.9); puff(205, by + 65, 88, 0.85); puff(398, by + 62, 95, 0.85); puff(140, by + 100, 65, 0.8); puff(462, by + 98, 70, 0.8); puff(300, by + 105, 105, 0.85); puff(238, by + 118, 70, 0.7); puff(360, by + 120, 72, 0.7);
    puff(300, by + 130, 95, 0.35); puff(210, by + 140, 60, 0.3); puff(390, by + 140, 62, 0.3); // faint underside depth
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.667), new THREE.MeshBasicMaterial({ map: P.tex(c), transparent: true, fog: false, depthWrite: false }));
    const a = r() * Math.PI * 2, d = 650 + r() * 250; m.position.set(Math.cos(a) * d, 120 + r() * 160, Math.sin(a) * d); m.scale.setScalar(160 + r() * 140);
    if (i >= 8) { m.position.y = 55 + r() * 65; m.scale.setScalar(120 + r() * 90); } // lower ring: visible mid-sky in outdoor shots
    m.userData.ndSkip = true; m.renderOrder = -1; scene.add(m); clouds.push(m);
  } }

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor() {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; })();
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & post ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;
      if (card) ds = 1e4;
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .20, (ds - d)/d)); // .20: grazing-angle far-ground depth ramps must not ink (horizon slab artifact)
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9);
    }
    return e * (1. - smoothstep(140., 520., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, vec3(1.), flash);
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ vec4 t = texture2D(nd, uv); float d = t.a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; float b = k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); bool card = dot(t.rgb,t.rgb) < .01 && t.a > 0.; return card ? b * 0.15 : b; } // characters stay near-sharp (user: face blur)
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}

function worldState(W_, f) {
  horseG.visible = W_.horse; drum.visible = W_.horse; hose.visible = W_.horse;
  if (W_.tv) { const fl = 0.94 + 0.06 * Math.sin(f * 1.7) + 0.02 * Math.sin(f * 6.3); tvGlow.material.color.setScalar(fl);
    tvLight.intensity = 6.5 + 1.6 * Math.sin(f * 1.7) + 0.7 * Math.sin(f * 6.3); } else tvLight.intensity = 0;
}

function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), a.roll || 0);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false && a.y < 0.6) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0; if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};

window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  worldState(worldAt(f), f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  for (const c of clouds) c.quaternion.copy(camera.quaternion);
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
