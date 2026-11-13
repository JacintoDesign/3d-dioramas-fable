// Props shared between worlds. Each draws into a Batch in local space
// (origin at the prop's foot) — wrap the call in batch.at() to place it.
import { G, TAU } from './kit.js';

export function pine(b, rand, tone = ['#2f5d43', '#3a6e4c', '#274f3b'], snowy = false) {
  const h = rand.range(0.9, 1.6);
  const tiers = 3 + (rand() < 0.5 ? 1 : 0);
  b.add(G.cyl(0.045, 0.07, h * 0.35, 6), '#5b4030');
  for (let t = 0; t < tiers; t++) {
    const f = t / tiers;
    const color = snowy && t === tiers - 1 ? '#eef3f7' : tone[t % tone.length];
    b.add(G.cone(0.44 * (1 - f * 0.62), h * 0.42, 7), color, { p: [0, h * 0.2 + f * h * 0.7, 0], r: [0, rand() * TAU, 0] });
  }
}

export function palm(b, rand, greens = ['#3f8f4f', '#2f7a45']) {
  const h = rand.range(1.1, 1.7), lean = rand.range(0.15, 0.5);
  const segs = 6, sh = h / segs;
  let x = 0, y = 0;
  for (let i = 0; i < segs; i++) {
    const f = i / segs, tilt = lean * (f + 0.15);
    b.add(G.cyl(0.05 - f * 0.018, 0.062 - f * 0.018, sh * 1.15, 6), i % 2 ? '#8b6b4a' : '#7c5d40', { p: [x, y, 0], r: [0, 0, -tilt] });
    x += Math.sin(tilt) * sh;
    y += Math.cos(tilt) * sh;
  }
  const n = 8;
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + rand() * 0.4;
    b.add(G.cone(0.13, rand.range(0.6, 0.85), 4), greens[i % 2], {
      p: [x, y, 0],
      r: [0, az, -(Math.PI / 2 + rand.range(0.1, 0.55))],
      s: [0.28, 1, 1],
    });
  }
  for (let i = 0; i < 3; i++) b.add(G.ico(0.045), '#5a4028', { p: [x + Math.cos(i * 2.1) * 0.06, y - 0.05, Math.sin(i * 2.1) * 0.06] });
}

export function rock(b, rand, size = 0.2, colors = ['#7d7b76', '#8f8c85', '#6a6864']) {
  b.add(G.ico(size, 0), rand.pick(colors), {
    p: [0, size * 0.22, 0],
    r: [rand() * 3, rand() * 3, rand() * 3],
    s: [rand.range(0.8, 1.4), rand.range(0.5, 0.9), rand.range(0.8, 1.3)],
  });
}

export function bush(b, rand, colors = ['#4f8a4a', '#3f7a45', '#5f9a52'], size = 0.16) {
  const n = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    b.add(G.ico(size * rand.range(0.7, 1.1), 1), rand.pick(colors), {
      p: [rand.range(-0.1, 0.1), size * 0.5, rand.range(-0.1, 0.1)],
      s: [1, 0.8, 1],
    });
  }
}

/** round-crowned broadleaf tree */
export function tree(b, rand, greens = ['#3f8a4a', '#4f9f55', '#2f7a45']) {
  const h = rand.range(0.35, 0.6);
  b.add(G.cyl(0.04, 0.06, h, 6), '#6b4a34');
  for (let i = 0; i < 3; i++) {
    b.add(G.ico(rand.range(0.2, 0.3), 1), rand.pick(greens), { p: [rand.range(-0.14, 0.14), h + rand.range(0.05, 0.25), rand.range(-0.14, 0.14)] });
  }
}

/** tiny figure, facing +x */
export function person(b, body = '#c0392b', skin = '#e8c39e', legs = '#2f3640') {
  b.add(G.box(0.05, 0.1, 0.07), legs);
  b.add(G.box(0.055, 0.11, 0.08), body, { p: [0, 0.1, 0] });
  b.add(G.ico(0.04, 1), skin, { p: [0, 0.25, 0] });
}

/** four-legged animal built from boxes, facing +x */
export function quadruped(b, { body, leg = body, len = 0.3, height = 0.18, girth = 0.11, neck = 0.16, head = 0.12 }) {
  b.add(G.box(len, girth * 1.15, girth), body, { p: [0, height, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(G.box(0.03, height + 0.02, 0.03), leg, { p: [sx * (len / 2 - 0.03), 0, sz * (girth / 2 - 0.02)] });
  b.add(G.box(0.055, neck, girth * 0.6), body, { p: [len / 2 - 0.02, height + girth * 0.8, 0], r: [0, 0, -0.5] });
  const hx = len / 2 - 0.02 + Math.sin(0.5) * neck, hy = height + girth * 0.8 + Math.cos(0.5) * neck;
  b.add(G.box(head, 0.06, girth * 0.62), body, { p: [hx - 0.01, hy - 0.02, 0] });
  return [hx, hy];
}
