/**
 * The forest's creatures, drawn at the world's own pixel scale.
 *
 * The deer and the bear are small puppets (ellipses and jointed limbs
 * rasterised with no anti-aliasing) so they can graze, look up, gallop and
 * lunge. The small creatures are a handful of pixels each. Every one of them
 * is lit by the current sky through a Material, so dawn turns them into
 * rim-lit silhouettes and noon shows their colour.
 */
import { Material, hex, mix, pack, type Sky } from './color';
import { sprite, type Frame } from './raster';

export const FUR = new Material(hex('#a4653a'));
export const CREAM = new Material(hex('#ead6b4'));
export const HOOF = new Material(hex('#2a1c16'));
export const ANTLER = new Material(hex('#d6c3a0'));
export const BEAR = new Material(hex('#5c3b25'));
export const BEAR_MUZZLE = new Material(hex('#8a6242'));
export const BEAVER = new Material(hex('#6e4526'));
export const SQUIRREL = new Material(hex('#b4622c'));
export const SALMON = new Material(hex('#d27a6a'));
export const SALMON_BACK = new Material(hex('#6f6f7a'));
export const HUMMER = new Material(hex('#2f9a64'));
export const THROAT = new Material(hex('#d4304a'));
export const SPIDER = new Material(hex('#3a2a22'));
export const ACORN = new Material(hex('#9a6a34'));
export const CAP = new Material(hex('#5a3c22'));

/** Shade a volume: lit on top, shaded below, rim on the sun side when backlit. */
function volume(tones: number[], sky: Sky, sunSide: number, belly?: number[], rim = true) {
  return (nx: number, ny: number): number => {
    const r2 = nx * nx + ny * ny;
    if (rim && sky.backlit > 0.4 && r2 > 0.62 && nx * sunSide > 0.35 && ny < 0.5) return tones[4];
    if (belly && ny > 0.42) return belly[ny > 0.75 ? 1 : 2];
    if (ny < -0.5) return tones[3];
    if (ny > 0.55) return tones[1];
    return tones[2];
  };
}

function thick(f: Frame, x0: number, y0: number, x1: number, y1: number, c: number, w: number) {
  f.line(x0, y0, x1, y1, c);
  if (w > 1) f.line(x0 + 1, y0, x1 + 1, y1, c);
  if (w > 2) f.line(x0 - 1, y0, x1 - 1, y1, c);
}

/* ------------------------------------------------------------------ deer */

export interface DeerPose {
  /** 0 grazing with the muzzle in the grass, 1 head up and alert. */
  head: number;
  /** Ears: -1 turned back, 0 rest, 1 pricked forward. */
  ears: number;
  /** Tail flick, 0..1. */
  tail: number;
  /** Gallop phase in radians; NaN when standing. */
  gait: number;
  /** Chewing bob, in pixels. */
  chew: number;
}

/**
 * A red deer stag, about 30 px tall with the head up. (x, y) is the point on
 * the ground under its middle; dir is 1 facing right, -1 facing left.
 */
