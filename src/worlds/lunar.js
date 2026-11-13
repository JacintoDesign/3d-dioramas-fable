import * as THREE from 'three';
import { TAU, rng, makeNoise, smooth, lerp, mix, G, Batch, terrain, scatter, glow, particles, orbitPose } from '../lib/kit.js';
import { rock } from '../lib/props.js';

const BASE = [-0.6, 0.2], PAD = [2.0, -0.1], PATROL = 1.72;
// [x, z, radius, depth]
const CRATERS = [[3.0, -2.5, 1.2, 0.5], [-3.3, -2.6, 0.8, 0.32], [2.6, 2.7, 0.7, 0.28], [-2.9, 3.0, 0.55, 0.22], [0.5, -3.9, 0.5, 0.2], [4.0, 0.9, 0.42, 0.17], [-4.1, 0.3, 0.4, 0.16], [0.6, 4.0, 0.4, 0.16], [-1.4, -3.2, 0.3, 0.12]];
const HULL = '#e9ebee', TRIM = '#c2c6cc', DARK = '#3a3d44', GOLD = '#c9a24a', ORANGE = '#ff7a3c';

function habitat(b, r) {
  b.add(G.cyl(r * 1.05, r * 1.1, 0.1, 16), TRIM, { p: [0, -0.04, 0] });
  b.add(G.dome(r, 16), HULL, { p: [0, 0.04, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    b.add(G.box(0.03, r * 0.16, r * 0.3), '#7fd0ff', { p: [Math.cos(a) * r * 0.93, 0.04 + r * 0.22, Math.sin(a) * r * 0.93], r: [0, -a, 0.35] });
  }
  b.add(G.cyl(r * 0.16, r * 0.2, 0.05, 8), TRIM, { p: [0, 0.03 + r, 0] });
}

function solarPanel(b) {
  b.add(G.cyl(0.018, 0.022, 0.24, 6), TRIM);
  b.add(G.box(0.44, 0.015, 0.3), TRIM, { p: [0, 0.22, 0], r: [0.5, 0, 0] });
  for (const x of [-0.11, 0.11]) b.add(G.box(0.2, 0.012, 0.27), '#1f3a6e', { p: [x, 0.232, 0.003], r: [0.5, 0, 0] });
}

function lander(b) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(G.beam([sx * 0.13, 0.24, sz * 0.13], [sx * 0.32, 0.02, sz * 0.32], 0.013), TRIM);
    b.add(G.beam([sx * 0.13, 0.12, sz * 0.13], [sx * 0.32, 0.02, sz * 0.32], 0.008), TRIM);
    b.add(G.cyl(0.05, 0.05, 0.015, 8), GOLD, { p: [sx * 0.32, 0.005, sz * 0.32] });
  }
  b.add(G.cone(0.09, 0.1, 8), DARK, { p: [0, 0.03, 0] });
  b.add(G.cyl(0.2, 0.2, 0.16, 8), GOLD, { p: [0, 0.12, 0], r: [0, 0.39, 0] });
  b.add(G.ico(0.17, 1), '#d9dce0', { p: [0, 0.43, 0], s: [1, 0.85, 1] });
  b.add(G.box(0.08, 0.07, 0.02), '#7fd0ff', { p: [0.13, 0.42, 0], r: [0, Math.PI / 2, 0] });
  b.add(G.cyl(0.005, 0.005, 0.2, 4), TRIM, { p: [-0.06, 0.55, 0.05] });
  b.add(G.cone(0.07, 0.035, 8), HULL, { p: [0.06, 0.6, -0.04], r: [0.5, 0, 0.3] });
}

function astronaut(b) {
  for (const z of [-0.022, 0.022]) b.add(G.box(0.035, 0.08, 0.035), HULL, { p: [0, 0, z] });
  b.add(G.box(0.06, 0.1, 0.085), HULL, { p: [0, 0.08, 0] });
  b.add(G.box(0.035, 0.09, 0.07), TRIM, { p: [-0.045, 0.09, 0] });
  b.add(G.ico(0.045, 1), HULL, { p: [0, 0.22, 0] });
  b.add(G.box(0.02, 0.04, 0.055), GOLD, { p: [0.035, 0.2, 0] });
}

