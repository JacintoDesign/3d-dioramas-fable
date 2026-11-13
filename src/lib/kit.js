// Terra kit — the shared toolbox every diorama is built from.
// Everything here is procedural: seeded noise, a disc-shaped terrain slab,
// a geometry batcher that bakes props into one mesh, water, smoke, particles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const R = 5; // radius of every diorama
export const FLOOR = -1.4; // underside of the earth slab
export const TAU = Math.PI * 2;

/* ───────────── maths ───────────── */

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** distance from point to segment, in the xz plane */
export const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
/** y-rotation that points a prop's local +x along (dx, dz) */
export const face = (dx, dz) => Math.atan2(-dz, dx);

/** seeded PRNG (mulberry32) with a few conveniences */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

/** seeded value noise + fractal sum, both in 0..1 */
export function makeNoise(seed = 1) {
  const hash = (x, y) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
  };
  const fbm = (x, y, oct = 4) => {
    let amp = 0.5, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * noise(x * f, y * f);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
  return { noise, fbm };
}

/* ───────────── colour ───────────── */

const colorCache = new Map();
const asColor = (c) => {
  if (c.isColor) return c;
  let v = colorCache.get(c);
  if (!v) colorCache.set(c, (v = new THREE.Color(c)));
  return v;
};
const mixed = new THREE.Color();
/** blend two colours. Returns a shared scratch Color — nest only in the first argument. */
export const mix = (a, b, t) => mixed.copy(asColor(a)).lerp(asColor(b), clamp(t));

/* ───────────── geometry ───────────── */

/** primitives. box / cyl / cone / prism sit on their base (y from 0 up). */
export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0),
  cyl: (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0),
  cone: (r, h, seg = 7) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0),
  ico: (r, detail = 0) => new THREE.IcosahedronGeometry(r, detail),
  dome: (r, seg = 16) => new THREE.SphereGeometry(r, seg, 6, 0, TAU, 0, Math.PI / 2),
  /** triangular prism: gable in the xy plane, ridge running along z */
  prism: (w, h, d) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
  },
  /** thin rod between two points */
  beam: (p1, p2, r = 0.02, seg = 5) => {
    const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2);
    const dir = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(r, r, dir.length(), seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  },
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const compose = (p = [0, 0, 0], r = [0, 0, 0], s = 1) => {
  _p.set(p[0], p[1], p[2]);
  _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  typeof s === 'number' ? _s.setScalar(s) : _s.set(s[0], s[1], s[2]);
  return _m.compose(_p, _q, _s);
};

/**
 * Collects coloured primitives and bakes them into a single flat-shaded mesh,
 * so a diorama with hundreds of props still costs one draw call.
 */
export class Batch {
  constructor() {
    this.parts = [];
    this.parent = new THREE.Matrix4();
  }
  /** add a primitive. p = position, r = euler xyz, s = scale (number or [x,y,z]) */
  add(geo, color, { p, r, s } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute('uv');
    g.applyMatrix4(compose(p, r, s).premultiply(this.parent));
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(color);
    for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return this;
  }
  /** run fn with every add() placed relative to a position / y-rotation / scale */
  at(p, ry, s, fn) {
    const saved = this.parent.clone();
    this.parent.multiply(compose(p, [0, ry, 0], s));
    fn();
    this.parent.copy(saved);
    return this;
  }
  build(material = {}) {
    const geo = this.parts.length ? mergeGeometries(this.parts) : new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0, ...material }),
    );
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
}

/* ───────────── terrain ───────────── */

/** square grid squashed onto a disc — even facets with a clean round rim */
const discPoint = (u, v, radius) => [radius * u * Math.sqrt(1 - (v * v) / 2), radius * v * Math.sqrt(1 - (u * u) / 2)];

/**
 * The slab of earth each world stands on: a faceted height-field on top and a
 * cut-away wall of strata around the rim.
 * height(x,z) → y      color(x,y,z,ny) → colour (ny = how upward the facet faces)
 */