export function drawDeer(f: Frame, sky: Sky, x: number, y: number, dir: number, p: DeerPose, sunSide: number) {
  const S = 1.3;
  const fur = FUR.tones(sky);
  const cream = CREAM.tones(sky);
  const hoof = HOOF.tones(sky)[1];
  const bone = ANTLER.tones(sky);
  const running = !Number.isNaN(p.gait);
  const X = (dx: number) => x + dx * S * dir;
  const lift = running ? -Math.round(Math.abs(Math.sin(p.gait)) * 4) : 0;
  const legLen = 12 * S;
  const by = y - legLen - 2 * S + lift;
  const stretch = running ? 1.6 : 0;

  // Legs: far pair first, in shade, then the body, then the near pair.
  const leg = (hx: number, hy: number, a: number, bend: number, c: number, cl: number, thighW: number) => {
    const up = 5.5 * S;
    const low = 6.5 * S;
    const kx = X(hx) + Math.sin(a) * up * dir;
    const ky = hy + Math.cos(a) * up;
    const a2 = a + bend;
    const fx = kx + Math.sin(a2) * low * dir;
    const fy = ky + Math.cos(a2) * low;
    thick(f, X(hx), hy, kx, ky, c, thighW);
    f.line(kx, ky, fx, fy, cl);
    f.px(fx, fy, hoof);
    f.px(fx + dir, fy, hoof);
  };
  const fa = running ? Math.sin(p.gait) * 0.95 : 0.05;
  const ha = running ? Math.sin(p.gait + Math.PI * 0.9) * 0.85 : -0.06;
  const fb = running ? (Math.sin(p.gait) > 0 ? -0.2 : -1.1) : -0.02;
  const hb = running ? (Math.sin(p.gait + Math.PI * 0.9) > 0 ? 0.9 : 0.15) : 0.08;
  leg(5 + stretch, by + 2 * S, fa + 0.3, fb, fur[1], fur[0], 2);
  leg(-5.5 - stretch, by + 2 * S, ha - 0.28, hb, fur[1], fur[0], 3);

  // Body: haunch, barrel, deep chest. Cream belly and a pale rump patch.
  // No per-part rim here: the scene traces one continuous rim around the whole silhouette.
  const shade = volume(fur, sky, sunSide * dir, undefined, false);
  const barrel = volume(fur, sky, sunSide * dir, cream, false);
  f.ellipse(X(-5.5 - stretch), by - 0.6 * S, 4.4 * S, 4.8 * S, shade);
  f.ellipse(X(0), by, (8 + stretch) * S, 4.2 * S, barrel);
  f.ellipse(X(5.5 + stretch), by - 0.4 * S, 4 * S, 4.7 * S, shade);
  const rumpX = X(-9.4 - stretch);
  f.px(rumpX, by - 2 * S, cream[2]);
  f.px(rumpX, by - 2 * S + 1, cream[2]);
  // Tail: a short flag that flicks up.
  f.px(rumpX - dir, by - 3 * S - Math.round(p.tail * 2), fur[2]);
  f.px(rumpX - dir, by - 2 * S - Math.round(p.tail * 2), cream[2]);

  leg(4 + stretch, by + 2 * S, -fa * 0.8 + 0.1, fb, fur[2], fur[1], 2);
  leg(-5 - stretch, by + 2 * S, -ha * 0.8, hb, fur[2], fur[1], 3);

  // Neck and head. Grazing swings the head down to the grass.
  const h = running ? 0.85 : p.head;
  const nx0 = X(7.5 + stretch);
  const ny0 = by - 2.5 * S;
  const hx = X(9.5 + stretch + (1 - h) * 4 + (running ? 2.5 : 0));
  const hy = y - 2 * S + (by - 10 * S - (y - 2 * S)) * h + (h < 0.5 ? p.chew : 0);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const r = (2.6 - t * 0.7) * S;
    f.ellipse(nx0 + (hx - nx0) * t, ny0 + (hy - ny0) * t, r, r, shade);
  }
  const headShade = volume(fur, sky, sunSide * dir, undefined, false);
  f.ellipse(hx, hy, 3 * S * 0.9, 2.3 * S * 0.9, headShade);
  const mx = hx + dir * (1.4 + 2 * h) * S;
  const my = hy + (2 * (1 - h) + 0.6) * S;
  f.ellipse(mx, my, 1.8 * S * 0.9, 1.4 * S * 0.9, headShade);
  f.px(mx + dir * (1.6 + h * 0.5) * S, my + (1 - h) * S, hoof);
  f.px(hx + dir * 0.8 * S, hy - 0.8 * S, hoof);

  // Ears: two leaves either side of the crown, turning with attention.
  const ex = hx - dir * 1.8 * S;
  const ey = hy - 2 * S;
  const lean = p.ears > 0.5 ? 0 : p.ears < -0.5 ? -2 : -1;
  f.line(ex, ey, ex - dir * (3 + lean), ey - 2 - (p.ears > 0.5 ? 1 : 0), fur[2]);
  f.line(ex, ey + 1, ex - dir * (2 + lean), ey - 1, fur[3]);
  f.line(ex + dir * 2, ey, ex + dir * (1 - lean * 0.5), ey - 4, fur[1]);

  // Antlers: a young stag's crown, catching the light.
  const ax = hx - dir * 0.5 * S;
  const ay = hy - 2.2 * S;
  const c = bone[3];
  f.line(ax, ay, ax - dir * 3, ay - 7, c);
  f.line(ax - dir * 3, ay - 7, ax - dir * 5, ay - 10, c);
  f.line(ax - dir * 1, ay - 3, ax + dir * 2, ay - 6, c);
  f.line(ax - dir * 3, ay - 7, ax - dir * 1, ay - 11, c);
  f.line(ax - dir * 4, ay - 9, ax - dir * 7, ay - 11, c);
  f.line(ax + dir * 2, ay, ax + dir * 2, ay - 5, bone[2]);
  f.line(ax + dir * 2, ay - 5, ax + dir * 5, ay - 8, bone[2]);
  f.line(ax + dir * 2, ay - 4, ax + dir * 4, ay - 3, bone[2]);
}

