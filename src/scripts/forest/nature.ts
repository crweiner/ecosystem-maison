/**
 * The forest's shared materials: bark, foliage and rock. Each is painted per
 * pixel from noise and light direction, so trunks read as round, crowns as
 * clumps of leaves, and cliffs as broken stone, at any size.
 */
import { bayer, hash, mix, noise2, pack, unpack, type RGB } from './color';
import type { Frame } from './raster';

/**
 * A round trunk. `tones` runs deep shade → shade → base → lit → rim.
 * Bark grooves run vertically; the foot flares into roots.
 */
export function trunk(
  f: Frame,
  x: number,
  w: number,
  y0: number,
  y1: number,
  tones: number[],
  sunSide: number,
  seed: number,
  opts: { rim?: boolean; flare?: number } = {},
) {
  const flare = opts.flare ?? 0;
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(f.h - 1, y1); y++) {
    const fl = flare && y > y1 - flare * 3 ? Math.round(((y - (y1 - flare * 3)) / (flare * 3)) ** 2 * flare) : 0;
    const a = Math.round(x - fl);
    const b = Math.round(x + w + fl);
    const span = b - a;
    for (let px = a; px < b; px++) {
      const u = (px - a + 0.5) / span;
      const light = sunSide > 0 ? u : 1 - u;
      // Round shading: dark on the far limb, a lit band toward the sun.
      let t = light > 0.8 ? 3 : light > 0.45 ? 2 : light > 0.16 ? 1 : 0;
      // Grooves: vertical dashes that break the bands.
      const col = px - Math.round(x);
      const g = hash(col, Math.floor((y + hash(col, 0, seed) * 13) / (5 + Math.floor(hash(col, 1, seed) * 7))), seed);
      if (g < 0.22 && t > 0) t--;
      else if (g > 0.93 && t < 3) t++;
      if (opts.rim && px === (sunSide > 0 ? b - 1 : a)) t = 4;
      f.px(px, y, tones[t]);
    }
  }
}

/**
 * A crown of leaves. `blobs` sketch the crown's shape; noise breaks the edge
 * into leafy clumps, and each clump is lit on its sunward top.
 */
export function foliage(
  f: Frame,
  blobs: { x: number; y: number; rx: number; ry: number }[],
  tones: number[],
  sunX: number,
  seed: number,
  accent?: { tone: number; rate: number },
) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const b of blobs) {
    x0 = Math.min(x0, b.x - b.rx - 3);
    x1 = Math.max(x1, b.x + b.rx + 3);
    y0 = Math.min(y0, b.y - b.ry - 3);
    y1 = Math.max(y1, b.y + b.ry + 3);
  }
  const field = (x: number, y: number) => {
    let v = 0;
    for (const b of blobs) {
      const dx = (x - b.x) / b.rx;
      const dy = (y - b.y) / b.ry;
      v = Math.max(v, 1 - (dx * dx + dy * dy));
    }
    return v + (noise2(x * 0.28, y * 0.28, seed) - 0.5) * 0.55 + (noise2(x * 0.7, y * 0.7, seed + 1) - 0.5) * 0.2;
  };
  const sunDir = Math.sign(sunX - (x0 + x1) / 2) || 1;
  const bx = Math.floor(x0);
  const by = Math.floor(y0);
  const bw = Math.ceil(x1) - bx + 1;
  const bh = Math.ceil(y1) - by + 1;
  // First pass: which pixels are leaves.
  const mask = new Uint8Array(bw * bh);
  for (let j = 0; j < bh; j++) {
    for (let i = 0; i < bw; i++) {
      const x = bx + i;
      const y = by + j;
      const v = field(x, y);
      if (v < 0.2) continue;
      if (v < 0.28 && bayer(x, y) < 6) continue;
      mask[j * bw + i] = 1;
    }
  }
  // Keep only leaves that belong to the crown: noise can leave tiny islands
  // floating off the edge, and those read as stray specks in the sky.
  const label = new Int32Array(bw * bh).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let k = 0; k < mask.length; k++) {
    if (!mask[k] || label[k] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    label[k] = id;
    stack.push(k);
    while (stack.length) {
      const q = stack.pop()!;
      n++;
      const qi = q % bw;
      const qj = (q - qi) / bw;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ni = qi + di;
          const nj = qj + dj;
          if (ni < 0 || nj < 0 || ni >= bw || nj >= bh) continue;
          const nk = nj * bw + ni;
          if (mask[nk] && label[nk] < 0) {
            label[nk] = id;
            stack.push(nk);
          }
        }
      }
    }
    sizes.push(n);
  }
  const largest = Math.max(0, ...sizes);
  const minSize = Math.max(40, largest * 0.05);
  // Second pass: light and paint the crown.
  for (let j = 0; j < bh; j++) {
    for (let i = 0; i < bw; i++) {
      const k = j * bw + i;
      if (!mask[k] || sizes[label[k]] < minSize) continue;
      const x = bx + i;
      const y = by + j;
      const v = field(x, y);
      // Light from above and from the sun's side: compare with the neighbour toward the light.
      const above = field(x - sunDir * 1.5, y - 2.5);
      const clump = noise2(x * 0.45, y * 0.45, seed + 7);
      let t = 2;
      if (above < 0.12) t = 3;
      else if (above < v - 0.12 && clump > 0.45) t = 3;
      if (v > 0.55 && clump < 0.32) t = 1;
      if (y > (y0 + y1) / 2 + (y1 - y0) * 0.22 && t > 2) t--;
      let c = tones[t];
      if (accent && hash(x, y, seed + 3) < accent.rate) c = accent.tone;
      f.px(x, y, c);
    }
  }
}

/** Broken rock: faceted by noise cells, lit on upward and sunward faces. */
export function rock(f: Frame, inside: (x: number, y: number) => boolean, box: [number, number, number, number], tones: number[], sunSide: number, seed: number, moss?: number[]) {
  const [x0, y0, x1, y1] = box;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      const openAbove = !inside(x, y - 1);
      const openSun = !inside(x + sunSide, y);
      const facet = noise2(x * 0.18, y * 0.3, seed);
      const crack = noise2(x * 0.5, y * 0.12, seed + 5);
      let t = facet > 0.62 ? 3 : facet > 0.38 ? 2 : 1;
      if (Math.abs(crack - 0.5) < 0.035) t = 0;
      if (openSun && t < 3) t++;
      if (openAbove) t = 3;
      let c = tones[t];
      if (moss && (openAbove || (!inside(x, y - 2) && bayer(x, y) < 10))) c = moss[hash(x, y, seed) < 0.5 ? 3 : 2];
      f.px(x, y, c);
    }
  }
}

/** Blend a packed pixel toward a colour, fast. */
export function blendPx(p: number, c: RGB, k: number): number {
  const r = p & 255;
  const g = (p >> 8) & 255;
  const b = (p >> 16) & 255;
  return (0xff000000 | (Math.round(b + (c[2] - b) * k) << 16) | (Math.round(g + (c[1] - g) * k) << 8) | Math.round(r + (c[0] - r) * k)) >>> 0;
}

/** Tone ramp pulled toward haze (for depth) and ink (for nearness). */
export function hazeTones(tones: number[], haze: RGB, k: number): number[] {
  return tones.map((t) => pack(mix(unpack(t), haze, k)));
}
