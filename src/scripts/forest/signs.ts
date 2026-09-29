/**
 * Park signage for the words: a carved entrance sign at dawn and dusk, and a
 * trailhead kiosk at every clearing. The engine draws them on the world's own
 * pixel grid, lit by that clearing's hour, directly behind the page's words
 * (which stay real text on top). Each board is sized from the words it holds.
 *
 * Kiosks carry a side wing of pinned things, facing the scene: a trail map of
 * the clearing with a "you are here" dot, a pamphlet box, and an enamel
 * pictogram of the clearing's resident. Pictograms only; no painted words.
 */
import { Material, hash, hex, mix, pack, type RGB, type Sky } from './color';
import type { Frame } from './raster';
import { sprite, type Sprite } from './raster';
import type { SceneKind } from '../../data/products';

const WOOD = new Material(hex('#7a5234'));
const CEDAR = new Material(hex('#5a3f33'));
const PAINT: RGB = hex('#2c1d15');
const CREAM: RGB = hex('#efe2c0');
const PARCHMENT: RGB = hex('#e6d6ac');
const INK_BROWN: RGB = hex('#8a6a44');
const ENAMEL: RGB = hex('#4a2e1e');

export interface BoardSpec {
  /** The words' box in world pixels. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Which side of the frame the words sit on; the wing faces away from it. */
  side: 'left' | 'right' | 'bottom';
  kind: SceneKind;
  /** The sign's sun side (for rim light on its frame). */
  sunSide: number;
  seed: number;
}

/** Board metrics for a frame size. */
function metrics(W: number, H: number) {
  return {
    padX: Math.max(4, Math.round(W * 0.014)),
    padY: Math.max(3, Math.round(H * 0.024)),
    frame: 2,
    wing: 21,
    band: 15,
    roof: Math.max(5, Math.round(H * 0.032)),
    post: Math.max(2, Math.round(W * 0.009)),
  };
}

/** Pixel-perfect rectangle fill clipped to the frame. */
function fill(f: Frame, x0: number, y0: number, x1: number, y1: number, c: number) {
  f.rect(x0, y0, x1 - x0, y1 - y0, c);
}

function lit(tones: number[], sky: Sky, t: number) {
  return tones[Math.max(0, Math.min(4, t))];
}

/** A face of dark paint on planks, barely tinted by the hour so the words always read. */
function paintFace(f: Frame, sky: Sky, x0: number, y0: number, x1: number, y1: number, seed: number) {
  const face = mix(mix(PAINT, sky.shade, 0.12), sky.light, 0.04);
  const seam = pack(mix(face, [6, 4, 3], 0.45));
  const grain = pack(mix(face, sky.light, 0.05));
  const c = pack(face);
  fill(f, x0, y0, x1, y1, c);
  for (let y = y0 + 6; y < y1 - 1; y += 7) f.hline(x0, x1 - 1, y, seam);
  for (let i = 0; i < ((x1 - x0) * (y1 - y0)) / 40; i++) {
    const x = x0 + Math.floor(hash(i, 1, seed) * (x1 - x0));
    const y = y0 + Math.floor(hash(i, 2, seed) * (y1 - y0));
    const len = 2 + Math.floor(hash(i, 3, seed) * 5);
    for (let k = 0; k < len && x + k < x1; k++) f.px(x + k, y, grain);
  }
}

/** A wooden frame around a face: lit on top, shaded below, rim on the sun side at low sun. */
function frameAround(f: Frame, sky: Sky, x0: number, y0: number, x1: number, y1: number, w: number, sunSide: number) {
  const t = WOOD.tones(sky);
  for (let k = 0; k < w; k++) {
    f.hline(x0 - w + k, x1 - 1 + w - k, y0 - w + k, lit(t, sky, k === 0 ? 3 : 2));
    f.hline(x0 - w + k, x1 - 1 + w - k, y1 + w - 1 - k, lit(t, sky, k === 0 ? 0 : 1));
    f.vline(x0 - w + k, y0 - w + k, y1 + w - 1 - k, lit(t, sky, sunSide < 0 && k === 0 ? 3 : 2));
    f.vline(x1 - 1 + w - k, y0 - w + k, y1 + w - 1 - k, lit(t, sky, sunSide > 0 && k === 0 ? 3 : 1));
  }
  if (sky.backlit > 0.35) {
    const edge = sunSide > 0 ? x1 - 1 + w : x0 - w;
    f.vline(edge, y0 - w, y1 + w - 1, t[4]);
    f.hline(x0 - w, x1 - 1 + w, y0 - w, t[4]);
  }
}

