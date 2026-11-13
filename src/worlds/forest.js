import * as THREE from 'three';
import { TAU, rng, makeNoise, smooth, lerp, mix, segDist, face, G, Batch, terrain, water, scatter, smoke, birds, glow } from '../lib/kit.js';
import { pine, rock, bush, quadruped } from '../lib/props.js';

const POND = [1.5, 1.3], CABIN = [-1.7, 1.4], CAMP = [0.3, 3.0], LEVEL = -0.1;

function cabin(b) {
  b.add(G.box(0.98, 0.3, 1.26), '#77736a', { p: [0, -0.26, 0] }); // stone footing
  for (let i = 0; i < 5; i++) b.add(G.box(0.86, 0.1, 1.12), i % 2 ? '#7a5234' : '#6b452b', { p: [0, 0.04 + i * 0.1, 0] });
  b.add(G.prism(1.16, 0.46, 1.36), '#3b4a3f', { p: [0, 0.52, 0] }); // roof
  b.add(G.box(0.03, 0.3, 0.2), '#3a2a1f', { p: [0.43, 0.04, 0.22] }); // door
  b.add(G.box(0.03, 0.14, 0.2), '#ffd98a', { p: [0.43, 0.22, -0.24] }); // windows
  b.add(G.box(0.2, 0.14, 0.03), '#ffd98a', { p: [0, 0.22, 0.56] });
  b.add(G.box(0.2, 0.8, 0.2), '#8a857c', { p: [-0.2, 0.3, -0.32] }); // chimney
  b.add(G.box(0.24, 0.05, 0.24), '#6f6a62', { p: [-0.2, 1.1, -0.32] });
  b.add(G.box(0.32, 0.06, 0.56), '#8a6a48', { p: [0.6, -0.02, 0.2] }); // porch
  for (let i = 0; i < 4; i++) b.add(G.cyl(0.04, 0.04, 0.3, 6), '#8a6240', { p: [0.3, 0.04 + (i > 1 ? 0.07 : 0), -0.7 - (i % 2) * 0.09 - (i > 1 ? 0.045 : 0)], r: [0, 0, Math.PI / 2] }); // woodpile
}

