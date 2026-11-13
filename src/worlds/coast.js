import * as THREE from 'three';
import { TAU, rng, makeNoise, smooth, mix, G, Batch, terrain, water, scatter, birds, cloud, swimmers, orbitPose } from '../lib/kit.js';
import { palm, rock, bush, tree, person } from '../lib/props.js';

const HEAD = [-2.7, -2.5], ISLET = [3.4, 0.4];
const SEAWARD = [0.53, 0.848];

function lighthouse(b) {
  b.add(G.cyl(0.36, 0.4, 0.1, 10), '#a69c8c');
  for (let i = 0; i < 4; i++) b.add(G.cyl(0.3 - (i + 1) * 0.025, 0.3 - i * 0.025, 0.31, 10), i % 2 ? '#d8493a' : '#f7f3ea', { p: [0, 0.1 + i * 0.3, 0] });
  b.add(G.cyl(0.28, 0.26, 0.04, 10), '#3a3f47', { p: [0, 1.3, 0] });
  b.add(G.cyl(0.13, 0.13, 0.18, 8), '#ffe9a0', { p: [0, 1.34, 0] });
  b.add(G.cone(0.2, 0.18, 8), '#d8493a', { p: [0, 1.52, 0] });
  b.add(G.box(0.05, 0.14, 0.1), '#3a2a1f', { p: [0.27, 0.1, 0] });
  // keeper's cottage
  b.add(G.box(0.42, 0.24, 0.36), '#f7f3ea', { p: [0.55, 0, -0.3] });
  b.add(G.prism(0.46, 0.2, 0.46), '#d8493a', { p: [0.55, 0.24, -0.3], r: [0, Math.PI / 2, 0] });
}

function stiltHut(b, stilt = 1.0) {
  b.add(G.box(0.8, 0.04, 0.8), '#9a7650');
  b.add(G.box(0.56, 0.32, 0.56), '#d9b97f', { p: [0, 0.04, 0] });
  b.add(G.box(0.03, 0.2, 0.14), '#5a3a26', { p: [-0.285, 0.04, 0] });
  b.add(G.box(0.14, 0.1, 0.03), '#5a3a26', { p: [0, 0.16, 0.285] });
  b.add(G.cone(0.56, 0.38, 4), '#b8924f', { p: [0, 0.36, 0], r: [0, Math.PI / 4, 0] });
  b.add(G.cone(0.3, 0.24, 4), '#a47e40', { p: [0, 0.56, 0], r: [0, Math.PI / 4, 0] });
  for (const x of [-0.33, 0.33]) for (const z of [-0.33, 0.33]) b.add(G.cyl(0.025, 0.025, stilt, 5), '#6b4c33', { p: [x, -stilt, z] });
}

function sailboat() {
  const b = new Batch();
  b.add(G.box(0.46, 0.09, 0.18), '#f5f1e6', { p: [-0.05, -0.02, 0] });
  b.add(G.prism(0.18, 0.18, 0.09), '#f5f1e6', { p: [0.18, 0.025, 0], r: [Math.PI / 2, 0, -Math.PI / 2] }); // bow
  b.add(G.box(0.47, 0.025, 0.185), '#d8493a', { p: [-0.05, 0.045, 0] });
  b.add(G.box(0.16, 0.05, 0.1), '#c9a36b', { p: [-0.14, 0.07, 0] });
  b.add(G.cyl(0.012, 0.012, 0.66, 5), '#6b4c33', { p: [0.04, 0.05, 0] });
  b.add(G.prism(0.3, 0.52, 0.012), '#ffffff', { p: [-0.13, 0.14, 0] });
  b.add(G.prism(0.16, 0.4, 0.012), '#ffe9c7', { p: [0.14, 0.14, 0] });
  return b.build();
}