export function terrain({ height, color, strata, n = 76, seed = 5 }) {
  const rand = rng(seed);
  const N = n + 1;
  const V = new Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const [x, z] = discPoint((i / n) * 2 - 1, (j / n) * 2 - 1, R);
      V[j * N + i] = [x, height(x, z), z];
    }
  }
  const pos = [], col = [];
  const c = new THREE.Color();
  const tri = (a, b, d, fixed, jitter = 0.07) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) return;
    c.set(fixed ?? color((a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3, ny / len));
    const k = 1 + (rand() - 0.5) * jitter;
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]);
    for (let q = 0; q < 3; q++) col.push(c.r * k, c.g * k, c.b * k);
  };

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = V[j * N + i], b = V[j * N + i + 1], e = V[(j + 1) * N + i], d = V[(j + 1) * N + i + 1];
      if ((i + j) & 1) {
        tri(a, e, b);
        tri(b, e, d);
      } else {
        tri(a, e, d);
        tri(a, d, b);
      }
    }
  }

  // rim wall, banded into strata
  const ring = [];
  for (let i = 0; i <= n; i++) ring.push(V[i]);
  for (let j = 1; j <= n; j++) ring.push(V[j * N + n]);
  for (let i = n - 1; i >= 0; i--) ring.push(V[n * N + i]);
  for (let j = n - 1; j >= 1; j--) ring.push(V[j * N]);
  const levels = [-0.45, -0.95, FLOOR];
  for (let k = 0; k < ring.length; k++) {
    const A = ring[k], B = ring[(k + 1) % ring.length];
    let ya = A[1], yb = B[1];
    for (let s = 0; s < 3; s++) {
      const la = Math.min(ya, levels[s]), lb = Math.min(yb, levels[s]);
      const At = [A[0], ya, A[2]], Bt = [B[0], yb, B[2]], Ab = [A[0], la, A[2]], Bb = [B[0], lb, B[2]];
      tri(At, Bt, Bb, strata[s], 0.05);
      tri(At, Bb, Ab, strata[s], 0.05);
      ya = la;
      yb = lb;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/* ───────────── water ───────────── */

/**
 * Faceted, gently rippling water. With `wall`, it becomes a full sea that is
 * sliced at the rim like the side of an aquarium.
 */
export function water({ level = 0, radius = R - 0.02, center = [0, 0], color = '#3aa7c9', opacity = 0.74, wall = false, n = 30, amp = 0.022 }) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.3, metalness: 0, envMapIntensity: 0.35, flatShading: true });
  const N = n + 1;
  const pos = new Float32Array(N * N * 3);
  const fixed = new Uint8Array(N * N);
  const idx = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const [x, z] = discPoint((i / n) * 2 - 1, (j / n) * 2 - 1, radius);
      pos.set([x + center[0], level, z + center[1]], k * 3);
      fixed[k] = i === 0 || j === 0 || i === n || j === n ? 1 : 0;
      if (i < n && j < n) idx.push(k, k + N, k + 1, k + 1, k + N, k + N + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const top = new THREE.Mesh(geo, mat);
  top.receiveShadow = true;
  group.add(top);

  if (wall) {
    const bottom = FLOOR + 0.4;
    const side = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, level - bottom, 128, 1, true), mat);
    side.position.set(center[0], (level + bottom) / 2, center[1]);
    group.add(side);
  }

  const update = (t) => {
    for (let k = 0; k < N * N; k++) {
      if (fixed[k]) continue;
      const x = pos[k * 3], z = pos[k * 3 + 2];
      pos[k * 3 + 1] = level + amp * (Math.sin(x * 2.3 + t * 1.3) + Math.cos(z * 1.9 - t * 1.1) + Math.sin((x + z) * 1.4 + t * 0.7)) * 0.5;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { group, update };
}

/* ───────────── atmosphere ───────────── */

let softDot;
/** soft round sprite texture, painted on a canvas */
function dotTexture() {
  if (softDot) return softDot;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  softDot = new THREE.CanvasTexture(cv);
  softDot.colorSpace = THREE.SRGBColorSpace;
  return softDot;
}

/** additive halo for lamps, lava and beacons */
export function glow(color, size = 1, opacity = 1) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: dotTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  s.scale.setScalar(size);
  return s;
}

/** point cloud; place(i) → [x,y,z] */
export function particles({ count, place, color = '#ffffff', size = 0.06, opacity = 1, additive = false, attenuate = true }) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) pos.set(place(i), i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color, size, opacity, map: dotTexture(), transparent: true, depthWrite: false, sizeAttenuation: attenuate,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }),
  );
  pts.frustumCulled = false;
  return pts;
}

/** a looping column of faceted puffs */
export function smoke({ origin, color = '#ffffff', count = 7, rise = 1.6, spread = 0.35, size = 0.14, grow = 2.2, speed = 0.16, opacity = 0.85 }) {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true, transparent: true, opacity, roughness: 1 }));
    puffs.push(m);
    group.add(m);
  }
  const update = (t) => {
    puffs.forEach((m, i) => {
      const ph = (t * speed + i / count) % 1;
      m.position.set(
        origin[0] + Math.sin(i * 12.9 + ph * 3) * spread * ph,
        origin[1] + ph * rise,
        origin[2] + Math.cos(i * 7.3 + ph * 2.5) * spread * ph,
      );
      m.scale.setScalar(size * (0.5 + ph * grow));
      m.rotation.y = i + ph * 2;
      m.material.opacity = opacity * (1 - ph) * smooth(0, 0.12, ph);
    });
  };
  return { group, update };
}

