import * as THREE from 'three';
import { TAU, rng, makeNoise, smooth, mix, G, Batch, terrain, water, scatter, smoke, glow, particles } from '../lib/kit.js';
import { palm, rock, bush } from '../lib/props.js';

const C = [-0.3, -0.3]; // crater centre
const FLOWS = [0.85, 2.95, 5.05]; // bearings of the three lava rivers

const lavaPoint = (k, d) => {
  const a = FLOWS[k] + 0.3 * Math.sin(d * 1.6 + k * 2);
  return [C[0] + Math.cos(a) * d, C[1] + Math.sin(a) * d];
};
const lavaDist = (x, z) => {
  const d = Math.hypot(x - C[0], z - C[1]);
  if (d < 0.45) return 9;
  let m = 9;
  for (let k = 0; k < FLOWS.length; k++) {
    const [px, pz] = lavaPoint(k, d);
    m = Math.min(m, Math.hypot(x - px, z - pz));
  }
  return m;
};

export default {
  id: 'volcano',
  name: 'Volcanic Island',
  kicker: 'Active stratovolcano · dusk',
  blurb: 'Three rivers of lava spill from a smoking crater and hiss into a dark sea. Palms cling to the black-sand shore beneath the ash plume.',
  facts: [['Biome', 'Basalt shore'], ['Summit', '1,120 m'], ['Lava', '1,150 °C']],
  theme: 'dark',
  bg: ['#4a2a36', '#120b13'],
  accent: '#ff8a4c',
  light: { sky: '#6a5a8f', ground: '#3a1512', hemi: 0.75, sun: '#ffb59a', sunI: 1.9, sunPos: [6, 5, 5], env: 0.14 },
  view: { y: 1.1, zoom: 1.06 },

  build() {
    const rand = rng(505);
    const { fbm } = makeNoise(53);
    const group = new THREE.Group();

    const h = (x, z) => {
      const d = Math.hypot(x - C[0], z - C[1]);
      const n = fbm(x * 0.5 + 9, z * 0.5 + 2);
      let y = -0.6 + 0.85 * smooth(4.4, 2.9, d + (n - 0.5) * 2.2);
      y += 3.3 * Math.exp(-((d / 1.75) ** 2)) * (0.85 + 0.3 * n);
      y -= 1.0 * smooth(0.7, 0.15, d);
      y -= 0.07 * smooth(0.3, 0.08, lavaDist(x, z)) * smooth(-0.1, 0.2, y);
      return y;
    };

    group.add(terrain({
      height: h,
      strata: ['#3a3438', '#2a2529', '#1d191c'],
      color: (x, y, z, ny) => {
        const n = fbm(x * 1.4 + 3, z * 1.4);
        if (y < 0) return mix('#3a3636', '#1f3a40', smooth(0, -0.6, y));
        let c = mix('#2b282e', '#4c454b', n);
        if (y < 0.14) c = mix('#3d3838', '#55504d', n);
        else if (y < 0.95 && ny > 0.8 && n > 0.47) c = mix('#2f5a3a', '#44754a', fbm(x * 3, z * 3));
        else if (y > 2.2) c = mix(c, '#5a3a34', smooth(2.2, 3, y));
        return mix(c, '#8a2c10', smooth(0.42, 0.1, lavaDist(x, z)) * 0.85);
      },
    }));

    const sea = water({ level: 0, wall: true, color: '#1f6470', opacity: 0.78, amp: 0.024 });
    group.add(sea.group);

    // lava: ribbons that hug the slope, plus the crater lake
    const lavaMat = new THREE.MeshBasicMaterial({ color: '#ff6a1a', toneMapped: false, side: THREE.DoubleSide });
    const mouths = [];
    for (let k = 0; k < FLOWS.length; k++) {
      const pts = [];
      for (let d = 0.42; d < 4.7; d += 0.09) {
        const [x, z] = lavaPoint(k, d);
        if (h(x, z) < -0.03) break;
        pts.push([x, z, d]);
      }
      mouths.push(pts[pts.length - 1]);
      const pos = [];
      const edge = (i, side) => {
        const [x, z, d] = pts[i];
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
        const tx = p1[0] - p0[0], tz = p1[1] - p0[1], len = Math.hypot(tx, tz) || 1;
        const w = 0.055 + 0.03 * d * (0.75 + 0.25 * Math.sin(d * 5 + k));
        const ex = x + (-tz / len) * w * side, ez = z + (tx / len) * w * side;
        return [ex, Math.max(h(ex, ez), h(x, z)) + 0.045, ez];
      };
      for (let i = 0; i < pts.length - 1; i++) {
        const a = edge(i, -1), b2 = edge(i, 1), c = edge(i + 1, -1), d2 = edge(i + 1, 1);
        pos.push(...a, ...c, ...b2, ...b2, ...c, ...d2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      group.add(new THREE.Mesh(geo, lavaMat));
    }
    const craterY = h(C[0], C[1]) + 0.16;
    const lake = new THREE.Mesh(new THREE.CircleGeometry(0.56, 18).rotateX(-Math.PI / 2), lavaMat);
    lake.position.set(C[0], craterY, C[1]);
    group.add(lake);

    const b = new Batch();
    const taken = [];
    const cool = (x, z) => lavaDist(x, z) > 0.5;
    const basalt = ['#2b282e', '#3a363c', '#201d22'];

    // field station
    const [fx, fz] = scatter(rand, 1, (x, z) => { const y = h(x, z); return y > 0.14 && y < 0.3 && lavaDist(x, z) > 0.9 && x + z > 2; }, { taken, gap: 0.6 })[0] || [3, 0.5];
    b.at([fx, h(fx, fz) - 0.04, fz], rand() * TAU, 1, () => {
      b.add(G.box(0.4, 0.2, 0.3), '#e9e6df');
      b.add(G.box(0.44, 0.04, 0.34), '#ff7a3c', { p: [0, 0.2, 0] });
      b.add(G.box(0.03, 0.12, 0.08), '#2f3338', { p: [0.2, 0, 0] });
      b.add(G.cyl(0.006, 0.006, 0.4, 4), '#c9ccd2', { p: [-0.12, 0.24, -0.08] });
      b.add(G.cone(0.06, 0.03, 8), '#c9ccd2', { p: [0.1, 0.27, 0.05], r: [0.6, 0, 0] });
      b.add(G.box(0.12, 0.1, 0.12), '#3f7f9a', { p: [0.4, 0, 0.1] });
    });

    for (const [x, z] of scatter(rand, 9, (x, z) => { const y = h(x, z); return y > 0.1 && y < 0.5 && cool(x, z); }, { taken, gap: 0.5 })) {
      b.at([x, h(x, z) - 0.03, z], rand() * TAU, rand.range(0.75, 1.05), () => palm(b, rand, ['#2f7a4a', '#256a40']));
    }
    for (const [x, z] of scatter(rand, 22, (x, z) => { const y = h(x, z); return y > 0.1 && y < 0.9 && cool(x, z); }, { taken, gap: 0.24 })) {
      b.at([x, h(x, z), z], 0, 1, () => bush(b, rand, ['#2f5a3a', '#3a6a44', '#44754a'], 0.11));
    }
    // charred trees near the flows
    for (const [x, z] of scatter(rand, 12, (x, z) => { const y = h(x, z), l = lavaDist(x, z); return y > 0.2 && y < 1.7 && l > 0.25 && l < 0.9; }, { taken, gap: 0.3 })) {
      const y = h(x, z) - 0.03, t = rand.range(0.3, 0.5);
      b.add(G.cyl(0.012, 0.03, t, 5), '#1a1617', { p: [x, y, z], r: [rand.range(-0.15, 0.15), 0, rand.range(-0.15, 0.15)] });
      for (let i = 0; i < 2; i++) {
        const a = rand() * TAU;
        b.add(G.beam([x, y + t * (0.5 + i * 0.2), z], [x + Math.cos(a) * 0.12, y + t * (0.8 + i * 0.2), z + Math.sin(a) * 0.12], 0.009, 4), '#1a1617');
      }
    }
    for (const [x, z] of scatter(rand, 34, (x, z) => h(x, z) > 0.05 && h(x, z) < 2.6 && lavaDist(x, z) > 0.2, { taken, gap: 0.2 })) {
      b.at([x, h(x, z), z], 0, 1, () => rock(b, rand, rand.range(0.07, 0.22), basalt));
    }
    // sea stacks
    for (const [x, z] of scatter(rand, 6, (x, z) => h(x, z) < -0.35 && Math.hypot(x, z) > 3.6, { taken, gap: 0.8, rmax: 4.5 })) {
      const n = 2 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) {
        b.add(G.cyl(0.06, 0.16, rand.range(0.9, 1.5) - i * 0.25, 5), basalt[i % 3], { p: [x + i * 0.14 * Math.cos(i * 2), -0.7, z + i * 0.14 * Math.sin(i * 2)], r: [0, rand() * TAU, 0] });
      }
    }
    group.add(b.build());

    // plume, steam, embers, glow
    const plume = smoke({ origin: [C[0], craterY + 0.15, C[1]], color: '#4a4046', count: 10, rise: 3.3, spread: 1.0, size: 0.3, grow: 2.6, speed: 0.07, opacity: 0.92 });
    const steam = mouths.map(([x, z]) => smoke({ origin: [x, 0.05, z], color: '#e9e4e6', count: 5, rise: 0.9, spread: 0.25, size: 0.07, grow: 2.4, speed: 0.22, opacity: 0.6 }));
    const embers = particles({
      count: 90, color: '#ffa040', size: 0.09, additive: true,
      place: () => [C[0] + rand.range(-0.4, 0.4), craterY + rand() * 2.2, C[1] + rand.range(-0.4, 0.4)],
    });
    const seeds = Array.from({ length: 90 }, () => [rand.range(-1, 1), rand.range(0.4, 1), rand.range(-1, 1)]);
    const halo = glow('#ff5a1e', 3.4, 0.55);
    halo.position.set(C[0], craterY + 0.3, C[1]);
    const craterLight = new THREE.PointLight('#ff5a1e', 14, 10, 1.8);
    craterLight.position.set(C[0], craterY + 0.9, C[1]);
    group.add(plume.group, embers, halo, craterLight, ...steam.map((s) => s.group));
    const flowLights = mouths.map(([x, z], k) => {
      const [mx, mz] = lavaPoint(k, 2.2);
      const l = new THREE.PointLight('#ff6a2a', 5, 4.5, 1.8);
      l.position.set(mx, h(mx, mz) + 0.5, mz);
      const g = glow('#ff5a1e', 1.1, 0.5);
      g.position.set(x, 0.12, z);
      group.add(l, g);
      return l;
    });

    const hot = new THREE.Color('#ffb02e'), warm = new THREE.Color('#ff4a12');
    return {
      group,
      update(t, dt) {
        sea.update(t);
        plume.update(t);
        steam.forEach((s) => s.update(t));
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1);
        lavaMat.color.copy(warm).lerp(hot, 0.25 + pulse * 0.45);
        craterLight.intensity = 11 + pulse * 7;
        halo.material.opacity = 0.42 + pulse * 0.22;
        flowLights.forEach((l, i) => (l.intensity = 4 + Math.sin(t * 2.1 + i * 2) * 1.2));
        const p = embers.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const s = seeds[i];
          let y = p.getY(i) + dt * s[1] * 0.9;
          let x = p.getX(i) + dt * s[0] * 0.25, z = p.getZ(i) + dt * s[2] * 0.25;
          if (y > craterY + 2.4) { y = craterY; x = C[0] + s[0] * 0.35; z = C[1] + s[2] * 0.35; }
          p.setXYZ(i, x, y, z);
        }
        p.needsUpdate = true;
      },
    };
  },
};