/** Two posts from under the board down past the bottom of the frame. */
function posts(f: Frame, sky: Sky, xa: number, xb: number, top: number, pw: number, sunSide: number) {
  const t = WOOD.tones(sky);
  for (const x of [xa, xb - pw]) {
    for (let y = top; y < f.h; y++) {
      for (let i = 0; i < pw; i++) {
        const u = pw === 1 ? 0.5 : i / (pw - 1);
        const light = sunSide > 0 ? u : 1 - u;
        f.px(x + i, y, lit(t, sky, light > 0.7 ? 3 : light > 0.3 ? 2 : 1));
      }
    }
  }
}

/** A shingled gable over a kiosk, overhanging both sides. */
function roof(f: Frame, sky: Sky, x0: number, x1: number, eave: number, h: number, seed: number) {
  const t = CEDAR.tones(sky);
  const over = 3;
  for (let r = 0; r < h; r++) {
    const y = eave - h + r;
    const inset = Math.round((h - 1 - r) * 1.4);
    const a = x0 - over + inset;
    const b = x1 + over - inset;
    for (let x = a; x < b; x++) {
      const course = Math.floor((x + (r % 2) * 2) / 4);
      let tone = r === 0 ? 3 : hash(course, r, seed) < 0.35 ? 1 : 2;
      if ((x + (r % 2) * 2) % 4 === 0 && r > 0) tone = 0;
      f.px(x, y, lit(t, sky, tone));
    }
  }
  // Drip edge and ridge cap.
  f.hline(x0 - over, x1 + over - 1, eave, lit(t, sky, 0));
  const ridgeInset = Math.round((h - 1) * 1.4);
  f.hline(x0 - over + ridgeInset - 1, x1 + over - ridgeInset, eave - h - 1, lit(WOOD.tones(sky), sky, 3));
}

/* ------------------------------------------------------------- pictograms */

const PICTO_KEY = { X: 1, G: 2 };
const PICTOS: Partial<Record<SceneKind, Sprite>> = {
  beavers: sprite(['.........', '.........', '....XXX..', '...XXXXXX', 'XX.XXXXX.', 'XXXXXXXX.', 'XX..X.X..', '.........', '.........'], PICTO_KEY),
  squirrels: sprite(['.XXX.....', 'XX.XX....', 'X...X.XX.', 'X...XXXX.', 'XX..XXX..', '.XX.XXX..', '..XXXXX..', '....X.X..', '.........'], PICTO_KEY),
  bear: sprite(['.........', '....XX...', '..XXXXX.X', '.XXXXXXXX', 'XXXXXXXXX', 'XXXXXXX..', '.X.X.X.X.', '.X.X.X.X.', '.........'], PICTO_KEY),
  hummingbird: sprite(['.X.......', '.XX......', '..XX.....', '..XXX....', 'XXXXXXXXX', 'X..XX....', '...X.....', '.........', '.........'], PICTO_KEY),
  web: sprite(['X.......X', '.X.XXX.X.', '..XXXXX..', 'XXXXXXXXX', '..XXXXX..', '.X.XXX.X.', 'X...X...X', '.........', '.........'], PICTO_KEY),
  bees: sprite(['..XX.XX..', '.X..X..X.', '..XXXXX..', '.X.X.X.XX', 'XX.X.X.X.', '.X.X.X.XX', '..XXXXX..', '.........', '.........'], PICTO_KEY),
  fireflies: sprite(['...X.X...', '....X....', '...XXX...', '..XXXXX..', '..XXXXX..', '...GGG...', '...GGG...', '....G....', '.........'], PICTO_KEY),
};

/** An enamel park pictogram: a brown square, cream border, the resident in cream. */
function pictogram(f: Frame, sky: Sky, x: number, y: number, kind: SceneKind) {
  const spr = PICTOS[kind];
  if (!spr) return;
  const body = pack(mix(ENAMEL, sky.light, 0.06));
  const cream = pack(mix(CREAM, sky.light, 0.1));
  fill(f, x, y, x + 13, y + 13, cream);
  fill(f, x + 1, y + 1, x + 12, y + 12, body);
  f.sprite(spr, x + 2, y + 2, [cream, pack([255, 214, 90])]);
}

/* ------------------------------------------------------------------- maps */