/* ------------------------------------------------------------------ bear */

export interface BearPose {
  /** 0 watching the water, 1 lunging up at the falls. */
  lunge: number;
  /** Holding a salmon in its jaws. */
  fish: boolean;
  /** Breathing bob. */
  breathe: number;
}

/** A brown bear standing in the river. (x, y) is the waterline under its middle. */
export function drawBear(f: Frame, sky: Sky, x: number, y: number, dir: number, p: BearPose, sunSide: number) {
  const fur = BEAR.tones(sky);
  const muzzle = BEAR_MUZZLE.tones(sky);
  const X = (dx: number) => x + dx * dir;
  const shade = volume(fur, sky, sunSide * dir);
  const by = y - 9 + p.breathe - p.lunge * 2;
  // Legs vanish into the river; only the top of the far legs shows.
  f.rect(X(-7) - 1, by + 3, 3, 6, fur[1]);
  f.rect(X(6) - 1, by + 3, 3, 6, fur[1]);
  // Rump, barrel and the shoulder hump.
  f.ellipse(X(-6), by, 6, 6.5, shade);
  f.ellipse(X(0), by + 0.5, 9, 6, shade);
  f.ellipse(X(5), by - 2.5 - p.lunge, 5.5, 6, shade);
  f.rect(X(-5) - 1, by + 4, 4, 5, fur[2]);
  f.rect(X(4) - 1, by + 4, 4, 5, fur[2]);
  // Head reaches down to the water, or up at the falls when it lunges.
  const hx = X(11 + p.lunge * 2);
  const hy = by + 2 - p.lunge * 8;
  f.ellipse(X(8 + p.lunge), by - 1 - p.lunge * 4, 3.5, 3.6, shade);
  f.ellipse(hx, hy, 4, 3.4, shade);
  f.ellipse(hx + dir * 3, hy + 1, 2.4, 1.8, volume(muzzle, sky, sunSide * dir));
  f.px(hx + dir * 5, hy + 0.5, HOOF.tones(sky)[0]);
  f.px(hx + dir * 1, hy - 1, HOOF.tones(sky)[0]);
  // Round ears.
  f.disc(hx - dir * 2, hy - 3.5, 1.3, fur[2]);
  f.px(hx - dir * 2, hy - 4, fur[3]);
  if (p.lunge > 0.5) {
    // Open jaw.
    f.px(hx + dir * 3, hy + 2.5, fur[0]);
    f.px(hx + dir * 4, hy + 3, fur[0]);
  }
  if (p.fish) drawSalmon(f, sky, hx + dir * 3, hy + 3, dir, 0.9, sunSide);
}

/* --------------------------------------------------------------- salmon */

/** A leaping salmon, nose at (x, y), tilted by `pitch` (radians, up is negative). */
export function drawSalmon(f: Frame, sky: Sky, x: number, y: number, dir: number, pitch: number, sunSide: number) {
  const belly = SALMON.tones(sky);
  const back = SALMON_BACK.tones(sky);
  const cx = Math.cos(pitch) * dir;
  const cy = Math.sin(pitch);
  for (let i = 0; i < 7; i++) {
    const px = x - cx * i;
    const py = y - cy * i;
    const girth = i === 0 || i === 6 ? 0 : i < 5 ? 1 : 0;
    f.px(px, py, i < 2 ? back[3] : belly[i % 2 ? 3 : 2]);
    if (girth) {
      f.px(px - cy * dir, py + cx * dir * -1 + 1, back[2]);
    }
  }
  // Tail fin.
  const tx = x - cx * 7;
  const ty = y - cy * 7;
  f.px(tx, ty - 1, back[2]);
  f.px(tx, ty + 1, back[2]);
  if (sky.backlit > 0.4) f.px(x - cx * 2, y - cy * 2 - 1, belly[4]);
  void sunSide;
}

/* --------------------------------------------------------------- beaver */

