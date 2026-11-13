import * as THREE from 'three';
import { TAU, rng, makeNoise, smooth, lerp, mix, G, Batch, terrain, water, scatter, birds, orbitPose } from '../lib/kit.js';
import { palm, rock, bush, person, quadruped } from '../lib/props.js';

const OASIS = [0.3, 0.4], HOUSE = [-2.6, 0.9], LEVEL = -0.1, TRAIL = 4.25;
const BANDS = ['#c46a3a', '#d98a52', '#b85c34', '#e0a06a', '#c9743f'];

function mesa(b, rand, r, height) {
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const f = i / layers;
    b.add(G.cyl(r * (0.78 - f * 0.3) * rand.range(0.9, 1.05), r * (1 - f * 0.32), height / layers + 0.01, 7), BANDS[i % BANDS.length], {
      p: [rand.range(-0.04, 0.04), (i * height) / layers, rand.range(-0.04, 0.04)],
      r: [0, rand() * TAU, 0],
    });
  }
}

function cactus(b, rand) {
  const c = rand.pick(['#4f8a54', '#5a9660']);
  const hgt = rand.range(0.35, 0.55);
  b.add(G.cyl(0.055, 0.065, hgt, 7), c);
  b.add(G.ico(0.055, 1), c, { p: [0, hgt, 0] });
  for (const s of [1, -1]) {
    if (rand() < 0.25) continue;
    const y = hgt * rand.range(0.35, 0.55), up = rand.range(0.12, 0.2);
    b.add(G.cyl(0.033, 0.033, 0.14, 6), c, { p: [0, y, 0], r: [0, 0, (-s * Math.PI) / 2] });
    b.add(G.cyl(0.033, 0.033, up, 6), c, { p: [s * 0.13, y - 0.02, 0] });
    b.add(G.ico(0.033, 1), c, { p: [s * 0.13, y - 0.02 + up, 0] });
  }
}

function camel() {
  const b = new Batch();
  const c = '#c79a5e';
  const [hx, hy] = quadruped(b, { body: c, leg: '#b0844c', len: 0.34, height: 0.2, girth: 0.12, neck: 0.2 });
  b.add(G.ico(0.085, 1), c, { p: [-0.02, 0.36, 0], s: [1.1, 0.9, 0.7] });
  b.add(G.box(0.15, 0.03, 0.15), '#b8402f', { p: [-0.02, 0.4, 0] });
  b.add(G.box(0.1, 0.07, 0.19), '#e8d9b8', { p: [-0.02, 0.3, 0] });
  b.add(G.box(0.03, 0.03, 0.03), '#3a2a1f', { p: [hx + 0.05, hy, 0] });
  return b.build();
}

