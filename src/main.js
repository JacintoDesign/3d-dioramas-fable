import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { worlds } from './worlds/index.js';
import { R, FLOOR, lerp } from './lib/kit.js';
import { GLYPHS, ICONS } from './ui/icons.js';

const $ = (id) => document.getElementById(id);
const app = $('app'), canvas = $('stage');
const pad = (n) => String(n).padStart(2, '0');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = matchMedia('(max-width: 860px)');

/* ───────────── renderer & scene ───────────── */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
const HOME = { theta: 0.72, phi: 1.1 };

const hemi = new THREE.HemisphereLight();
const sun = new THREE.DirectionalLight();
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8.5, right: 8.5, top: 8.5, bottom: -8.5, near: 1, far: 50 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);

// the plinth every world sits on
{
  const wood = new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.5 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b08d57', roughness: 0.32, metalness: 0.9 });
  const disc = (rt, rb, h, y, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 96), mat);
    m.position.y = y - h / 2;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  };
  disc(R + 0.07, R + 0.07, 0.08, FLOOR + 0.01, brass);
  disc(R + 0.28, R + 0.4, 0.4, FLOOR - 0.07, wood);
  disc(R + 0.5, R + 0.5, 0.07, FLOOR - 0.47, wood);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.2 }));
  floor.position.y = FLOOR - 0.54;
  floor.receiveShadow = true;
  scene.add(floor);
}

/* ───────────── camera ───────────── */

const controls = new OrbitControls(camera, canvas);
Object.assign(controls, {
  enablePan: false, enableDamping: true, dampingFactor: 0.07, zoomSpeed: 0.8, rotateSpeed: 0.75,
  minPolarAngle: 0.2, maxPolarAngle: 1.5, autoRotate: !reducedMotion, autoRotateSpeed: 0.7,
});

let index = -1;
let fit = 20; // camera distance that frames the diorama in the free area of the screen
let fly = null; // in-flight camera move: { radius, y, theta?, phi?, ttl }
const sph = new THREE.Spherical(), offset = new THREE.Vector3();

function flyTo(goal, instant = false) {
  if (instant) {
    controls.target.set(0, goal.y, 0);
    camera.position.setFromSphericalCoords(goal.radius, goal.phi ?? HOME.phi, goal.theta ?? HOME.theta).add(controls.target);
    fly = null;
  } else fly = { ...goal, ttl: 1.8 };
}
controls.addEventListener('start', () => (fly = null));

function stepFly(dt) {
  if (!fly) return;
  const k = 1 - Math.exp(-dt * 4.5);
  sph.setFromVector3(offset.copy(camera.position).sub(controls.target));
  sph.radius = lerp(sph.radius, fly.radius, k);
  if (fly.phi != null) sph.phi = lerp(sph.phi, fly.phi, k);
  if (fly.theta != null) sph.theta += Math.atan2(Math.sin(fly.theta - sph.theta), Math.cos(fly.theta - sph.theta)) * k;
  controls.target.y = lerp(controls.target.y, fly.y, k);
  camera.position.setFromSpherical(sph).add(controls.target);
  if ((fly.ttl -= dt) <= 0) fly = null;
}

/** size the renderer, and frame the diorama in whatever space the interface leaves free */
function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  let l = 0, t = 0, b = 0;
  if (narrow.matches) {
    t = $('placard').getBoundingClientRect().bottom;
    b = h - $('toolbar').getBoundingClientRect().top;
  } else {
    l = document.querySelector('.collection').getBoundingClientRect().right;
    t = 24;
    b = 64;
  }
  camera.aspect = w / h;
  camera.setViewOffset(w, h, -l / 2, -(t - b) / 2, w, h);
  const zoom = worlds[Math.max(index, 0)].view.zoom;
  const next = Math.max((26 * h) / (w - l), (17.5 * h) / (h - t - b)) * zoom;
  const changed = Math.abs(next - fit) > 0.01;
  fit = next;
  controls.minDistance = fit * 0.4;
  controls.maxDistance = fit * 1.5;
  return changed;
}

