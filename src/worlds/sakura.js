import * as THREE from 'three';
import { TAU, rng, makeNoise, smooth, lerp, mix, segDist, G, Batch, terrain, water, scatter, glow, particles, swimmers } from '../lib/kit.js';
import { rock, bush } from '../lib/props.js';

const POND = [0.9, 0.7], HILL = [-2.4, -2.2], ZEN = [-2.4, 2.3], TORII = [0.75, 3.75], LEVEL = -0.06;
const RED = '#c8372d', STONE = '#9a9891';
const PINKS = ['#f7b6c8', '#f39ab4', '#fbd0dc', '#fff0f4', '#f5a8c0'];

function sakura(b, rand) {
  const t = rand.range(0.5, 0.75);
  b.add(G.cyl(0.05, 0.085, t, 6), '#4a332b');
  for (let i = 0; i < 3; i++) {
    const az = (i / 3) * TAU + rand(), reach = rand.range(0.3, 0.42);
    const end = [Math.cos(az) * reach, t + rand.range(0.22, 0.42), Math.sin(az) * reach];
    b.add(G.beam([0, t * 0.85, 0], end, 0.026), '#4a332b');
    b.add(G.ico(rand.range(0.24, 0.34), 1), rand.pick(PINKS), { p: end, s: [1, 0.8, 1] });
    b.add(G.ico(rand.range(0.16, 0.24), 1), rand.pick(PINKS), { p: [end[0] * 1.5, end[1] - 0.06, end[2] * 1.5], s: [1, 0.8, 1] });
  }
  b.add(G.ico(0.34, 1), rand.pick(PINKS), { p: [0, t + 0.5, 0], s: [1, 0.82, 1] });
}

function torii(b) {
  for (const s of [-1, 1]) {
    b.add(G.cyl(0.07, 0.08, 0.06, 8), '#3a3436', { p: [s * 0.38, 0, 0] });
    b.add(G.cyl(0.045, 0.055, 0.9, 8), RED, { p: [s * 0.38, 0, 0] });
  }
  b.add(G.box(0.98, 0.06, 0.06), RED, { p: [0, 0.6, 0] });
  b.add(G.box(1.16, 0.07, 0.09), RED, { p: [0, 0.82, 0] });
  b.add(G.box(1.28, 0.04, 0.13), '#2b2325', { p: [0, 0.89, 0] });
  b.add(G.box(0.07, 0.16, 0.05), RED, { p: [0, 0.66, 0] });
}