/** A beaver on land or in water. `swim` hides everything under the surface. */
export function drawBeaver(f: Frame, sky: Sky, x: number, y: number, dir: number, swim: boolean, stick: boolean, bob: number, sunSide: number) {
  const fur = BEAVER.tones(sky);
  const X = (dx: number) => x + dx * dir;
  const shade = volume(fur, sky, sunSide * dir);
  if (swim) {
    // Only the head and the ridge of the back break the water.
    f.ellipse(X(-2), y, 3.5, 1.2, shade);
    f.ellipse(X(2), y - 1 + bob, 2, 1.6, shade);
    f.px(X(3), y - 2 + bob, fur[0]);
    f.px(X(4), y - 1 + bob, fur[0]);
    if (stick) {
      const wood = ACORN.tones(sky);
      f.line(X(1), y - 1 + bob, X(9), y - 3 + bob, wood[3]);
      f.line(X(1), y + bob, X(9), y - 2 + bob, wood[1]);
      f.px(X(10), y - 4 + bob, HUMMER.tones(sky)[3]);
    }
    return;
  }
  // Sitting up on the lodge, tail flat behind.
  f.rect(X(-8) - (dir > 0 ? 0 : 4), y - 1, 5, 2, fur[0]);
  f.ellipse(X(-1), y - 3 + bob, 3.5, 3.2, shade);
  f.ellipse(X(2), y - 6 + bob, 2.2, 2, shade);
  f.px(X(3), y - 7 + bob, fur[0]);
  f.px(X(4), y - 6 + bob, fur[0]);
  f.px(X(1), y - 8 + bob, fur[1]);
  f.px(X(4), y - 5 + bob, CREAM.tones(sky)[3]);
  if (stick) {
    const wood = ACORN.tones(sky);
    f.line(X(1), y - 4 + bob, X(7), y - 9 + bob, wood[3]);
    f.line(X(2), y - 4 + bob, X(8), y - 9 + bob, wood[1]);
  }
}

/* ------------------------------------------------------------- squirrel */

/**
 * A red squirrel. `mode` 'sit' is upright with an acorn at its mouth,
 * 'climb' runs up a trunk (dir 1) or down it (dir -1), 'run' is on the ground.
 */
export function drawSquirrel(f: Frame, sky: Sky, x: number, y: number, dir: number, mode: 'sit' | 'climb' | 'run', phase: number, acorn: boolean, sunSide: number) {
  const fur = SQUIRREL.tones(sky);
  const shade = volume(fur, sky, sunSide * dir);
  const X = (dx: number) => x + dx * dir;
  if (mode === 'climb') {
    // Vertical on the bark: dir 1 heads up, -1 heads down.
    const s = dir;
    const hop = Math.round(Math.sin(phase) * 1);
    f.ellipse(x, y + hop, 1.6, 3, shade);
    f.ellipse(x, y - 3 * s + hop, 1.6, 1.5, shade);
    f.px(x - 1, y - 4 * s + hop, fur[0]);
    // Tail streams behind, bushy.
    for (let i = 0; i < 5; i++) f.px(x + (i % 2 ? 1 : 0), y + (3 + i) * s + hop, fur[i > 2 ? 3 : 2]);
    f.px(x + 1, y + 7 * s + hop, fur[4 - (sky.backlit > 0.4 ? 0 : 1)]);
    if (acorn) f.px(x, y - 5 * s + hop, ACORN.tones(sky)[3]);
    return;
  }
  const sit = mode === 'sit';
  const hop = sit ? 0 : -Math.round(Math.abs(Math.sin(phase)) * 2);
  // Tail: a tall curl behind the back.
  const tail = [
    [-3, -1], [-4, -2], [-4, -3], [-5, -4], [-5, -5], [-4, -6], [-4, -7], [-3, -8], [-2, -8], [-3, -7], [-3, -6], [-3, -5], [-4, -5], [-3, -2],
  ];
  for (const [tx, ty] of tail) f.px(X(tx), y + ty + hop - (sit ? 0 : 2), ty < -6 ? fur[3] : fur[2]);
  if (sky.backlit > 0.4) f.px(X(-5), y - 5 + hop, fur[4]);
  if (sit) {
    f.ellipse(X(0), y - 2.5, 2, 2.6, shade);
    f.ellipse(X(1), y - 6 + phase, 1.8, 1.6, shade);
    f.px(X(2), y - 6 + phase, fur[0]);
    f.px(X(0), y - 8 + phase, fur[2]);
    if (acorn) {
      f.px(X(2), y - 4, ACORN.tones(sky)[3]);
      f.px(X(2), y - 5, CAP.tones(sky)[2]);
    }
  } else {
    f.ellipse(X(0), y - 2 + hop, 2.6, 1.6, shade);
    f.ellipse(X(3), y - 3 + hop, 1.6, 1.4, shade);
    f.px(X(4), y - 3 + hop, fur[0]);
    f.px(X(2), y - 5 + hop, fur[2]);
    f.px(X(-1), y + hop, fur[1]);
    f.px(X(2), y + hop, fur[1]);
    if (acorn) f.px(X(5), y - 2 + hop, ACORN.tones(sky)[3]);
  }
}