/* ───────────── exhibits ───────────── */

const built = new Map(); // index → { group, update, s }
function instance(i) {
  if (!built.has(i)) {
    const inst = worlds[i].build();
    inst.s = 0;
    inst.group.visible = false;
    scene.add(inst.group);
    built.set(i, inst);
  }
  return built.get(i);
}

const easeOutBack = (x) => 1 + 2.3 * (x - 1) ** 3 + 1.3 * (x - 1) ** 2;
/** worlds rise out of the plinth like a pop-up book */
function pose(inst, e) {
  inst.group.visible = e > 0.002;
  inst.group.scale.set(1, Math.max(e, 0.002), 1);
  inst.group.position.y = FLOOR * (1 - e);
}

const target = { sky: new THREE.Color(), ground: new THREE.Color(), sun: new THREE.Color(), pos: new THREE.Vector3(), hemi: 1, sunI: 1, env: 0.3 };
function aimLights(L, instant) {
  target.sky.set(L.sky);
  target.ground.set(L.ground);
  target.sun.set(L.sun);
  target.pos.set(...L.sunPos).normalize().multiplyScalar(20);
  Object.assign(target, { hemi: L.hemi, sunI: L.sunI, env: L.env });
  if (instant) stepLights(1);
}
function stepLights(k) {
  hemi.color.lerp(target.sky, k);
  hemi.groundColor.lerp(target.ground, k);
  sun.color.lerp(target.sun, k);
  sun.position.lerp(target.pos, k);
  hemi.intensity = lerp(hemi.intensity, target.hemi, k);
  sun.intensity = lerp(sun.intensity, target.sunI, k);
  scene.environmentIntensity = lerp(scene.environmentIntensity, target.env, k);
}

function select(i, { instant = false, focus = false } = {}) {
  i = (i + worlds.length) % worlds.length;
  if (i === index) return;
  const first = index < 0;
  index = i;
  const w = worlds[i];
  instance(i);

  app.dataset.theme = w.theme;
  app.style.setProperty('--bg1', w.bg[0]);
  app.style.setProperty('--bg2', w.bg[1]);
  app.style.setProperty('--accent', w.accent);
  document.querySelector('meta[name=theme-color]').content = w.bg[0];
  document.title = `${w.name} — Terra`;
  if (!first) history.replaceState(null, '', `#${w.id}`);

  items.forEach((el, k) => (k === i ? el.setAttribute('aria-current', 'true') : el.removeAttribute('aria-current')));
  items[i].scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  if (focus) items[i].focus({ preventScroll: true });
  $('counter').textContent = `${pad(i + 1)} / ${pad(worlds.length)}`;

  const fill = () => {
    $('exhibit-no').textContent = `Exhibit ${pad(i + 1)}`;
    $('title').textContent = w.name;
    $('kicker').textContent = w.kicker;
    $('blurb').textContent = w.blurb;
    $('facts').innerHTML = w.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('placard').classList.remove('swap');
    layout();
  };
  if (instant) fill();
  else {
    $('placard').classList.add('swap');
    clearTimeout(select.timer);
    select.timer = setTimeout(fill, 190);
  }

  aimLights(w.light, instant);
  layout();
  flyTo({ radius: fit, y: w.view.y }, instant);
}

/* ───────────── interface ───────────── */

$('count').textContent = `${pad(worlds.length)} exhibits`;
$('list').innerHTML = worlds
  .map(
    (w, i) => `<li><button class="item" data-i="${i}" style="--c1:${w.bg[0]};--c2:${w.bg[1]};--ci:${w.accent}">
      <span class="chip">${GLYPHS[w.id]}</span>
      <span class="meta"><span class="no">N° ${pad(i + 1)}</span><span class="name">${w.name}</span></span>
      <span class="dot"></span>
    </button></li>`,
  )
  .join('');