/** A parchment trail map of the clearing: contours, a dotted trail, its landmark, and "you are here". */
function trailMap(f: Frame, sky: Sky, x: number, y: number, kind: SceneKind, seed: number) {
  const w = 17;
  const h = 13;
  const paper = mix(PARCHMENT, sky.light, 0.08);
  const edge = pack(mix(paper, INK_BROWN, 0.55));
  const line = pack(mix(paper, INK_BROWN, 0.3));
  fill(f, x, y, x + w, y + h, pack(paper));
  // Contour lines.
  for (let k = 0; k < 2; k++) {
    for (let i = 1; i < w - 1; i++) {
      const cy = y + 3 + k * 5 + Math.round(Math.sin((i + seed * (k + 1)) * 0.6) * 1.2);
      if ((i + k) % 3 !== 0) f.px(x + i, cy, line);
    }
  }
  // Water for the pond and river clearings.
  const water = pack(mix(hex('#5c8fb8'), paper, 0.25));
  if (kind === 'beavers') fill(f, x + 7, y + 5, x + 15, y + 11, water);
  if (kind === 'bear') fill(f, x + 1, y + 9, x + 16, y + 12, water);
  // Landmark, top right.
  const lx = x + 11;
  const ly = y + 3;
  const green = pack(hex('#4f7a3a'));
  const brown = pack(hex('#6a4a2e'));
  const grey = pack(hex('#8a8a8c'));
  const pink = pack(hex('#c04a8e'));
  const white = pack(hex('#fbf7ea'));
  const dark = pack(hex('#2a3a2a'));
  switch (kind) {
    case 'beavers':
      fill(f, lx - 1, ly + 3, lx + 4, ly + 5, brown);
      fill(f, lx, ly + 2, lx + 3, ly + 3, brown);
      break;
    case 'squirrels':
      fill(f, lx - 1, ly - 1, lx + 4, ly + 3, green);
      f.vline(lx + 1, ly + 3, ly + 5, brown);
      break;
    case 'bear':
      fill(f, lx - 1, ly - 1, lx + 4, ly + 5, grey);
      f.vline(lx + 1, ly - 1, ly + 5, white);
      break;
    case 'hummingbird':
      for (let i = 0; i < 4; i++) {
        f.vline(lx + i, ly + 1, ly + 5, green);
        f.px(lx + i, ly + (i % 2), pink);
      }
      break;
    case 'web':
      f.line(lx - 1, ly - 1, lx + 3, ly + 3, dark);
      f.line(lx + 3, ly - 1, lx - 1, ly + 3, dark);
      f.hline(lx - 1, lx + 3, ly + 1, dark);
      break;
    case 'bees':
      fill(f, lx - 1, ly - 1, lx + 4, ly + 3, green);
      f.px(lx, ly, white);
      f.px(lx + 2, ly + 1, white);
      f.vline(lx + 1, ly + 3, ly + 5, brown);
      break;
    case 'fireflies':
      for (let i = 0; i < 3; i++) {
        f.vline(lx - 1 + i * 2, ly + 1, ly + 5, dark);
        f.px(lx - 1 + i * 2, ly, dark);
      }
      f.px(lx + 1, ly + 3, pack([240, 214, 80]));
      break;
  }
  // A dotted trail from "you are here" (bottom left) to the landmark.
  const trail = pack(hex('#9a4a2a'));
  const tx0 = x + 3;
  const ty0 = y + h - 3;
  for (let i = 0; i <= 8; i += 2) {
    const px = Math.round(tx0 + ((lx - tx0) * i) / 8);
    const py = Math.round(ty0 + ((ly + 2 - ty0) * i) / 8 + Math.sin(i) * 0.8);
    f.px(px, py, trail);
  }
  fill(f, tx0 - 1, ty0, tx0 + 1, ty0 + 2, pack([214, 52, 42]));
  // Border and tack.
  f.hline(x, x + w - 1, y, edge);
  f.hline(x, x + w - 1, y + h - 1, edge);
  f.vline(x, y, y + h - 1, edge);
  f.vline(x + w - 1, y, y + h - 1, edge);
  f.px(x + Math.floor(w / 2), y + 1, pack([200, 60, 50]));
}