export function drawAcorn(f: Frame, sky: Sky, x: number, y: number) {
  f.px(x, y, CAP.tones(sky)[3]);
  f.px(x + 1, y, CAP.tones(sky)[2]);
  f.px(x, y + 1, ACORN.tones(sky)[3]);
  f.px(x + 1, y + 1, ACORN.tones(sky)[2]);
}

/* ---------------------------------------------------------- hummingbird */

const HUMMER_KEY = { g: 1, G: 2, h: 3, d: 4, r: 5, k: 6, w: 7 };
const HUMMER_UP = sprite(
  [
    '....w.....',
    '....ww....',
    '...wwGhd..',
    '.ggGGrr.kk',
    'gg.gg....k',
    'g.........',
  ],
  HUMMER_KEY,
);
const HUMMER_DOWN = sprite(
  [
    '..........',
    '..........',
    '...gGGhd..',
    '.ggGwrr.kk',
    'gg.ww....k',
    'g..w......',
  ],
  HUMMER_KEY,
);

/** A hummingbird hovering, beak toward dir. Wings blur between two frames. */
export function drawHummingbird(f: Frame, sky: Sky, x: number, y: number, dir: number, wing: number, sunSide: number) {
  const body = HUMMER.tones(sky);
  const throat = THROAT.tones(sky);
  const dark = HOOF.tones(sky)[1];
  const w = pack(mix(mix(sky.light, [255, 255, 255], 0.4), sky.upper, 0.3));
  const rim = sky.backlit > 0.4 && sunSide * dir > 0 ? body[4] : body[3];
  const colors = [body[1], body[3], rim, dark, throat[3], dark, w];
  // Anchor the sprite on its beak base so hovering at a flower lines up.
  f.sprite(wing % 2 === 0 ? HUMMER_UP : HUMMER_DOWN, dir > 0 ? x - 7 : x - 2, y - 3, colors, dir < 0);
}

/* ------------------------------------------------------------------ bee */

export function drawBee(f: Frame, x: number, y: number, wing: number, pollen: boolean, gold: number, dark: number, wingC: number, pollenC: number) {
  // Striped body, three pixels long; wings flicker above.
  f.px(x - 1, y, gold);
  f.px(x, y, dark);
  f.px(x + 1, y, gold);
  f.px(x + 2, y, dark);
  f.px(x, y + 1, gold);
  f.px(x + 1, y + 1, dark);
  if (wing % 2) {
    f.px(x, y - 1, wingC);
    f.px(x + 1, y - 1, wingC);
  } else {
    f.px(x - 1, y - 1, wingC);
    f.px(x + 1, y - 2, wingC);
  }
  if (pollen) {
    f.px(x, y + 2, pollenC);
    f.px(x + 1, y + 2, pollenC);
  }
}

/* --------------------------------------------------------------- spider */

export function drawSpider(f: Frame, sky: Sky, x: number, y: number, phase: number) {
  const c = SPIDER.tones(sky);
  f.ellipse(x, y + 1, 1.6, 2, () => c[2]);
  f.px(x, y - 1, c[1]);
  f.px(x, y + 2, c[3]);
  const k = Math.round(Math.sin(phase) * 0.6);
  for (const s of [-1, 1]) {
    f.line(x + s, y, x + s * 3, y - 2 + k, c[1]);
    f.line(x + s, y + 1, x + s * 3, y + k, c[1]);
    f.line(x + s, y + 1, x + s * 3, y + 2 - k, c[1]);
    f.line(x + s, y + 2, x + s * 3, y + 4, c[1]);
  }
}
