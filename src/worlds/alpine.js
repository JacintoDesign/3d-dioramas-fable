import * as THREE from 'three';
import { R, TAU, rng, makeNoise, smooth, lerp, mix, G, Batch, terrain, water, scatter, birds, cloud, particles } from '../lib/kit.js';
import { pine, rock } from '../lib/props.js';

// [x, z, height, width]
const PEAKS = [[-1.7, -1.5, 3.8, 3.3], [1.6, -2.3, 2.8, 2.7], [-3.3, 1.3, 2.0, 2.3]];
const LAKE = [2.0, 2.1], CHALET = [-0.3, 2.6], LEVEL = -0.08;

function chalet(b) {
  b.add(G.box(0.95, 0.5, 0.74), '#b9b4aa', { p: [0, -0.3, 0] }); // stone storey
  b.add(G.box(0.97, 0.3, 0.76), '#8a5a36', { p: [0, 0.2, 0] }); // timber storey
  b.add(G.prism(0.98, 0.42, 1.2), '#5a3d2b', { p: [0, 0.48, 0], r: [0, Math.PI / 2, 0] });
  b.add(G.prism(0.84, 0.36, 1.22), '#f1f5f9', { p: [0, 0.56, 0], r: [0, Math.PI / 2, 0] }); // snow on the ridge
  b.add(G.box(1.05, 0.03, 0.14), '#6b452b', { p: [0, 0.2, 0.44] }); // balcony
  b.add(G.box(1.05, 0.08, 0.02), '#6b452b', { p: [0, 0.23, 0.5] });
  b.add(G.box(1.0, 0.035, 0.06), '#c8402f', { p: [0, 0.3, 0.5] }); // flower boxes
  b.add(G.box(0.16, 0.2, 0.03), '#3a2a1f', { p: [0.2, 0, 0.37] });
  for (const x of [-0.28, 0, 0.28]) b.add(G.box(0.13, 0.12, 0.03), '#ffd98a', { p: [x, 0.3, 0.375] });
  for (const x of [-0.25]) b.add(G.box(0.13, 0.11, 0.03), '#ffd98a', { p: [x, 0.04, 0.37] });
  b.add(G.box(0.14, 0.3, 0.14), '#8a857c', { p: [-0.3, 0.62, -0.15] });
}