const items = [...document.querySelectorAll('.item')];
$('list').addEventListener('click', (e) => {
  const el = e.target.closest('.item');
  if (el) select(+el.dataset.i);
});

for (const id of ['prev', 'next', 'rotate', 'reset']) $(id).innerHTML = ICONS[id];
$('prev').onclick = () => select(index - 1);
$('next').onclick = () => select(index + 1);

function toggleRotate() {
  controls.autoRotate = !controls.autoRotate;
  $('rotate').setAttribute('aria-pressed', controls.autoRotate);
}
$('rotate').setAttribute('aria-pressed', controls.autoRotate);
$('rotate').onclick = toggleRotate;

const resetCamera = () => flyTo({ radius: fit, y: worlds[index].view.y, ...HOME });
$('reset').onclick = resetCamera;

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
function toggleFullscreen() {
  const el = document.documentElement;
  if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (el.requestFullscreen || el.webkitRequestFullscreen).call(el)?.catch?.(() => {});
}
function syncFullscreen() {
  const on = !!fsElement();
  $('fullscreen').innerHTML = on ? ICONS.shrink : ICONS.expand;
  $('fullscreen').setAttribute('aria-pressed', on);
  $('fullscreen').setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen');
}
if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
  $('fullscreen').onclick = toggleFullscreen;
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('webkitfullscreenchange', syncFullscreen);
} else $('fullscreen').hidden = true;
syncFullscreen();

$('hint').textContent = matchMedia('(pointer: coarse)').matches
  ? 'Drag to orbit · Pinch to zoom'
  : 'Drag to orbit · Scroll to zoom · ← → to change exhibit';

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const inList = document.activeElement?.classList.contains('item');
  const onButton = document.activeElement?.tagName === 'BUTTON';
  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': select(index + 1, { focus: inList }); break;
    case 'ArrowLeft': case 'ArrowUp': select(index - 1, { focus: inList }); break;
    case 'Home': select(0, { focus: inList }); break;
    case 'End': select(worlds.length - 1, { focus: inList }); break;
    case ' ': if (onButton) return; toggleRotate(); break;
    case 'r': case 'R': resetCamera(); break;
    case 'f': case 'F': if (!$('fullscreen').hidden) toggleFullscreen(); break;
    default:
      if (e.key >= '1' && e.key <= String(worlds.length)) select(+e.key - 1, { focus: inList });
      else return;
  }
  e.preventDefault();
});

window.addEventListener('hashchange', () => {
  const i = worlds.findIndex((w) => w.id === location.hash.slice(1));
  if (i >= 0) select(i);
});

function relayout() {
  if (layout() && index >= 0) flyTo({ radius: fit, y: worlds[index].view.y });
}
window.addEventListener('resize', relayout);
narrow.addEventListener('change', relayout);

/* ───────────── go ───────────── */

select(Math.max(0, worlds.findIndex((w) => w.id === location.hash.slice(1))), { instant: true });
instance(index).s = reducedMotion ? 1 : 0;

let last = performance.now(), time = 0;
function frame(now) {
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
  last = now;
  time += dt;

  // outgoing worlds fold away first, then the current one rises
  let busy = false;
  for (const [i, inst] of built) {
    if (i === index || inst.s <= 0) continue;
    inst.s = Math.max(0, inst.s - dt / 0.24);
    pose(inst, inst.s * inst.s);
    if (inst.s > 0) {
      inst.update(time, dt);
      busy = true;
    }
  }
  const cur = built.get(index);
  if (!busy && cur.s < 1) cur.s = Math.min(1, cur.s + dt / 0.85);
  pose(cur, easeOutBack(cur.s));
  cur.update(time, dt);

  stepLights(1 - Math.exp(-dt * 5));
  stepFly(dt);
  controls.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

if (import.meta.env.DEV) window.__terra = { scene, camera, controls, renderer, built, select, frame };