export default {
  id: 'coast',
  name: 'Tropical Coast',
  kicker: 'Coral lagoon · midday',
  blurb: 'White sand shelves into a glass-clear lagoon dotted with coral. A striped lighthouse watches the headland as a sloop tacks across the shallows.',
  facts: [['Biome', 'Littoral'], ['Sea', '27 °C'], ['Tide', 'Low']],
  theme: 'light',
  bg: ['#ecfaf6', '#7fd0cb'],
  accent: '#0f7f86',
  light: { sky: '#c9f1ff', ground: '#e8d6a0', hemi: 0.8, sun: '#fff6e4', sunI: 3.1, sunPos: [5, 8, 5], env: 0.28 },
  view: { y: 0.45, zoom: 1 },

  build() {
    const rand = rng(404);
    const { fbm } = makeNoise(41);
    const group = new THREE.Group();

    const h = (x, z) => {
      const n = fbm(x * 0.35 + 1, z * 0.35 + 4);
      const sd = -(x * 0.5 + z * 0.8) + 0.4 + Math.sin(x * 0.8 + 0.5) * 0.5 + (n - 0.5) * 1.6;
      let y = sd > 0 ? 0.03 + 0.9 * (1 - Math.exp(-sd * 0.45)) : Math.max(-0.85, sd * 0.3);
      y += 1.1 * Math.exp(-((x - HEAD[0]) ** 2 + (z - HEAD[1]) ** 2) / 1.6);
      y += 1.0 * Math.exp(-((x - ISLET[0]) ** 2 + (z - ISLET[1]) ** 2) / 0.5);
      return y;
    };

    group.add(terrain({
      height: h,
      strata: ['#e8d29c', '#c9a36b', '#8f7a5c'],
      color: (x, y, z, ny) => {
        const n = fbm(x * 1.2, z * 1.2);
        if (y < 0) return mix('#efe3b8', '#3f9fa8', smooth(0, -0.8, y) * 0.85);
        if (ny < 0.72) return mix('#8d8478', '#aaa090', n);
        if (y < 0.3 + n * 0.16) return mix('#f6e7bb', '#ead4a0', n);
        return mix('#58a55a', '#82c064', n);
      },
    }));

    const sea = water({ level: 0, wall: true, color: '#0fa9c2', opacity: 0.62, amp: 0.02 });
    group.add(sea.group);

    const b = new Batch();
    const headY = h(HEAD[0], HEAD[1]);
    const taken = [[HEAD[0], HEAD[1], 0.75]];
    b.at([HEAD[0], headY - 0.06, HEAD[1]], 0.6, 1, () => lighthouse(b));

    // pier, marching seaward from the beach until it reaches the waterline
    let sx = 0.2, sz = -0.6;
    while (h(sx, sz) > 0.07) { sx += SEAWARD[0] * 0.05; sz += SEAWARD[1] * 0.05; }
    const pierYaw = Math.atan2(-SEAWARD[1], SEAWARD[0]);
    b.at([sx, 0.15, sz], pierYaw, 1, () => {
      b.add(G.box(1.75, 0.035, 0.26), '#a9865c', { p: [0.8, 0, 0] });
      for (const x of [0.15, 0.65, 1.15, 1.6]) for (const z of [-0.11, 0.11]) b.add(G.cyl(0.02, 0.02, 1.0, 5), '#6b4c33', { p: [x, -0.98, z] });
      b.at([2.05, 0, 0], 0, 1, () => stiltHut(b));
    });
    for (let d = -0.3; d < 2.6; d += 0.3) taken.push([sx + SEAWARD[0] * d, sz + SEAWARD[1] * d, 0.3]);

    const beach = (x, z) => { const y = h(x, z); return y > 0.07 && y < 0.3; };
    const grass = (x, z) => h(x, z) > 0.5;

    // beach hut on short legs
    const [bx, bz] = scatter(rand, 1, (x, z) => beach(x, z) && x < -1, { taken, gap: 0.6 })[0] || [-2, 1.6];
    b.at([bx, h(bx, bz) + 0.12, bz], pierYaw + Math.PI, 0.8, () => stiltHut(b, 0.3));

    for (const [x, z] of scatter(rand, 13, (x, z) => { const y = h(x, z); return y > 0.1 && y < 0.55; }, { taken, gap: 0.55 })) {
      b.at([x, h(x, z) - 0.03, z], pierYaw + rand.range(-1, 1), rand.range(0.85, 1.2), () => palm(b, rand));
    }
    // islet palm
    b.at([ISLET[0], h(ISLET[0], ISLET[1]) - 0.03, ISLET[1]], 1, 0.9, () => palm(b, rand));

    // parasols and towels
    const shades = ['#e8503f', '#ffffff', '#ffc94a', '#2f9fb0'];
    scatter(rand, 4, beach, { taken, gap: 0.45 }).forEach(([x, z], i) => {
      b.at([x, h(x, z), z], rand() * TAU, 1, () => {
        b.add(G.cyl(0.008, 0.008, 0.3, 4), '#f5f1e6', { r: [0, 0, 0.12] });
        b.add(G.cone(0.24, 0.09, 8), shades[i], { p: [-0.035, 0.27, 0], r: [0, 0, 0.12] });
        b.add(G.box(0.24, 0.012, 0.11), shades[(i + 2) % 4], { p: [0.12, 0.005, 0.08] });
        if (i % 2 === 0) b.at([0.14, 0.01, -0.12], rand() * TAU, 1, () => person(b, shades[(i + 1) % 4], '#d9a877', '#2f4f6f'));
      });
    });
    // surfboards
    scatter(rand, 3, beach, { taken, gap: 0.3 }).forEach(([x, z], i) => {
      b.add(G.box(0.1, 0.42, 0.018), ['#ff7f6e', '#ffd86b', '#5fd0c8'][i], { p: [x, h(x, z) - 0.03, z], r: [0.18, rand() * TAU, 0] });
    });

    for (const [x, z] of scatter(rand, 20, grass, { taken, gap: 0.42 })) b.at([x, h(x, z) - 0.03, z], rand() * TAU, rand.range(0.8, 1.3), () => tree(b, rand, ['#3f9a52', '#55b060', '#2f8548']));
    for (const [x, z] of scatter(rand, 20, (x, z) => h(x, z) > 0.4, { taken, gap: 0.22 })) b.at([x, h(x, z), z], 0, 1, () => bush(b, rand, ['#4fa55a', '#6ab860', '#e86fa6'], 0.11));
    for (const [x, z] of scatter(rand, 10, (x, z) => { const y = h(x, z); return y > -0.5 && y < 0.12; }, { taken, gap: 0.3 })) b.at([x, h(x, z), z], 0, 1, () => rock(b, rand, rand.range(0.1, 0.24), ['#8d8478', '#9d9486', '#7a7268']));

    // coral gardens under the surface
    const corals = ['#ff7f6e', '#ffb347', '#e86fa6', '#9a7fe0', '#ffd86b'];
    for (const [x, z] of scatter(rand, 34, (x, z) => { const y = h(x, z); return y > -0.84 && y < -0.3; }, { taken, gap: 0.3 })) {
      const y = h(x, z), c = rand.pick(corals);
      if (rand() < 0.5) {
        for (let i = 0; i < 4; i++) b.add(G.cone(0.03, rand.range(0.1, 0.22), 5), c, { p: [x + rand.range(-0.06, 0.06), y - 0.02, z + rand.range(-0.06, 0.06)], r: [rand.range(-0.4, 0.4), 0, rand.range(-0.4, 0.4)] });
      } else {
        b.add(G.ico(rand.range(0.07, 0.13), 1), c, { p: [x, y + 0.03, z], s: [1, 0.6, 1] });
      }
    }
    group.add(b.build());

    // lighthouse beam
    const beamGeo = new THREE.ConeGeometry(0.42, 3.2, 14, 1, true).translate(0, -1.6, 0).rotateZ(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({ color: '#fff2b8', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Group();
    const b1 = new THREE.Mesh(beamGeo, beamMat), b2 = new THREE.Mesh(beamGeo, beamMat);
    b2.rotation.y = Math.PI;
    beam.add(b1, b2);
    beam.position.set(HEAD[0], headY - 0.06 + 1.43, HEAD[1]);
    group.add(beam);

    const boat = sailboat();
    const fish = swimmers({ count: 9, center: [2.3, 3.0], radius: 0.9, y: -0.35, colors: ['#ff8a3c', '#ffd23f', '#f5f1e6', '#3f7fe0'], size: 0.07, speed: 0.6, rand });
    const gulls = birds({ count: 6, radius: 3.6, height: 2.9, color: '#ffffff', size: 0.15, speed: 0.35, rand });
    const clouds = [0, 1, 2].map((i) => {
      const mesh = cloud(rand, rand.range(0.8, 1.2));
      group.add(mesh);
      return { mesh, r: rand.range(2.5, 4), y: 3.6 + i * 0.35, ph: rand() * TAU, sp: rand.range(0.02, 0.04) };
    });
    group.add(boat, fish.group, gulls.group);

    return {
      group,
      update(t) {
        sea.update(t);
        fish.update(t);
        gulls.update(t);
        beam.rotation.y = t * 0.6;
        orbitPose(boat, t * 0.12, 0.6, 0.01 + Math.sin(t * 1.4) * 0.015, 0.0, 3.7);
        boat.rotation.z = Math.sin(t * 1.1) * 0.07;
        boat.rotation.x = Math.sin(t * 0.8) * 0.05;
        for (const c of clouds) {
          const a = c.ph + t * c.sp;
          c.mesh.position.set(Math.cos(a) * c.r, c.y, Math.sin(a) * c.r);
        }
      },
    };
  },
};