export default {
  id: 'desert',
  name: 'Desert Oasis',
  kicker: 'Erg dunes · golden hour',
  blurb: 'A spring-fed pool holds its ground against a sea of sand. Date palms crowd the bank while a camel train files past banded sandstone mesas.',
  facts: [['Biome', 'Hot desert'], ['Elevation', '310 m'], ['Air', '38 °C']],
  theme: 'light',
  bg: ['#fbecd2', '#e2a56c'],
  accent: '#b4552a',
  light: { sky: '#ffe6c2', ground: '#b5683a', hemi: 0.85, sun: '#ffcf96', sunI: 3.0, sunPos: [7, 4.6, 4], env: 0.3 },
  view: { y: 0.4, zoom: 1 },

  build() {
    const rand = rng(202);
    const { fbm } = makeNoise(23);
    const group = new THREE.Group();

    const h = (x, z) => {
      const d = Math.hypot(x - OASIS[0], z - OASIS[1]);
      const warp = fbm(x * 0.22 + 5, z * 0.22 + 1) * 4;
      const ridge = 1 - Math.abs(Math.sin(x * 0.75 + z * 0.5 + warp));
      let y = 0.12 + (ridge ** 1.6 * 0.95 + fbm(x * 0.5, z * 0.5) * 0.25) * smooth(1.4, 3.6, d);
      y = lerp(0.3, y, smooth(0.5, 1.05, Math.hypot(x - HOUSE[0], z - HOUSE[1])));
      y = lerp(-0.45, y, smooth(0.5, 1.7, d));
      return y;
    };
    const oasisDist = (x, z) => Math.hypot(x - OASIS[0], z - OASIS[1]);

    group.add(terrain({
      height: h,
      strata: ['#dba865', '#c4834a', '#9a6238'],
      color: (x, y, z, ny) => {
        if (y < LEVEL + 0.04) return mix('#b89a62', '#dcc48c', smooth(-0.45, LEVEL, y));
        const sand = mix(mix('#e2b06a', '#f3d394', smooth(0.2, 1.0, y)), '#d1935a', (1 - ny) * 2.4);
        const green = smooth(2.3, 1.5, oasisDist(x, z) + (fbm(x * 1.5, z * 1.5) - 0.5) * 0.8);
        return green > 0 ? mix(sand, '#7fa650', green) : sand;
      },
    }));

    const pool = water({ level: LEVEL, radius: 1.5, center: OASIS, color: '#3fb4b8', opacity: 0.8, n: 14, amp: 0.01 });
    group.add(pool.group);

    const b = new Batch();
    const taken = [[OASIS[0], OASIS[1], 1.15], [HOUSE[0], HOUSE[1], 0.75], [-2.0, -2.1, 0.8], [2.3, -2.2, 0.6]];
    const inside = (x, z) => Math.hypot(x, z) < TRAIL - 0.45;

    // palms and reeds around the pool
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + rand.range(-0.2, 0.2), d = rand.range(1.32, 2.0);
      const x = OASIS[0] + Math.cos(a) * d, z = OASIS[1] + Math.sin(a) * d;
      taken.push([x, z, 0.1]);
      b.at([x, h(x, z) - 0.02, z], a + Math.PI + rand.range(-0.6, 0.6), rand.range(0.85, 1.15), () => palm(b, rand));
    }
    for (let i = 0; i < 18; i++) {
      const a = rand() * TAU, d = rand.range(1.12, 1.25);
      const x = OASIS[0] + Math.cos(a) * d, z = OASIS[1] + Math.sin(a) * d;
      b.add(G.cone(0.014, rand.range(0.16, 0.3), 4), '#6f9a4a', { p: [x, Math.max(h(x, z), LEVEL) - 0.02, z] });
    }

    // adobe house
    b.at([HOUSE[0], 0.3, HOUSE[1]], -0.5, 1, () => {
      b.add(G.box(0.95, 0.75, 0.72), '#e6c99c', { p: [0, -0.25, 0] });
      b.add(G.box(0.5, 0.36, 0.5), '#dcbd8c', { p: [-0.5, -0.25 + 0.4, -0.02] });
      b.add(G.dome(0.26, 10), '#f3e3c3', { p: [0.12, 0.5, 0] });
      b.add(G.box(0.03, 0.26, 0.15), '#5a3a26', { p: [0.47, 0, 0.12] });
      for (const z of [-0.22, 0.02]) b.add(G.box(0.03, 0.08, 0.07), '#4a3020', { p: [0.47, 0.28, z] });
      for (let i = 0; i < 4; i++) b.add(G.cyl(0.018, 0.018, 0.1, 5), '#6b4a30', { p: [0.46, 0.42, -0.27 + i * 0.18], r: [0, 0, -Math.PI / 2] });
      b.add(G.box(0.34, 0.02, 0.5), '#c8553d', { p: [0.62, 0.3, 0.05], r: [0, 0, -0.35] });
      for (const z of [-0.18, 0.28]) b.add(G.cyl(0.012, 0.012, 0.26, 5), '#6b4a30', { p: [0.76, 0, z] });
      for (const [x, z, s] of [[0.62, -0.42, 1], [0.74, -0.33, 0.7], [0.56, 0.48, 0.8]]) b.add(G.cyl(0.03, 0.045, 0.09, 7), '#b5623a', { p: [x, 0, z], s });
    });

    // well
    const wx = -1.5, wz = 1.9, wy = h(wx, wz);
    b.add(G.cyl(0.13, 0.14, 0.12, 10), '#cdbb99', { p: [wx, wy, wz] });
    b.add(G.cyl(0.09, 0.09, 0.02, 10), '#3a8f9a', { p: [wx, wy + 0.1, wz] });
    for (const s of [-1, 1]) b.add(G.box(0.02, 0.3, 0.02), '#6b4a30', { p: [wx + s * 0.12, wy, wz] });
    b.add(G.box(0.3, 0.02, 0.03), '#6b4a30', { p: [wx, wy + 0.29, wz] });
    taken.push([wx, wz, 0.2]);

    // tents
    for (const [x, z, ry, c] of [[1.9, 2.3, 0.7, '#f4ead8'], [2.6, 1.5, 2.0, '#c8553d']]) {
      taken.push([x, z, 0.45]);
      b.at([x, h(x, z) - 0.02, z], ry, 1, () => {
        b.add(G.prism(0.62, 0.4, 0.74), c);
        b.add(G.prism(0.22, 0.24, 0.76), '#4a3020');
        b.add(G.cyl(0.01, 0.01, 0.6, 4), '#6b4a30');
        b.add(G.box(0.14, 0.07, 0.008), '#d9793b', { p: [0.07, 0.52, 0] });
      });
    }

    // mesas and a rock arch
    b.at([-2.0, h(-2.0, -2.1) - 0.15, -2.1], 0, 1, () => mesa(b, rand, 0.75, 1.5));
    b.at([-1.25, h(-1.25, -2.75) - 0.1, -2.75], 0, 1, () => mesa(b, rand, 0.4, 0.8));
    b.at([2.3, h(2.3, -2.2) - 0.15, -2.2], 0.6, 1, () => {
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) b.add(G.box(0.3 - i * 0.02, 0.24, 0.34), BANDS[(i + (s > 0 ? 1 : 0)) % 5], { p: [s * 0.42, i * 0.23, 0], r: [0, rand.range(-0.2, 0.2), 0] });
      }
      b.add(G.box(1.25, 0.2, 0.36), BANDS[3], { p: [0, 0.92, 0] });
      b.add(G.box(0.9, 0.12, 0.3), BANDS[0], { p: [0.05, 1.1, 0] });
    });

    const dunes = (x, z) => oasisDist(x, z) > 2.4 && inside(x, z);
    for (const [x, z] of scatter(rand, 11, dunes, { taken, gap: 0.5 })) b.at([x, h(x, z) - 0.02, z], rand() * TAU, rand.range(0.8, 1.2), () => cactus(b, rand));
    for (const [x, z] of scatter(rand, 16, dunes, { taken, gap: 0.25 })) b.at([x, h(x, z), z], 0, 1, () => rock(b, rand, rand.range(0.06, 0.16), BANDS));
    for (const [x, z] of scatter(rand, 12, dunes, { taken, gap: 0.25 })) b.at([x, h(x, z), z], 0, 1, () => bush(b, rand, ['#a89a5a', '#8f8a4f'], 0.08));
    for (const [x, z] of scatter(rand, 10, (x, z) => oasisDist(x, z) > 1.3 && oasisDist(x, z) < 2.2, { taken, gap: 0.2 })) b.at([x, h(x, z), z], 0, 1, () => bush(b, rand, ['#6f9a4a', '#5a8a45'], 0.11));
    group.add(b.build());

    // caravan circling the rim
    const camelMesh = camel();
    const leaderBatch = new Batch();
    person(leaderBatch, '#f4ead8', '#b98a5e', '#3a5a8a');
    const caravan = [leaderBatch.build(), camelMesh, camelMesh.clone(), camelMesh.clone()];
    caravan.forEach((m) => group.add(m));
    const vultures = birds({ count: 2, radius: 2.6, height: 3.4, color: '#3a2e28', size: 0.2, speed: 0.22, rand });
    group.add(vultures.group);

    return {
      group,
      update(t) {
        pool.update(t);
        vultures.update(t);
        caravan.forEach((m, i) => {
          const a = t * 0.05 - i * 0.105 - (i ? 0.02 : 0);
          const x = Math.cos(a) * TRAIL, z = Math.sin(a) * TRAIL;
          orbitPose(m, a, TRAIL, h(x, z) + Math.abs(Math.sin(t * 3.2 + i * 1.3)) * 0.012);
        });
      },
    };
  },
};