/** a drifting low-poly cloud */
export function cloud(rand, scale = 1) {
  const b = new Batch();
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    b.add(G.ico(rand.range(0.3, 0.55), 1), '#ffffff', {
      p: [(i - (n - 1) / 2) * 0.42 + rand.range(-0.1, 0.1), rand.range(-0.06, 0.12), rand.range(-0.2, 0.2)],
      s: [1, 0.72, 1],
    });
  }
  const mesh = b.build({ roughness: 1 });
  mesh.receiveShadow = false;
  mesh.scale.setScalar(scale);
  return mesh;
}

/** place an object on a circle, facing its direction of travel (local +x forward) */
export function orbitPose(obj, a, r, y, cx = 0, cz = 0, reverse = false) {
  obj.position.set(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
  obj.rotation.y = -a - Math.PI / 2 + (reverse ? Math.PI : 0);
}

/** a few birds wheeling overhead */
export function birds({ count = 4, radius = 3, height = 3, color = '#30343a', size = 0.16, speed = 0.3, rand }) {
  const group = new THREE.Group();
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.3, 0, 0, 0.3, 1, 0, 0.12], 3));
  wing.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, flatShading: true, roughness: 1 });
  const flock = [];
  for (let i = 0; i < count; i++) {
    const bird = new THREE.Group();
    const r = new THREE.Mesh(wing, mat), l = new THREE.Mesh(wing, mat);
    l.scale.x = -1;
    bird.add(r, l);
    bird.scale.setScalar(size);
    group.add(bird);
    flock.push({ bird, r, l, rad: radius * rand.range(0.55, 1), y: height + rand.range(-0.4, 0.4), ph: rand() * TAU, sp: speed * rand.range(0.7, 1.2) });
  }
  const update = (t) => {
    for (const f of flock) {
      const a = f.ph + t * f.sp;
      // wings span local x, so the body flies along local z
      f.bird.position.set(Math.cos(a) * f.rad, f.y + Math.sin(t * 0.6 + f.ph) * 0.15, Math.sin(a) * f.rad);
      f.bird.rotation.y = -a;
      const flap = Math.sin(t * 7 + f.ph * 3) * 0.55;
      f.r.rotation.z = flap;
      f.l.rotation.z = -flap;
    }
  };
  return { group, update };
}

/** small fish circling under the surface (koi, reef fish) */
export function swimmers({ count, center, radius, y, colors, size = 0.1, speed = 0.5, rand }) {
  const group = new THREE.Group();
  const school = [];
  for (let i = 0; i < count; i++) {
    const b = new Batch();
    const c = rand.pick(colors);
    b.add(G.ico(1, 1), c, { s: [1, 0.42, 0.34] });
    b.add(G.cone(0.42, 0.7, 4), rand.pick(colors), { p: [-1.45, 0, 0], r: [0, 0, -Math.PI / 2], s: [1, 1, 0.25] });
    const mesh = b.build({ roughness: 0.5 });
    mesh.castShadow = false;
    mesh.scale.setScalar(size * rand.range(0.8, 1.2));
    group.add(mesh);
    school.push({ mesh, r: radius * rand.range(0.35, 1), ph: rand() * TAU, sp: speed * rand.range(0.6, 1.3) * (rand() < 0.5 ? -1 : 1), y: y + rand.range(-0.04, 0.04) });
  }
  const update = (t) => {
    for (const f of school) {
      const a = f.ph + t * f.sp;
      orbitPose(f.mesh, a, f.r + Math.sin(t * 0.7 + f.ph) * 0.08, f.y, center[0], center[1], f.sp < 0);
      f.mesh.rotation.y += Math.sin(t * 6 + f.ph) * 0.18;
    }
  };
  return { group, update };
}

/** rejection-sample scattered spots; `taken` entries are [x, z, extraClearance] */
export function scatter(rand, count, accept, { rmax = R - 0.45, gap = 0.35, taken = [] } = {}) {
  const out = [];
  for (let k = 0; k < count * 40 && out.length < count; k++) {
    const a = rand() * TAU, r = Math.sqrt(rand()) * rmax;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!accept(x, z)) continue;
    if (taken.some((p) => (p[0] - x) ** 2 + (p[1] - z) ** 2 < (gap + (p[2] || 0)) ** 2)) continue;
    taken.push([x, z, 0]);
    out.push([x, z]);
  }
  return out;
}