function sheep(b) {
  b.add(G.ico(0.07, 1), '#f3f0e8', { p: [0, 0.09, 0], s: [1.3, 0.9, 0.9] });
  b.add(G.box(0.045, 0.045, 0.045), '#2f2a28', { p: [0.1, 0.09, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(G.box(0.015, 0.05, 0.015), '#2f2a28', { p: [sx * 0.05, 0, sz * 0.03] });
}

export default {
  id: 'alpine',
  name: 'Alpine Peaks',
  kicker: 'High massif · clear noon',
  blurb: 'Granite summits carry their snow above a meadow, a timber chalet and a glacial tarn. A red gondola climbs the cable toward the upper station.',
  facts: [['Biome', 'Alpine tundra'], ['Summit', '3,840 m'], ['Air', '−6 °C']],
  theme: 'light',
  bg: ['#f1f6fc', '#9bb8d8'],
  accent: '#2d5f97',
  light: { sky: '#c4dcff', ground: '#5a6a7a', hemi: 0.95, sun: '#fff5e6', sunI: 2.9, sunPos: [6, 8, 5], env: 0.35 },
  view: { y: 1.25, zoom: 1.1 },

  build() {
    const rand = rng(303);
    const { fbm } = makeNoise(37);
    const group = new THREE.Group();

    const ridged = (x, z) => 1 - Math.abs(2 * fbm(x, z) - 1);
    const h = (x, z) => {
      let m = 0;
      for (const [px, pz, H, W] of PEAKS) m = Math.max(m, H * Math.max(0, 1 - Math.hypot(x - px, z - pz) / W) ** 1.25);
      let y = 0.12 + m * (0.72 + 0.5 * ridged(x * 0.55 + 4, z * 0.55)) + fbm(x * 0.4 + 9, z * 0.4) * 0.3;
      y = lerp(-0.4, y, smooth(0.5, 1.6, Math.hypot(x - LAKE[0], z - LAKE[1])));
      y = lerp(0.35, y, smooth(0.45, 1.0, Math.hypot(x - CHALET[0], z - CHALET[1])));
      return y;
    };
    const gentle = (x, z) => Math.abs(h(x + 0.2, z) - h(x - 0.2, z)) + Math.abs(h(x, z + 0.2) - h(x, z - 0.2)) < 0.42;

    group.add(terrain({
      height: h,
      strata: ['#7b7770', '#625e58', '#4b4844'],
      color: (x, y, z, ny) => {
        if (y < LEVEL + 0.05) return mix('#5f6b6a', '#8c948c', smooth(-0.4, LEVEL, y));
        const n = fbm(x * 1.3 + 2, z * 1.3);
        if (y > 1.75 + n * 0.7 && ny > 0.45) return mix('#dfe9f5', '#ffffff', ny);
        if (ny < 0.74 || y > 1.15 + n * 0.5) return mix('#6d7480', '#9197a0', n);
        return mix(mix('#5f9a52', '#8ab860', n), '#6e8f5a', smooth(0.5, 1.2, y));
      },
    }));

    const lake = water({ level: LEVEL, radius: 1.5, center: LAKE, color: '#3f9fc4', opacity: 0.82, n: 14, amp: 0.01 });
    group.add(lake.group);

    const b = new Batch();
    const taken = [[CHALET[0], CHALET[1], 0.75], [LAKE[0], LAKE[1], 1.05]];
    b.at([CHALET[0], 0.35, CHALET[1]], -0.35, 1, () => chalet(b));

    // cable car: valley station → pylon → upper station
    const A = [-1.15, 0, 1.9], B = [-2.05, 0, -0.25];
    A[1] = h(A[0], A[2]) + 0.5;
    B[1] = h(B[0], B[2]) + 0.45;
    let lift = 0;
    for (let i = 1; i < 14; i++) {
      const f = i / 14;
      lift = Math.max(lift, h(lerp(A[0], B[0], f), lerp(A[2], B[2], f)) + 0.34 - lerp(A[1], B[1], f));
    }
    A[1] += lift;
    B[1] += lift;
    b.add(G.beam(A, B, 0.008, 4), '#2f3338');
    for (const [P, hut] of [[A, '#8a5a36'], [B, '#9aa0a8'], [[lerp(A[0], B[0], 0.5), lerp(A[1], B[1], 0.5), lerp(A[2], B[2], 0.5)], null]]) {
      const gy = h(P[0], P[2]);
      b.add(G.beam([P[0], gy - 0.2, P[2]], P, 0.03, 6), '#5c6168');
      b.add(G.box(0.2, 0.03, 0.06), '#5c6168', { p: [P[0], P[1], P[2]] });
      if (hut) {
        b.add(G.box(0.34, 0.24, 0.3), hut, { p: [P[0] + 0.02, gy - 0.05, P[2] + 0.24] });
        b.add(G.box(0.4, 0.04, 0.36), '#f1f5f9', { p: [P[0] + 0.02, gy + 0.19, P[2] + 0.24] });
      }
      taken.push([P[0], P[2], 0.25]);
    }

    // summit cross
    const [sx, sz] = PEAKS[0];
    let top = [sx, h(sx, sz), sz];
    for (let i = 0; i < 200; i++) {
      const x = sx + rand.range(-0.6, 0.6), z = sz + rand.range(-0.6, 0.6), y = h(x, z);
      if (y > top[1]) top = [x, y, z];
    }
    b.add(G.box(0.02, 0.28, 0.02), '#3a2a1f', { p: [top[0], top[1] - 0.04, top[2]] });
    b.add(G.box(0.14, 0.02, 0.02), '#3a2a1f', { p: [top[0], top[1] + 0.15, top[2]] });

    const woods = (x, z) => { const y = h(x, z); return y > 0.08 && y < 1.35 && gentle(x, z); };
    for (const [x, z] of scatter(rand, 70, woods, { taken, gap: 0.36 })) {
      const y = h(x, z);
      b.at([x, y - 0.04, z], rand() * TAU, rand.range(0.55, 1.0), () => pine(b, rand, ['#2c5a48', '#356a52', '#24493c'], y > 0.75));
    }
    for (const [x, z] of scatter(rand, 22, (x, z) => h(x, z) > 0.05 && h(x, z) < 2.2, { taken, gap: 0.2 })) b.at([x, h(x, z), z], 0, 1, () => rock(b, rand, rand.range(0.07, 0.2), ['#7d828a', '#8f949c', '#6a6f78']));
    for (const [x, z] of scatter(rand, 7, (x, z) => Math.hypot(x - 0.9, z - 3.4) < 1.1 && h(x, z) > 0.05, { taken, gap: 0.22 })) b.at([x, h(x, z), z], rand() * TAU, 1, () => sheep(b));
    // hay shed by the lake
    const hx = 3.3, hz = 0.6, hy = h(hx, hz);
    b.at([hx, hy - 0.03, hz], 0.9, 1, () => {
      b.add(G.box(0.36, 0.2, 0.3), '#7a5234');
      b.add(G.prism(0.46, 0.18, 0.4), '#f1f5f9', { p: [0, 0.2, 0] });
    });
    group.add(b.build());

    // gondola
    const gb = new Batch();
    gb.add(G.box(0.2, 0.15, 0.13), '#d23b2f');
    gb.add(G.box(0.205, 0.06, 0.135), '#f3ede2', { p: [0, 0.06, 0] });
    gb.add(G.box(0.22, 0.02, 0.15), '#8a1f1a', { p: [0, 0.15, 0] });
    gb.add(G.box(0.015, 0.16, 0.015), '#2f3338', { p: [0, 0.16, 0] });
    const gondola = gb.build();
    gondola.rotation.y = Math.atan2(-(B[2] - A[2]), B[0] - A[0]);
    group.add(gondola);

    const clouds = [];
    for (let i = 0; i < 5; i++) {
      const mesh = cloud(rand, rand.range(0.7, 1.15));
      clouds.push({ mesh, r: rand.range(2.2, 4.2), y: rand.range(2.3, 3.9), ph: rand() * TAU, sp: rand.range(0.02, 0.05) });
      group.add(mesh);
    }
    const flakes = particles({
      count: 260, color: '#ffffff', size: 0.07, opacity: 0.9,
      place: () => { const a = rand() * TAU, r = Math.sqrt(rand()) * R; return [Math.cos(a) * r, rand() * 5.2, Math.sin(a) * r]; },
    });
    const eagles = birds({ count: 2, radius: 3.2, height: 4.3, color: '#3a3430', size: 0.2, speed: 0.2, rand });
    group.add(flakes, eagles.group);

    return {
      group,
      update(t, dt) {
        lake.update(t);
        eagles.update(t);
        const f = 0.5 - 0.5 * Math.cos(t * 0.22);
        gondola.position.set(lerp(A[0], B[0], f), lerp(A[1], B[1], f) - 0.32, lerp(A[2], B[2], f));
        gondola.rotation.z = Math.sin(t * 1.3) * 0.04;
        for (const c of clouds) {
          const a = c.ph + t * c.sp;
          c.mesh.position.set(Math.cos(a) * c.r, c.y, Math.sin(a) * c.r);
        }
        const p = flakes.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) - dt * (0.28 + (i % 5) * 0.03);
          if (y < 0) y += 5.2;
          p.setY(i, y);
          p.setX(i, p.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.05);
        }
        p.needsUpdate = true;
      },
    };
  },
};