function rover() {
  const b = new Batch();
  b.add(G.box(0.3, 0.06, 0.16), HULL, { p: [0, 0.07, 0] });
  for (const x of [-0.12, 0, 0.12]) for (const s of [-1, 1]) b.add(G.cyl(0.05, 0.05, 0.04, 8), DARK, { p: [x, 0.05, s > 0 ? 0.085 : -0.125], r: [Math.PI / 2, 0, 0] });
  b.add(G.box(0.24, 0.012, 0.2), '#1f3a6e', { p: [-0.03, 0.15, 0], r: [0, 0, 0.12] });
  b.add(G.cyl(0.008, 0.008, 0.16, 4), TRIM, { p: [0.11, 0.13, 0] });
  b.add(G.box(0.05, 0.035, 0.07), DARK, { p: [0.12, 0.28, 0] });
  b.add(G.cyl(0.004, 0.004, 0.2, 4), TRIM, { p: [-0.12, 0.13, 0.06] });
  b.add(G.box(0.02, 0.02, 0.1), GOLD, { p: [0.15, 0.09, 0] });
  return b.build({ roughness: 0.6 });
}

function earth(fbm) {
  const geo = new THREE.IcosahedronGeometry(0.8, 4);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const land = fbm(x * 2.2 + z * 1.1 + 5, y * 2.4 - z * 1.3 + 2), sky = fbm(x * 3 - y * 2 + 11, z * 3 + y * 2 + 4);
    if (Math.abs(y) > 0.66) c.set('#f4f8fb');
    else if (sky > 0.63) c.set('#ffffff');
    else if (land > 0.54) c.copy(mix('#4f9a5a', '#c9b37a', smooth(0.54, 0.7, land)));
    else c.copy(mix('#1f5fb8', '#2f86d8', land * 1.7));
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }));
}