export default {
  id: 'forest',
  name: 'Pine Forest',
  kicker: 'Boreal woodland · first light',
  blurb: 'Dawn mist lifts off a tarn ringed by spruce and pine. Woodsmoke climbs from a trapper’s cabin while deer come down to the water to drink.',
  facts: [['Biome', 'Taiga'], ['Elevation', '640 m'], ['Air', '4 °C']],
  theme: 'light',
  bg: ['#eef3e7', '#a5bdab'],
  accent: '#2f6b4f',
  light: { sky: '#d6e8f2', ground: '#4a5f48', hemi: 0.9, sun: '#ffe2b4', sunI: 2.7, sunPos: [-6, 6.5, 6], env: 0.3 },
  view: { y: 0.4, zoom: 1 },

  build() {
    const rand = rng(101);
    const { fbm } = makeNoise(11);
    const group = new THREE.Group();

    const h = (x, z) => {
      let y = fbm(x * 0.3 + 3, z * 0.3 + 7) * 1.3 - 0.15;
      y += 0.9 * Math.exp(-((x + 2.4) ** 2 + (z + 2.4) ** 2) / 5);
      y = lerp(0.42, y, smooth(0.6, 1.4, Math.hypot(x - CABIN[0], z - CABIN[1])));
      y = lerp(-0.42, y, smooth(0.55, 1.9, Math.hypot(x - POND[0], z - POND[1])));
      return y;
    };
    const pathDist = (x, z) => Math.min(segDist(x, z, -1.15, 1.6, 0.3, 1.45), segDist(x, z, -1.9, 2.1, -3.5, 3.5), segDist(x, z, -0.4, 1.6, CAMP[0], CAMP[1] - 0.3));

    group.add(terrain({
      height: h,
      strata: ['#6b5a44', '#54463a', '#3f3630'],
      color: (x, y, z, ny) => {
        if (y < LEVEL + 0.06) return mix('#6b6a4f', '#8f8a66', smooth(-0.4, LEVEL, y));
        if (ny < 0.78) return mix('#6f6e68', '#8b877d', fbm(x * 2, z * 2));
        if (pathDist(x, z) < 0.15) return '#a48e66';
        return mix(mix('#4f7d4a', '#7fa55a', fbm(x * 0.7 + 20, z * 0.7)), '#3d6a45', smooth(0.5, 1.4, y));
      },
    }));

    const pond = water({ level: LEVEL, radius: 1.9, center: POND, color: '#4f93a8', opacity: 0.8, n: 16, amp: 0.012 });
    group.add(pond.group);

    const b = new Batch();
    const taken = [[CABIN[0], CABIN[1], 0.85], [POND[0], POND[1], 1.2], [CAMP[0], CAMP[1], 0.45]];

    b.at([CABIN[0], 0.42, CABIN[1]], 0, 1, () => cabin(b));

    // jetty
    b.add(G.box(0.9, 0.03, 0.24), '#9a7650', { p: [0.68, 0.0, 1.4] });
    for (const x of [0.4, 1.05]) for (const z of [1.3, 1.5]) b.add(G.cyl(0.02, 0.02, 0.45, 5), '#6b4c33', { p: [x, -0.4, z] });

    // camp
    b.at([CAMP[0] - 0.35, h(CAMP[0] - 0.35, CAMP[1] + 0.1), CAMP[1] + 0.1], 0.5, 1, () => {
      b.add(G.prism(0.5, 0.36, 0.62), '#d9793b');
      b.add(G.prism(0.2, 0.2, 0.63), '#5a3a26');
    });
    const fireY = h(CAMP[0] + 0.15, CAMP[1]);
    for (let i = 0; i < 6; i++) b.add(G.ico(0.035), '#77736c', { p: [CAMP[0] + 0.15 + Math.cos(i * 1.05) * 0.1, fireY + 0.01, CAMP[1] + Math.sin(i * 1.05) * 0.1] });
    for (let i = 0; i < 3; i++) b.add(G.cyl(0.018, 0.018, 0.16, 5), '#4a3526', { p: [CAMP[0] + 0.15, fireY + 0.02, CAMP[1]], r: [0.9, i * 2.1, 0] });

    // deer at the water's edge
    for (const [x, z, s] of [[2.5, 0.45, 1], [2.85, 0.95, 0.8]]) {
      b.at([x, h(x, z), z], face(POND[0] - x, POND[1] - z), s, () => {
        const [hx, hy] = quadruped(b, { body: '#9a6b42', leg: '#7d5535' });
        for (const sz of [-1, 1]) b.add(G.box(0.015, 0.1, 0.015), '#e8dcc0', { p: [hx - 0.04, hy + 0.03, sz * 0.025], r: [sz * 0.4, 0, 0.2] });
        b.add(G.box(0.04, 0.04, 0.04), '#f3ead8', { p: [-0.17, 0.26, 0] });
      });
    }

    const clear = (x, z) => h(x, z) > 0.1 && pathDist(x, z) > 0.3;
    for (const [x, z] of scatter(rand, 80, clear, { taken, gap: 0.42 })) {
      b.at([x, h(x, z) - 0.03, z], rand() * TAU, rand.range(0.5, 0.95), () => pine(b, rand));
    }
    for (const [x, z] of scatter(rand, 16, clear, { taken, gap: 0.2 })) b.at([x, h(x, z), z], 0, 1, () => rock(b, rand, rand.range(0.08, 0.2)));
    for (const [x, z] of scatter(rand, 18, clear, { taken, gap: 0.2 })) b.at([x, h(x, z), z], 0, 1, () => bush(b, rand, ['#4f8a4a', '#3f7a45', '#6a9a4f'], 0.13));
    for (const [x, z] of scatter(rand, 7, clear, { taken, gap: 0.2 })) b.add(G.cyl(0.07, 0.085, 0.1, 7), '#7a5a3c', { p: [x, h(x, z), z] });
    for (const [x, z] of scatter(rand, 12, clear, { taken, gap: 0.12 })) {
      b.add(G.cyl(0.012, 0.012, 0.05, 5), '#efe6d2', { p: [x, h(x, z), z] });
      b.add(G.cone(0.04, 0.035, 6), '#c8402f', { p: [x, h(x, z) + 0.045, z] });
    }
    // reeds
    for (let i = 0; i < 14; i++) {
      const a = rand.range(-1.2, 2.6), d = rand.range(1.0, 1.15);
      const x = POND[0] + Math.cos(a) * d, z = POND[1] + Math.sin(a) * d;
      b.add(G.cone(0.015, rand.range(0.18, 0.3), 4), '#6f8f4a', { p: [x, Math.max(h(x, z), LEVEL) - 0.02, z] });
    }
    group.add(b.build());

    // life
    const chimney = smoke({ origin: [CABIN[0] - 0.2, 1.6, CABIN[1] - 0.32], color: '#f3f1ec', rise: 1.9, spread: 0.4, size: 0.1, opacity: 0.8 });
    const flock = birds({ count: 5, radius: 3.4, height: 3.1, rand });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 5), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
    flame.position.set(CAMP[0] + 0.15, fireY + 0.13, CAMP[1]);
    const halo = glow('#ff9a3c', 0.9, 0.7);
    halo.position.copy(flame.position);
    const fire = new THREE.PointLight('#ff9a4a', 2.5, 4, 2);
    fire.position.copy(flame.position).y += 0.15;
    const campSmoke = smoke({ origin: [CAMP[0] + 0.15, fireY + 0.25, CAMP[1]], color: '#d9d6d0', count: 5, rise: 0.9, spread: 0.15, size: 0.04, opacity: 0.5, speed: 0.25 });
    group.add(chimney.group, flock.group, flame, halo, fire, campSmoke.group);

    return {
      group,
      update(t) {
        pond.update(t);
        chimney.update(t);
        campSmoke.update(t);
        flock.update(t);
        const f = 1 + Math.sin(t * 13) * 0.18 + Math.sin(t * 7.3) * 0.14;
        flame.scale.set(1, f, 1);
        fire.intensity = 2.5 * f;
        halo.material.opacity = 0.55 + 0.15 * f;
      },
    };
  },
};
