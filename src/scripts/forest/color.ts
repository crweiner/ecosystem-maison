/**
 * Colour for the forest: packed pixels, and the one day the sky runs through.
 *
 * Every colour on the canvas comes from a keyframed day palette. Surfaces are
 * lit from it (sun, ambient and rim), so a deer at dawn and the same deer at
 * noon are the same sprite under different light.
 */

export type RGB = [number, number, number];

export function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function scale(a: RGB, k: number): RGB {
  return [a[0] * k, a[1] * k, a[2] * k];
}

/** Multiply blend, the way light tints a surface. */
export function tint(a: RGB, light: RGB): RGB {
  return [(a[0] * light[0]) / 255, (a[1] * light[1]) / 255, (a[2] * light[2]) / 255];
}

/** Pack to a canvas ImageData word (little-endian ABGR), fully opaque. */
export function pack(c: RGB): number {
  const r = Math.max(0, Math.min(255, Math.round(c[0])));
  const g = Math.max(0, Math.min(255, Math.round(c[1])));
  const b = Math.max(0, Math.min(255, Math.round(c[2])));
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

export function unpack(p: number): RGB {
  return [p & 255, (p >> 8) & 255, (p >> 16) & 255];
}

/** Mix two packed pixels. */
export function mixPacked(a: number, b: number, t: number): number {
  return pack(mix(unpack(a), unpack(b), t));
}

/** The palette of one moment of the day. */
export interface Sky {
  /** Sky bands from zenith to horizon. */
  top: RGB;
  upper: RGB;
  lower: RGB;
  horizon: RGB;
  sun: RGB;
  glow: RGB;
  /** Aerial haze that far layers dissolve into. */
  haze: RGB;
  /** Farthest ridge and nearest ridge before haze. */
  far: RGB;
  ridge: RGB;
  /** Colour of direct light on a lit surface. */
  light: RGB;
  /** Colour shadows fall toward. */
  shade: RGB;
  /** Meadow grass in light. */
  grass: RGB;
  /** Near-black of the forest floor and the deepest shade. */
  ink: RGB;
  /** Water's own body colour, under the reflection. */
  water: RGB;
  /** 0 at noon, 1 at night: how much the world sinks into shade. */
  dim: number;
  /** How strongly figures read as backlit silhouettes (low sun). */
  backlit: number;
}

type Key = [number, Record<keyof Omit<Sky, 'dim' | 'backlit'>, string>, number, number];

const KEYS: Key[] = [
  [5.4, { top: '#120f28', upper: '#221a3e', lower: '#44305a', horizon: '#8a4c66', sun: '#ffc98a', glow: '#b0586a', haze: '#5a4264', far: '#3a2e52', ridge: '#241f38', light: '#b98a9a', shade: '#1a1530', grass: '#243a36', ink: '#0a0b12', water: '#1a1a34' }, 0.9, 0.9],
  [6.2, { top: '#2e1d46', upper: '#6a3664', lower: '#d4667a', horizon: '#ff9468', sun: '#fff4d2', glow: '#ffb070', haze: '#b98284', far: '#6d4d6c', ridge: '#3c3350', light: '#ffc09a', shade: '#2a2140', grass: '#3d5a3e', ink: '#0d0d16', water: '#3a2e52' }, 0.45, 1],
  [7.4, { top: '#34528e', upper: '#5c7fb4', lower: '#b0b6c8', horizon: '#f5cf9a', sun: '#fff8e0', glow: '#fbe0a6', haze: '#a9b4c4', far: '#7f8fa8', ridge: '#556a7e', light: '#ffe6c0', shade: '#2e3a52', grass: '#557f3c', ink: '#0e1318', water: '#34507a' }, 0.2, 0.55],
  [10, { top: '#2f6cc0', upper: '#5494d8', lower: '#98c6e8', horizon: '#d6ecf2', sun: '#fffef4', glow: '#eaf6f8', haze: '#b2d0e0', far: '#84a8c0', ridge: '#5b8490', light: '#fff6e0', shade: '#2c4458', grass: '#6a9e44', ink: '#0f161a', water: '#3a6d96' }, 0, 0.12],
  [13, { top: '#2a66bd', upper: '#4f92dc', lower: '#94c8ee', horizon: '#d2eaf4', sun: '#ffffff', glow: '#eef8fb', haze: '#aed0e4', far: '#7ea8c4', ridge: '#57868c', light: '#fffaf0', shade: '#2a4456', grass: '#6fa648', ink: '#0f161a', water: '#386c98' }, 0, 0.08],
  [16, { top: '#3868b2', upper: '#6a98cf', lower: '#b2cadc', horizon: '#ecdcb4', sun: '#fff2cc', glow: '#f8e4b0', haze: '#c0c4c0', far: '#8c9cac', ridge: '#617a78', light: '#ffeccc', shade: '#2e3e50', grass: '#77973f', ink: '#10151a', water: '#3e6488' }, 0.08, 0.3],
  [17.9, { top: '#34457f', upper: '#6d6a9c', lower: '#cf8e78', horizon: '#f5b25e', sun: '#ffe196', glow: '#ffbf66', haze: '#c28e7e', far: '#836878', ridge: '#524a60', light: '#ffc98a', shade: '#2c2a46', grass: '#6a7334', ink: '#0e0e16', water: '#4a4a70' }, 0.3, 0.75],
  [19.2, { top: '#271f4a', upper: '#5e3564', lower: '#bf4c66', horizon: '#f5763e', sun: '#ffcc6c', glow: '#ff9446', haze: '#9c5268', far: '#5a3858', ridge: '#352842', light: '#ff9e6a', shade: '#241c38', grass: '#3f3a30', ink: '#0b0a12', water: '#3a2448' }, 0.55, 1],
  [20, { top: '#100f2a', upper: '#231d46', lower: '#4e2e58', horizon: '#9a4656', sun: '#ff8850', glow: '#b8504e', haze: '#4e3452', far: '#322644', ridge: '#1f1a30', light: '#b87a86', shade: '#15122a', grass: '#20262a', ink: '#08080e', water: '#1c1836' }, 0.85, 0.95],
];

const PARSED = KEYS.map(([h, c, dim, backlit]) => {
  const out: Record<string, RGB> = {};
  for (const k in c) out[k] = hex((c as Record<string, string>)[k]);
  return { h, c: out, dim, backlit };
});

/** The sky at an hour of the forest's day, interpolated between keyframes. */
export function skyAt(hour: number): Sky {
  let i = 0;
  while (i < PARSED.length - 2 && hour > PARSED[i + 1].h) i++;
  const a = PARSED[i];
  const b = PARSED[i + 1];
  const t = Math.max(0, Math.min(1, (hour - a.h) / (b.h - a.h)));
  const s: Record<string, unknown> = {};
  for (const k in a.c) s[k] = mix(a.c[k], b.c[k], t);
  s.dim = a.dim + (b.dim - a.dim) * t;
  s.backlit = a.backlit + (b.backlit - a.backlit) * t;
  return s as unknown as Sky;
}

/** Sun elevation for an hour, 0 on the horizon and 1 at its highest. */
export function sunElevation(hour: number): number {
  const t = (hour - 6) / (19.4 - 6);
  return Math.max(-0.2, Math.sin(Math.max(-0.1, Math.min(1.1, t)) * Math.PI));
}

/**
 * A material lit by the current sky. Tones: 0 deep shade, 1 shade, 2 base,
 * 3 lit, 4 rim (edge catching the sun). Backlit hours pull everything toward
 * silhouette so low suns read like Sworcery dawns.
 */
export class Material {
  private cache = new Map<Sky, number[]>();
  constructor(private albedo: RGB) {}

  tones(sky: Sky): number[] {
    let t = this.cache.get(sky);
    if (t) return t;
    const base = mix(tint(this.albedo, mix(sky.light, [255, 255, 255], 0.35)), sky.shade, sky.dim * 0.55);
    const sil = sky.backlit * 0.55;
    const flat = mix(base, sky.shade, sil);
    t = [
      pack(mix(flat, sky.ink, 0.62)),
      pack(mix(flat, sky.shade, 0.42)),
      pack(flat),
      pack(mix(flat, mix(this.albedo, sky.light, 0.5), 0.45 - sil * 0.35)),
      pack(mix(sky.sun, sky.light, 0.4)),
    ];
    if (this.cache.size > 24) this.cache.clear();
    this.cache.set(sky, t);
    return t;
  }
}

/** 4x4 ordered dither threshold, 0..15. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)];
}

/** Stable hash noise in 0..1 for integer coordinates and a seed. */
export function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise in 0..1. */
export function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i, 0, seed);
  const b = hash(i + 1, 0, seed);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

/** Seeded random generator, for laying out a scene the same way every time. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Smooth 2D value noise in 0..1. */
export function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