export default {
  id: 'lunar',
  name: 'Lunar Outpost',
  kicker: 'Mare basin · lunar morning',
  blurb: 'Pressurised domes huddle on the regolith beside a gold-foiled lander. A rover runs its patrol loop while Earth hangs over the crater rim.',
  facts: [['Biome', 'Regolith'], ['Gravity', '1.62 m/s²'], ['Daylight', '14 days']],
  theme: 'dark',
  bg: ['#1b2130', '#04050a'],
  accent: '#8fd3ff',
  light: { sky: '#3f4a66', ground: '#14151a', hemi: 0.28, sun: '#fff8ee', sunI: 3.8, sunPos: [8, 3.4, 3], env: 0.06 },
  view: { y: 0.5, zoom: 0.94 },

  build() {
    const rand = rng(707);
    const { fbm } = makeNoise(79);
    const group = new THREE.Group();

    const baseDist = (x, z) => Math.hypot(x - BASE[0], z - BASE[1]);
    const h = (x, z) => {
      let y = 0.1 + fbm(x * 0.4 + 6, z * 0.4 + 3) * 0.5 + fbm(x * 1.8, z * 1.8, 2) * 0.07;
      y = lerp(0.36, y, smooth(1.5, 2.4, baseDist(x, z)));
      y = lerp(0.34, y, smooth(0.8, 1.2, Math.hypot(x - PAD[0], z - PAD[1])));
      for (const [cx, cz, r, dep] of CRATERS) {
        const t = Math.hypot(x - cx, z - cz) / r;
        if (t < 1.8) y += dep * 0.45 * Math.exp(-(((t - 1) / 0.22) ** 2)) - (t < 1 ? dep * (1 - t * t) : 0);
      }
      return y;
    };

    group.add(terrain({
      height: h,
      strata: ['#7a7c84', '#5c5e66', '#44464d'],
      color: (x, y, z, ny) => {
        const c = mix('#74767d', '#a9aab0', fbm(x * 0.9 + 1, z * 0.9 + 5));
        if (ny < 0.82) return mix(c, '#63656d', 0.65);
        if (Math.abs(baseDist(x, z) - PATROL) < 0.075) return mix(c, '#5f6168', 0.5);
        return c;
      },
    }));

    const b = new Batch();
    const taken = [[BASE[0], BASE[1], PATROL + 0.15], [PAD[0], PAD[1], 0.85]];
    const Y = 0.36;

    // habitat cluster
    b.at([BASE[0], Y, BASE[1]], 0, 1, () => {
      habitat(b, 0.6);
      b.add(G.box(0.3, 0.26, 0.24), TRIM, { p: [0.66, 0, 0] });
      b.add(G.box(0.02, 0.18, 0.14), DARK, { p: [0.815, 0, 0] });
      b.add(G.box(0.02, 0.03, 0.14), ORANGE, { p: [0.815, 0.2, 0] });
      b.at([-0.98, 0, -0.55], 0, 1, () => habitat(b, 0.38));
      b.add(G.beam([-0.45, 0.13, -0.25], [-0.72, 0.13, -0.4], 0.1, 8), TRIM);
      b.add(G.beam([-0.42, 0.13, 0.42], [-0.6, 0.13, 0.6], 0.1, 8), TRIM);
      // greenhouse floor and crop rows (the glass goes on separately)
      b.add(G.cyl(0.4, 0.43, 0.1, 16), TRIM, { p: [-0.78, -0.04, 0.78] });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU, d = i % 2 ? 0.24 : 0.12;
        b.add(G.cone(0.04, 0.1, 5), i % 3 ? '#4fb060' : '#7fd070', { p: [-0.78 + Math.cos(a) * d, 0.06, 0.78 + Math.sin(a) * d] });
      }
      // fuel tanks
      for (const z of [-0.9, -1.12]) {
        b.add(G.cyl(0.09, 0.09, 0.42, 10), HULL, { p: [0.08, 0.11, z], r: [0, 0, -Math.PI / 2] });
        for (const x of [0.08, 0.47]) b.add(G.cyl(0.095, 0.095, 0.03, 10), ORANGE, { p: [x, 0.11, z], r: [0, 0, -Math.PI / 2] });
      }
      for (const [x, z, s] of [[0.75, 0.55, 1], [0.9, 0.42, 0.7], [0.62, -0.5, 0.8]]) b.add(G.box(0.12, 0.1, 0.12), s === 1 ? ORANGE : TRIM, { p: [x, 0, z], r: [0, x * 3, 0], s });
    });

    // landing pad + lander
    const padY = 0.34;
    b.add(G.cyl(0.74, 0.78, 0.05, 24), DARK, { p: [PAD[0], padY - 0.02, PAD[1]] });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      b.add(G.box(0.14, 0.006, 0.03), '#f2c94c', { p: [PAD[0] + Math.cos(a) * 0.62, padY + 0.03, PAD[1] + Math.sin(a) * 0.62], r: [0, -a + Math.PI / 2, 0] });
    }
    b.at([PAD[0], padY + 0.03, PAD[1]], 0.5, 1, () => lander(b));

    // solar field
    for (let i = 0; i < 5; i++) {
      const x = 0.1 + i * 0.52, z = 2.55 + (i % 2) * 0.12;
      taken.push([x, z, 0.2]);
      b.at([x, h(x, z) - 0.02, z], 0.25, 1, () => solarPanel(b));
    }

    // comms mast
    const MAST = [-2.5, -1.25], mastY = h(MAST[0], MAST[1]);
    taken.push([MAST[0], MAST[1], 0.3]);
    b.at([MAST[0], mastY - 0.03, MAST[1]], 0, 1, () => {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        b.add(G.beam([Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], [0, 1.25, 0], 0.014), TRIM);
        b.add(G.beam([Math.cos(a) * 0.12, 0.5, Math.sin(a) * 0.12], [Math.cos(a + 2.1) * 0.12, 0.5, Math.sin(a + 2.1) * 0.12], 0.008), TRIM);
      }
      b.add(G.cyl(0.02, 0.02, 0.3, 6), TRIM, { p: [0, 1.2, 0] });
      b.add(G.box(0.16, 0.12, 0.12), HULL, { p: [0.2, 0, 0.1] });
    });

    // flag and crew
    const FLAG = [1.1, 1.75], flagY = h(FLAG[0], FLAG[1]);
    b.add(G.cyl(0.007, 0.007, 0.42, 4), TRIM, { p: [FLAG[0], flagY, FLAG[1]] });
    b.add(G.box(0.2, 0.12, 0.008), ORANGE, { p: [FLAG[0] + 0.1, flagY + 0.3, FLAG[1]] });
    b.add(G.box(0.2, 0.03, 0.01), HULL, { p: [FLAG[0] + 0.1, flagY + 0.345, FLAG[1]] });
    for (const [x, z, ry] of [[FLAG[0] + 0.3, FLAG[1] + 0.15, 2.6], [PAD[0] - 0.55, PAD[1] + 0.75, 0.9], [0.35, 2.2, -1.2], [MAST[0] + 0.35, MAST[1] + 0.3, 2]]) {
      taken.push([x, z, 0.12]);
      b.at([x, h(x, z), z], ry, 1, () => astronaut(b));
    }

    const greys = ['#7d7f86', '#94969d', '#6a6c73'];
    for (const [x, z] of scatter(rand, 60, () => true, { taken, gap: 0.22, rmax: 4.6 })) b.at([x, h(x, z), z], 0, 1, () => rock(b, rand, rand() < 0.15 ? rand.range(0.16, 0.3) : rand.range(0.04, 0.12), greys));
    group.add(b.build({ roughness: 0.75 }));

    // greenhouse glass
    const glass = new THREE.Mesh(G.dome(0.38, 16), new THREE.MeshStandardMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0.2 }));
    glass.position.set(BASE[0] - 0.78, Y + 0.05, BASE[1] + 0.78);
    const grow = glow('#9dffb0', 0.8, 0.35);
    grow.position.copy(glass.position).y += 0.15;
    group.add(glass, grow);

    // rotating dish + blinking beacon
    const dishPivot = new THREE.Group();
    const dish = new THREE.Mesh(G.dome(0.24, 14), new THREE.MeshStandardMaterial({ color: HULL, side: THREE.DoubleSide, flatShading: true, roughness: 0.6 }));
    dish.rotation.x = Math.PI - 1.0;
    dish.position.set(0, 0.2, 0.12);
    dish.castShadow = true;
    dishPivot.add(dish);
    dishPivot.position.set(MAST[0], mastY + 1.0, MAST[1]);
    const beacon = glow('#ff4030', 0.5, 1);
    beacon.position.set(MAST[0], mastY + 1.5, MAST[1]);
    group.add(dishPivot, beacon);

    const padLights = [0, 1, 2, 3].map((i) => {
      const a = (i / 4) * TAU + 0.4;
      const g = glow('#8fd3ff', 0.3, 1);
      g.position.set(PAD[0] + Math.cos(a) * 0.78, padY + 0.06, PAD[1] + Math.sin(a) * 0.78);
      group.add(g);
      return g;
    });
    const windowGlow = glow('#ffe2a0', 1.5, 0.3);
    windowGlow.position.set(BASE[0] + 0.5, Y + 0.25, BASE[1] + 0.35);
    group.add(windowGlow);

    const buggy = rover();
    const lamp = glow('#ffffff', 0.25, 0.9);
    lamp.position.set(0.17, 0.1, 0);
    buggy.add(lamp);
    group.add(buggy);

    // Earth and the stars
    const planet = earth(fbm);
    planet.position.set(-5.2, 3.0, -5.6);
    const air = glow('#5fa8ff', 3.0, 0.35);
    air.position.copy(planet.position);
    const stars = particles({
      count: 800, color: '#ffffff', size: 1.9, attenuate: false, opacity: 0.9,
      place: () => {
        const u = rand() * 2 - 1, a = rand() * TAU, r = rand.range(45, 70), s = Math.sqrt(1 - u * u);
        return [Math.cos(a) * s * r, u * r, Math.sin(a) * s * r];
      },
    });
    group.add(planet, air, stars);

    return {
      group,
      update(t) {
        const a = -t * 0.11;
        const x = BASE[0] + Math.cos(a) * PATROL, z = BASE[1] + Math.sin(a) * PATROL;
        orbitPose(buggy, a, PATROL, h(x, z), BASE[0], BASE[1], true);
        dishPivot.rotation.y = t * 0.35;
        beacon.material.opacity = (t * 0.8) % 1 < 0.18 ? 1 : 0.06;
        padLights.forEach((g, i) => (g.material.opacity = Math.floor(t * 2.5) % 4 === i ? 1 : 0.2));
        planet.rotation.y = t * 0.03;
      },
    };
  },
};