/** A little wooden pamphlet box with brochures poking out. */
function pamphlets(f: Frame, sky: Sky, x: number, y: number) {
  const t = WOOD.tones(sky);
  const colors: RGB[] = [hex('#3f8f86'), hex('#e0913a'), hex('#efe2c0')];
  colors.forEach((c, i) => fill(f, x + 1 + i * 2, y - 2 + (i % 2), x + 3 + i * 2, y + 1, pack(mix(c, sky.light, 0.1))));
  fill(f, x, y, x + 8, y + 6, lit(t, sky, 2));
  f.hline(x, x + 7, y, lit(t, sky, 3));
  f.hline(x, x + 7, y + 5, lit(t, sky, 1));
  f.hline(x + 2, x + 5, y + 2, lit(t, sky, 0));
}

/* ------------------------------------------------------------------ boards */

/** How far a board extends beyond the words, for visibility tests. */
export function boardReach(W: number, H: number) {
  const m = metrics(W, H);
  return m.roof + m.band + m.padY + m.frame + 4;
}

/** The carved entrance sign for the dawn and dusk meadows. */
export function entranceSign(f: Frame, sky: Sky, b: BoardSpec) {
  const m = metrics(f.w, f.h);
  const x0 = Math.floor(b.x0) - m.padX - 1;
  const x1 = Math.ceil(b.x1) + m.padX + 1;
  const y0 = Math.floor(b.y0) - m.padY - 1;
  const y1 = Math.ceil(b.y1) + m.padY + 1;
  const w = m.frame + 1;
  posts(f, sky, x0 + m.padX, x1 - m.padX, y1 + w, m.post + 1, b.sunSide);
  paintFace(f, sky, x0, y0, x1, y1, b.seed);
  // The routed border groove, picked out in cream like the letters would be.
  const groove = pack(mix(mix(PAINT, CREAM, 0.42), sky.light, 0.05));
  f.hline(x0 + 2, x1 - 3, y0 + 2, groove);
  f.hline(x0 + 2, x1 - 3, y1 - 3, groove);
  f.vline(x0 + 2, y0 + 2, y1 - 3, groove);
  f.vline(x1 - 3, y0 + 2, y1 - 3, groove);
  frameAround(f, sky, x0, y0, x1, y1, w, b.sunSide);
  // A cap board along the top.
  const t = WOOD.tones(sky);
  f.hline(x0 - w - 1, x1 + w, y0 - w - 1, lit(t, sky, 3));
  f.hline(x0 - w - 1, x1 + w, y0 - w, lit(t, sky, 2));
}

/** A trailhead kiosk: roof, painted panel, posts, and a wing of pinned things facing the scene. */
export function kiosk(f: Frame, sky: Sky, b: BoardSpec) {
  const m = metrics(f.w, f.h);
  const stacked = b.side === 'bottom';
  const wingRight = b.side !== 'right';
  let x0 = Math.floor(b.x0) - m.padX;
  let x1 = Math.ceil(b.x1) + m.padX;
  let y0 = Math.floor(b.y0) - m.padY;
  const y1 = Math.ceil(b.y1) + m.padY;
  // The pinned things live in a wing beside the words, or a band above them on phones.
  if (stacked) y0 -= m.band;
  else if (wingRight) x1 += m.wing;
  else x0 -= m.wing;
  posts(f, sky, x0 + 2, x1 - 2, y1 + m.frame, m.post, b.sunSide);
  paintFace(f, sky, x0, y0, x1, y1, b.seed);
  frameAround(f, sky, x0, y0, x1, y1, m.frame, b.sunSide);
  roof(f, sky, x0 - m.frame, x1 + m.frame, y0 - m.frame, m.roof, b.seed);

  // A thin divider between the words and the wing, like a batten between panels.
  const t = WOOD.tones(sky);
  if (stacked) {
    f.hline(x0, x1 - 1, y0 + m.band - 1, lit(t, sky, 1));
    const top = y0 + 1;
    trailMap(f, sky, x1 - 48, top, b.kind, b.seed);
    pamphlets(f, sky, x1 - 28, top + 6);
    pictogram(f, sky, x1 - 17, top, b.kind);
  } else {
    const wx = wingRight ? x1 - m.wing : x0;
    f.vline(wingRight ? wx : wx + m.wing - 1, y0, y1 - 1, lit(t, sky, 1));
    const cx = wx + (wingRight ? 3 : 1);
    trailMap(f, sky, cx, y0 + 3, b.kind, b.seed);
    pictogram(f, sky, cx + 2, y0 + 19, b.kind);
    if (y1 - y0 > 44) pamphlets(f, sky, cx + 4, y0 + 37);
  }
}