function pagoda(b) {
  b.add(G.box(1.05, 0.35, 1.05), STONE, { p: [0, -0.25, 0] });
  let y = 0.1;
  for (let i = 0; i < 3; i++) {
    const w = 0.66 - i * 0.15;
    b.add(G.box(w, 0.3, w), '#f3ead8', { p: [0, y, 0] });
    b.add(G.box(w + 0.02, 0.05, w + 0.02), RED, { p: [0, y + 0.22, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(G.box(0.04, 0.3, 0.04), RED, { p: [(sx * w) / 2, y, (sz * w) / 2] });
    b.add(G.box(0.03, 0.16, 0.12), '#4a332b', { p: [w / 2, y, 0] });
    b.add(G.cone((w + 0.42) / 1.414, i === 2 ? 0.3 : 0.2, 4), '#3d4a52', { p: [0, y + 0.28, 0], r: [0, Math.PI / 4, 0] });
    y += 0.42;
  }
  b.add(G.cyl(0.012, 0.02, 0.3, 5), '#d4af5a', { p: [0, y + 0.1, 0] });
  b.add(G.ico(0.035, 1), '#d4af5a', { p: [0, y + 0.4, 0] });
}

function lantern(b) {
  b.add(G.cyl(0.06, 0.08, 0.05, 6), STONE);
  b.add(G.cyl(0.028, 0.028, 0.2, 6), STONE, { p: [0, 0.05, 0] });
  b.add(G.box(0.13, 0.03, 0.13), STONE, { p: [0, 0.25, 0] });
  b.add(G.box(0.08, 0.08, 0.08), '#ffe2a0', { p: [0, 0.28, 0] });
  b.add(G.cone(0.13, 0.08, 4), '#7d7b76', { p: [0, 0.36, 0], r: [0, Math.PI / 4, 0] });
}

/** arched bridge in local space: spans x from -L/2 to L/2 */
function bridge(b, L = 2.8, rise = 0.48, width = 0.44) {
  const Rb = (L * L / 4 + rise * rise) / (2 * rise), a = Math.asin(L / 2 / Rb);
  const n = 15, posts = [[], []];
  for (let i = 0; i < n; i++) {
    const phi = lerp(-a, a, i / (n - 1));
    const x = Rb * Math.sin(phi), y = Rb * (Math.cos(phi) - Math.cos(a));
    b.add(G.box((2 * a * Rb) / n + 0.03, 0.04, width), i % 2 ? '#9a5a40' : '#8a4a35', { p: [x, y, 0], r: [0, 0, -phi] });
    if (i % 2 === 0) {
      [-1, 1].forEach((s, k) => {
        const z = s * (width / 2 - 0.02);
        b.add(G.box(0.035, 0.22, 0.035), RED, { p: [x, y, z] });
        b.add(G.ico(0.028, 0), '#2b2325', { p: [x, y + 0.24, z] });
        posts[k].push([x, y + 0.17, z]);
      });
    }
  }
  for (const side of posts) for (let i = 0; i < side.length - 1; i++) b.add(G.beam(side[i], side[i + 1], 0.016, 5), RED);
}

export default {
  id: 'sakura',
  name: 'Sakura Garden',
  kicker: 'Stroll garden · spring afternoon',
  blurb: 'Cherry trees in full bloom shed petals over a koi pond and its vermilion bridge. Stepping stones lead from the torii to a pagoda on the hill.',
  facts: [['Biome', 'Temperate'], ['Season', 'Hanami'], ['Air', '16 °C']],
  theme: 'light',
  bg: ['#fff3f4', '#f1b9c7'],
  accent: '#b83a5e',
  light: { sky: '#ffe6ef', ground: '#8a9a70', hemi: 1.0, sun: '#fff0e2', sunI: 2.6, sunPos: [-5, 8, 6], env: 0.35 },
  view: { y: 0.45, zoom: 1 },

  build() {
    const rand = rng(606);
    const { fbm } = makeNoise(67);
    const group = new THREE.Group();

    const pondDist = (x, z) => Math.hypot((x - POND[0]) * 0.75, z - POND[1]) + (fbm(x * 0.8, z * 0.8) - 0.5) * 0.5;
    const zenDist = (x, z) => Math.hypot(x - ZEN[0], z - ZEN[1]);
    const h = (x, z) => {
      let y = 0.14 + fbm(x * 0.35 + 2, z * 0.35 + 8) * 0.3;
      y += 0.75 * Math.exp(-((x - HILL[0]) ** 2 + (z - HILL[1]) ** 2) / 2.2);
      y = lerp(-0.4, y, smooth(0.45, 1.45, pondDist(x, z)));
      y = lerp(0.2, y, smooth(1.0, 1.4, zenDist(x, z)));
      return y;
    };
    const BRIDGE = [POND[0], 2.12, -0.68]; // x, z south, z north
    const paths = [[TORII[0], TORII[1] - 0.2, BRIDGE[0], BRIDGE[1]], [BRIDGE[0], BRIDGE[2], -0.6, -1.3], [-0.6, -1.3, HILL[0] + 0.55, HILL[1] + 0.45]];
    const pathDist = (x, z) => Math.min(...paths.map((p) => segDist(x, z, ...p)));
    const zenRocks = [[ZEN[0] - 0.3, ZEN[1] - 0.2], [ZEN[0] + 0.45, ZEN[1] + 0.3], [ZEN[0] + 0.1, ZEN[1] - 0.55]];

    group.add(terrain({
      height: h,
      strata: ['#7a5c44', '#5f4635', '#473428'],
      color: (x, y, z) => {
        if (y < LEVEL + 0.04) return mix('#6f7f6a', '#b0b494', smooth(-0.4, LEVEL, y));
        if (zenDist(x, z) < 1.08) {
          const d = Math.min(...zenRocks.map((r) => Math.hypot(x - r[0], z - r[1])));
          const rake = d < 0.42 ? Math.sin(d * 42) : Math.sin(z * 26);
          return rake > 0 ? '#ece7da' : '#d5cfbf';
        }
        if (zenDist(x, z) < 1.2) return '#6f6a62';
        const g = mix('#8fc071', '#aad486', fbm(x * 1.6 + 3, z * 1.6));
        return fbm(x * 3.1, z * 3.1 + 7, 2) > 0.6 ? mix(g, '#f8c6d4', 0.7) : g;
      },
    }));

    const pond = water({ level: LEVEL, radius: 2.3, center: POND, color: '#4fa3a0', opacity: 0.76, n: 18, amp: 0.008 });
    group.add(pond.group);

    const b = new Batch();
    const taken = [[HILL[0], HILL[1], 0.8], [ZEN[0], ZEN[1], 1.25], [TORII[0], TORII[1], 0.6], [POND[0], POND[1], 0.9], [3.2, -2.3, 0.7]];
    const hillY = h(HILL[0], HILL[1]);

    b.at([HILL[0], hillY, HILL[1]], 0.6, 1, () => pagoda(b));
    b.at([TORII[0], h(TORII[0], TORII[1]) - 0.02, TORII[1]], 0.06, 1, () => torii(b));
    b.at([BRIDGE[0], 0.1, (BRIDGE[1] + BRIDGE[2]) / 2], Math.PI / 2, 1, () => bridge(b, BRIDGE[1] - BRIDGE[2]));

    // stepping stones
    for (const [ax, az, bx, bz] of paths) {
      const len = Math.hypot(bx - ax, bz - az);
      for (let d = 0.12; d < len; d += 0.27) {
        const x = lerp(ax, bx, d / len) + rand.range(-0.04, 0.04), z = lerp(az, bz, d / len) + rand.range(-0.04, 0.04);
        b.add(G.cyl(0.1, 0.11, 0.04, 7), rand.pick(['#a8a69f', '#9a9891', '#b4b2aa']), { p: [x, h(x, z) - 0.012, z], r: [0, rand() * TAU, 0], s: [rand.range(0.9, 1.2), 1, rand.range(0.8, 1.1)] });
      }
    }

    // stone lanterns
    const lamps = [[BRIDGE[0] + 0.42, BRIDGE[1] + 0.12], [BRIDGE[0] - 0.42, BRIDGE[2] - 0.12], [TORII[0] - 0.75, TORII[1] - 0.3], [HILL[0] + 0.95, HILL[1] + 0.25]];
    for (const [x, z] of lamps) {
      taken.push([x, z, 0.15]);
      b.at([x, h(x, z) - 0.01, z], rand() * TAU, 1, () => lantern(b));
    }

    // zen garden
    zenRocks.forEach(([x, z], i) => {
      b.at([x, 0.2, z], 0, 1, () => rock(b, rand, [0.2, 0.14, 0.1][i], ['#6a6864', '#7d7b76']));
      b.add(G.cyl(0.2, 0.22, 0.02, 9), '#6f9a5a', { p: [x, 0.195, z], s: [[1.2, 0.9, 0.7][i], 1, [1.2, 0.9, 0.7][i]] });
    });

    // bamboo grove
    for (let i = 0; i < 20; i++) {
      const x = 3.2 + rand.range(-0.55, 0.55), z = -2.3 + rand.range(-0.55, 0.55), t = rand.range(1.1, 1.9);
      const tilt = [rand.range(-0.08, 0.08), 0, rand.range(-0.08, 0.08)];
      b.add(G.cyl(0.02, 0.028, t, 5), i % 2 ? '#7fae4e' : '#93bf5a', { p: [x, h(x, z) - 0.03, z], r: tilt });
      for (let k = 0; k < 4; k++) b.add(G.cone(0.06, 0.26, 4), '#9fcc62', { p: [x + rand.range(-0.08, 0.08), h(x, z) + t * rand.range(0.55, 1), z + rand.range(-0.08, 0.08)], r: [rand.range(-1.2, 1.2), 0, rand.range(-1.2, 1.2)], s: [1, 1, 0.3] });
    }

    const lawn = (x, z) => h(x, z) > 0.1 && pathDist(x, z) > 0.34 && pondDist(x, z) > 1.5;
    for (const [x, z] of scatter(rand, 13, lawn, { taken, gap: 0.95 })) b.at([x, h(x, z) - 0.03, z], rand() * TAU, rand.range(0.9, 1.3), () => sakura(b, rand));
    for (const [x, z] of scatter(rand, 16, (x, z) => h(x, z) > 0.08 && pathDist(x, z) > 0.25, { taken, gap: 0.24 })) b.at([x, h(x, z), z], 0, 1, () => bush(b, rand, ['#e7709a', '#5f9a52', '#6faa5a', '#f39ab4'], 0.12));
    for (const [x, z] of scatter(rand, 12, (x, z) => { const d = pondDist(x, z); return d > 1.05 && d < 1.3 && pathDist(x, z) > 0.3; }, { taken, gap: 0.3 })) b.at([x, h(x, z), z], 0, 1, () => rock(b, rand, rand.range(0.08, 0.17)));
    // lily pads
    for (let i = 0; i < 9; i++) {
      const a = rand() * TAU, d = rand.range(0.35, 1.0);
      const x = POND[0] + (Math.cos(a) * d) / 0.75, z = POND[1] + Math.sin(a) * d * 0.8;
      if (Math.abs(x - POND[0]) < 0.35) continue;
      b.add(G.cyl(0.09, 0.09, 0.012, 7), '#5f9a52', { p: [x, LEVEL + 0.004, z] });
      if (i % 2) b.add(G.ico(0.03, 0), '#fbd0dc', { p: [x, LEVEL + 0.035, z] });
    }
    group.add(b.build());

    // lantern light, koi, falling petals
    lamps.forEach(([x, z], i) => {
      const g = glow('#ffc978', 0.55, 0.75);
      g.position.set(x, h(x, z) + 0.32, z);
      group.add(g);
      if (i < 2) {
        const l = new THREE.PointLight('#ffc978', 0.8, 2.5, 2);
        l.position.copy(g.position);
        group.add(l);
      }
    });
    const koi = swimmers({ count: 7, center: [POND[0] + 0.9, POND[1]], radius: 0.55, y: LEVEL - 0.07, colors: ['#ff8a3c', '#f5f1e6', '#e8503f', '#ffd23f'], size: 0.075, speed: 0.45, rand });
    const koi2 = swimmers({ count: 5, center: [POND[0] - 0.9, POND[1]], radius: 0.5, y: LEVEL - 0.07, colors: ['#ff8a3c', '#f5f1e6', '#e8503f'], size: 0.07, speed: 0.4, rand });
    const petals = particles({
      count: 320, color: '#ffb7cd', size: 0.085, opacity: 0.95,
      place: () => { const a = rand() * TAU, r = Math.sqrt(rand()) * 4.7; return [Math.cos(a) * r, rand() * 3, Math.sin(a) * r]; },
    });
    group.add(koi.group, koi2.group, petals);

    return {
      group,
      update(t, dt) {
        pond.update(t);
        koi.update(t);
        koi2.update(t);
        const p = petals.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) - dt * (0.22 + (i % 7) * 0.025);
          if (y < 0.05) y += 3;
          p.setXYZ(i, p.getX(i) + Math.sin(t * 0.9 + i * 1.7) * dt * 0.12, y, p.getZ(i) + Math.cos(t * 0.7 + i * 2.3) * dt * 0.12);
        }
        p.needsUpdate = true;
      },
    };
  },
};
