/**
 * The forest's clearings. One ForestScene paints one vignette: a sky for its
 * hour, hazed ridges and treelines, a setpiece (pond, oak, falls, meadow,
 * web, hive, wood), its creatures, and a meadow edge that the wind combs.
 *
 * Layout is never hard-coded to a screen shape. Each scene is told where the
 * page's words sit (left, right or below) and stages its creatures in the
 * free space that remains, so the same clearing composes itself on a phone,
 * a laptop or a 32:9 monitor.
 */
import {
  Material, bayer, hash, hex, mix, noise1, noise2, pack, rng, sunElevation, unpack,
  type RGB, type Sky,
} from './color';
import {
  drawAcorn, drawBear, drawBeaver, drawBee, drawDeer, drawHummingbird, drawSalmon, drawSpider, drawSquirrel,
  HOOF, type DeerPose,
} from './creatures';
import { Frame } from './raster';
import { foliage, hazeTones, rock, trunk } from './nature';
import type { Scene } from '../../data/products';

export interface Layout {
  W: number;
  H: number;
  /** The stage's ground line, in world pixels. */
  groundY: number;
  /** Centre of the space the page's words leave free. */
  stageX: number;
  stageW: number;
  /** Where the words sit, so the scene stages away from them. */
  textSide: 'left' | 'right' | 'bottom';
}

export interface Input {
  t: number;
  dt: number;
  /** Pointer in world pixels; `pointer` is false when it has gone quiet. */
  px: number;
  py: number;
  pointer: boolean;
  reduced: boolean;
}

const LEAF = new Material(hex('#3d6a33'));
const LEAF_DEEP = new Material(hex('#27462a'));
const BARK = new Material(hex('#4b3a2c'));
const BIRCH = new Material(hex('#cfc6b4'));
const ROCK = new Material(hex('#7c7a7c'));
const MOSS = new Material(hex('#5a7a36'));
const STICKS = new Material(hex('#6a4a2e'));
const SOIL = new Material(hex('#4a3a2a'));
const FALLEN = new Material(hex('#b86a2c'));
const FOXGLOVE = new Material(hex('#c04a8e'));
const FIREWEED = new Material(hex('#9a4ac0'));
const CLOVER = new Material(hex('#d2709a'));
const DAISY = new Material(hex('#f2eee2'));
const BUTTERCUP = new Material(hex('#f2c22e'));
const CORNFLOWER = new Material(hex('#4a78d8'));
const FERN = new Material(hex('#4a7a3a'));

/** Where each clearing's sun sits across the stage, so no two stops repeat one sky. */
const SUN_OFFSET: Record<string, number> = { beavers: 0.2, squirrels: -0.32, bear: 0.36, hummingbird: 0.02, web: -0.1, bees: 0.3 };

/** One shared wind: a slow sway plus gusts that roll across the whole world. */
export function wind(x: number, t: number, W: number): number {
  const sway = Math.sin(t * 0.9 - x * 0.045) * 0.35;
  const period = 9;
  const gx = ((t % period) / period) * (W * 1.6) - W * 0.3;
  const g = Math.exp(-(((x - gx) / (W * 0.12 + 20)) ** 2));
  return sway + g * 0.95;
}

/** Fast blend of a packed pixel toward an RGB colour. */
function blend(p: number, c: RGB, k: number): number {
  const r = p & 255;
  const g = (p >> 8) & 255;
  const b = (p >> 16) & 255;
  return (
    (0xff000000 |
      (Math.round(b + (c[2] - b) * k) << 16) |
      (Math.round(g + (c[1] - g) * k) << 8) |
      Math.round(r + (c[0] - r) * k)) >>>
    0
  );
}

interface Ridge {
  base: number;
  amp: number;
  freq: number;
  haze: number;
  kind: 'far' | 'mid' | 'near';
  pines: { x: number; h: number }[];
}

interface Blade {
  x: number;
  h: number;
  tone: number;
  flower?: number;
}

export class ForestScene {
  readonly W: number;
  readonly H: number;
  readonly hS: number;
  readonly gy: Int16Array;
  readonly sunX: number;
  /** Direction from the stage toward the sun, for rim light. */
  readonly sunSide: number;
  private ridges: Ridge[] = [];
  private blades: Blade[] = [];
  private seed: number;
  private state: Record<string, any> = {};
  /** Resolves the random-jump run once the deer has left the frame. */
  private runDone: (() => void) | null = null;
  /** Off-screen layer for drawing a figure before tracing its rim light. */
  private scratch: Frame;

  constructor(
    public spec: Scene,
    public L: Layout,
  ) {
    const { W, H, groundY, stageX, textSide } = L;
    this.W = W;
    this.H = H;
    this.hS = groundY;
    this.seed = spec.seed;
    this.scratch = new Frame(W, H);
    const r = rng(spec.seed * 7919 + 1);

    // The sun rides on the stage side, so its light falls across the creatures.
    const away = textSide === 'left' ? 1 : textSide === 'right' ? -1 : 1;
    this.sunX =
      spec.kind === 'meadow'
        ? // Dawn and dusk: the sun sits right behind the stag, so he stands in silhouette.
          Math.round(stageX - away * 5)
        : textSide === 'bottom'
          ? Math.round(W * (0.62 + r() * 0.2))
          : Math.round(stageX + away * L.stageW * (SUN_OFFSET[spec.kind] ?? 0.16));
    this.sunSide = Math.sign(this.sunX - stageX) || 1;

    // Ground line: gentle undulation, plus a knoll for the deer.
    this.gy = new Int16Array(W);
    for (let x = 0; x < W; x++) {
      let y = groundY + Math.round((noise1(x * 0.05, spec.seed) - 0.5) * 2);
      // The stag's knoll: a lit rise in a clearing, so he stands clear of the treeline.
      if (spec.kind === 'meadow') y -= Math.round(10 * Math.exp(-(((x - stageX) / (L.stageW * 0.2 + 12)) ** 2)));
      this.gy[x] = y;
    }

    // Three ridges: far mountains, a hazed middle treeline, the forest edge.
    const hs = this.hS;
    const ridgeSet: [number, number, number, number, Ridge['kind'], number][] = [
      [0.34, 0.2, 0.011, 0.55, 'far', 0],
      [0.22, 0.12, 0.022, 0.3, 'mid', 0.35],
      [0.09, 0.06, 0.04, 0.08, 'near', 1],
    ];
    for (const [base, amp, freq, haze, kind, pineDensity] of ridgeSet) {
      const pines: Ridge['pines'] = [];
      // Open meadows (hummingbird, bees) have no dark forest edge, so flowers stand against the haze.
      const open = spec.kind === 'hummingbird' || spec.kind === 'bees';
      if (open && kind === 'near') continue;
      if (pineDensity > 0 && spec.kind !== 'fireflies') {
        for (let x = -6; x < W + 6; ) {
          if (spec.kind === 'meadow' && kind === 'near' && Math.abs(x - stageX) < L.stageW * 0.24 + 12) {
            x += 3;
            continue;
          }
          const tall = kind === 'near' ? hs * (0.05 + r() * 0.1) : hs * (0.025 + r() * 0.05);
          pines.push({ x, h: Math.max(4, Math.round(tall)) });
          x += Math.round((kind === 'near' ? 2 : 4) + r() * (kind === 'near' ? 5 : 9) / pineDensity);
        }
      }
      this.ridges.push({ base: groundY - hs * base, amp: hs * amp, freq, haze, kind, pines });
    }

    // Grass blades along the meadow edge; a few carry wildflowers.
    const flowery = spec.kind === 'meadow' || spec.kind === 'bees' || spec.kind === 'hummingbird';
    for (let x = 0; x < W; x += 1 + (r() < 0.35 ? 1 : 0)) {
      const tall = spec.kind === 'meadow' ? 3 + r() * 5 : 2 + r() * 4;
      this.blades.push({
        x,
        h: Math.round(tall),
        tone: r() < 0.3 ? 3 : r() < 0.6 ? 2 : 1,
        flower: flowery && r() < 0.06 ? Math.floor(r() * 4) : undefined,
      });
    }

    this.setup(r);
  }

  /* ------------------------------------------------------------ setup */

  private setup(r: () => number) {
    const { L, W } = this;
    const s = this.state;
    const toText = L.textSide === 'left' ? -1 : 1;
    switch (this.spec.kind) {
      case 'meadow': {
        s.deer = {
          x: L.stageX,
          dir: toText,
          // The first thing a visitor sees: the stag grazing at sunrise. He looks up
          // when the pointer comes near, or now and then on his own.
          mode: 'graze',
          timer: 3 + r() * 2.5,
          head: 0,
          ears: 0,
          tail: 0,
          chew: 0,
          gait: NaN,
          speed: 0,
        };
        s.pondTop = this.hS + 3;
        const below = this.H - this.hS;
        s.pondBot = L.textSide === 'bottom' ? this.hS + Math.round(Math.min(18, Math.max(7, below * 0.2))) : this.H;
        s.reeds = Array.from({ length: Math.round(W / 9) }, () => ({ x: Math.round(r() * W), h: 3 + Math.round(r() * 7) })).filter(
          (rd) => Math.abs(rd.x - L.stageX) > L.stageW * 0.12,
        );
        break;
      }
      case 'beavers': {
        s.waterTop = this.hS - Math.round(this.hS * 0.05);
        const below = this.H - this.hS;
        s.waterBot = this.hS + Math.round(L.textSide === 'bottom' ? Math.min(22, Math.max(9, below * 0.26)) : below * 0.62);
        s.lodgeX = L.stageX + toText * -L.stageW * 0.08;
        s.lodgeY = this.hS + 1;
        s.lodgeR = Math.max(18, Math.min(40, Math.round(L.stageW * 0.22)));
        s.swimY = s.lodgeY + Math.max(3, Math.round((s.waterBot - s.lodgeY) * 0.3));
        s.swimmer = { x: L.stageX - toText * L.stageW * 0.55, dir: toText, t: 0, under: 0 };
        s.builder = { t: r() * 4 };
        s.stumps = [0.2, 0.75].map((k) => ({ x: Math.round(W * k + (r() - 0.5) * 20), h: 3 + Math.round(r() * 3) }));
        s.sticks = Array.from({ length: 140 }, () => [r(), r(), r(), r()]);
        break;
      }
      case 'squirrels': {
        s.tw = Math.round(Math.max(7, Math.min(15, this.hS * 0.075)));
        s.trunkX = L.stageX;
        s.canopyY = Math.round(this.hS - this.hS * 0.6);
        s.hollowY = Math.round(this.hS - this.hS * 0.32);
        s.blobs = Array.from({ length: 14 }, () => ({
          dx: (r() - 0.5) * this.hS * 0.62,
          dy: (r() - 0.65) * this.hS * 0.26,
          rx: this.hS * (0.07 + r() * 0.08),
          ry: this.hS * (0.05 + r() * 0.06),
        }));
        s.climber = { phase: 'down', t: 0, y: s.hollowY, x: 0, acorn: false };
        s.sitter = { dir: toText, t: 0 };
        s.falling = [] as { x: number; y: number; vy: number; bounced: boolean }[];
        s.pile = Array.from({ length: 5 }, (_, i) => ({ x: i * 2 - 4 + Math.round(r() * 2), y: i % 2 }));
        s.leaves = Array.from({ length: Math.round(W * 0.5) }, () => [r() * W, r(), r()]);
        s.dropTimer = 2 + r() * 3;
        break;
      }
      case 'bear': {
        s.fw = Math.max(8, Math.min(18, Math.round(W * 0.035)));
        s.fx = Math.round(L.stageX + (L.textSide === 'bottom' ? 0.1 : -toText * 0.12) * L.stageW);
        s.cliffTop = Math.round(this.hS - this.hS * 0.34);
        s.riverTop = this.hS - Math.round(this.hS * 0.03);
        const below = this.H - this.hS;
        s.riverBot = this.hS + Math.round(L.textSide === 'bottom' ? Math.min(20, Math.max(9, below * 0.24)) : below * 0.58);
        s.bear = { x: s.fx + toText * (s.fw + 12), dir: -toText, lunge: 0, fish: 0 };
        s.salmon = null as null | { t: number; x0: number; x1: number; catch: boolean };
        s.leapTimer = 1.2;
        s.leaps = 0;
        s.blocks = Array.from({ length: 16 }, () => [r(), r(), r()]);
        s.boulders = Array.from({ length: 4 }, () => ({ x: Math.round(r() * W), r: 2 + Math.round(r() * 3) })).filter(
          (b) => Math.abs(b.x - s.fx) > s.fw * 2,
        );
        break;
      }
      case 'hummingbird': {
        const n = Math.max(8, Math.min(18, Math.round(L.stageW / 8)));
        s.spikes = Array.from({ length: n }, (_, i) => {
          const x = Math.round(L.stageX + (i / (n - 1) - 0.5) * L.stageW * 0.5 + (r() - 0.5) * 6);
          return { x, h: Math.round(this.hS * (0.2 + r() * 0.2)), kind: r() < 0.55 ? 0 : 1, lean: (r() - 0.5) * 0.3 };
        });
        s.bird = { x: L.stageX, y: this.hS - this.hS * 0.2, dir: toText, target: 0, hover: 1.5, dart: 0, fx: 0, fy: 0, tx: 0, ty: 0 };
        break;
      }
      case 'web': {
        s.cx = Math.round(L.stageX);
        s.cy = Math.round(this.hS - this.hS * 0.4);
        s.R = Math.max(14, Math.min(Math.round(this.hS * 0.28), Math.round(L.stageW * 0.3)));
        const spokes = 15;
        s.spokes = Array.from({ length: spokes }, (_, i) => {
          const a = (i / spokes) * Math.PI * 2 + (r() - 0.5) * 0.16;
          return { a, len: 0.86 + r() * 0.16 };
        });
        s.rings = 11;
        s.dew = Array.from({ length: 22 }, () => ({ spoke: Math.floor(r() * spokes), ring: 2 + Math.floor(r() * 9), phase: r() * 10 }));
        s.drops = Array.from({ length: 3 }, (_, i) => ({ spoke: Math.floor(r() * spokes), d: 0.2 + i * 0.25, fall: -1, x: 0, y: 0, vy: 0 }));
        s.gnats = Array.from({ length: 9 }, () => this.newGnat(r));
        s.spider = { x: s.cx, y: s.cy, target: null as null | { x: number; y: number }, t: 0 };
        s.rand = r;
        break;
      }
      case 'bees': {
        s.hiveX = Math.round(L.stageX + (L.textSide === 'bottom' ? 0 : -toText * L.stageW * 0.1));
        s.hiveW = Math.max(6, Math.min(12, Math.round(this.hS * 0.06)));
        s.hiveH = Math.round(this.hS * 0.2);
        s.flowers = Array.from({ length: Math.round(L.stageW * 0.7) + 14 }, () => {
          const x = Math.round(L.stageX + (r() - 0.5) * L.stageW * 1.1);
          return { x, h: 3 + Math.round(r() * r() * 13), kind: Math.floor(r() * 4) };
        });
        s.bees = Array.from({ length: 12 }, (_, i) => ({
          x: s.hiveX,
          y: this.hS - s.hiveH * 0.7,
          target: Math.floor(r() * s.flowers.length),
          visits: 0,
          pollen: false,
          wait: i * 0.35,
          home: false,
          seed: r() * 10,
        }));
        break;
      }
      case 'fireflies': {
        s.trunks = Array.from({ length: Math.round(W / 22) + 4 }, () => ({
          x: Math.round(r() * W),
          w: 3 + Math.round(r() * 7),
          depth: r(),
        })).sort((a, b) => b.depth - a.depth);
        s.flies = Array.from({ length: Math.round(Math.min(60, 16 + L.stageW * 0.25)) }, () => ({
          x: L.stageX + (r() - 0.5) * L.stageW * 1.1,
          y: this.hS - r() * this.hS * 0.45,
          period: 2 + r() * 3.5,
          phase: r() * 6,
          seed: r() * 100,
          hue: r(),
        }));
        s.ferns = Array.from({ length: Math.round(W / 12) }, () => ({ x: Math.round(r() * W), h: 4 + Math.round(r() * 6), s: r() < 0.5 ? -1 : 1 }));
        break;
      }
    }
  }

  private newGnat(r: () => number) {
    const fromLeft = r() < 0.5;
    return {
      x: fromLeft ? this.L.stageX - this.L.stageW * 0.7 : this.L.stageX + this.L.stageW * 0.7,
      y: this.hS - this.hS * (0.2 + r() * 0.45),
      vx: (fromLeft ? 1 : -1) * (8 + r() * 10),
      seed: r() * 100,
      stuck: false,
      tried: false,
      life: 0,
    };
  }

  /* -------------------------------------------------- static painting */

  /**
   * Everything that only changes with the hour: sky, sun, ridges, the
   * setpiece's fixed parts and the ground. Cached by the engine.
   */
  paintStatic(f: Frame, sky: Sky, hour: number) {
    this.paintSky(f, sky, hour);
    this.paintRidges(f, sky);
    this.paintGround(f, sky);
    if (this.spec.kind === 'squirrels' || this.spec.kind === 'web' || this.spec.kind === 'bear') this.shafts(f, sky, 3, 0.35);
    switch (this.spec.kind) {
      case 'squirrels':
        this.paintOak(f, sky);
        break;
      case 'hummingbird':
        this.paintThicket(f, sky);
        break;
      case 'bear':
        this.paintCliff(f, sky);
        break;
      case 'bees':
        this.paintHive(f, sky);
        break;
      case 'fireflies':
        this.paintWood(f, sky);
        break;
    }
  }

  private sunY(hour: number): number {
    const horizon = this.hS - this.hS * 0.2;
    const y = Math.round(horizon - sunElevation(hour) * horizon * 0.82);
    // In the meadow the low sun clears the far ridge just enough to back-light the stag.
    return this.spec.kind === 'meadow' ? Math.min(y, Math.round(this.hS - this.hS * 0.4)) : y;
  }

  private paintSky(f: Frame, sky: Sky, hour: number) {
    const { W, H } = this;
    const bottom = this.hS;
    const sx = this.sunX;
    const sy = this.sunY(hour);
    const elev = sunElevation(hour);
    const sr = Math.max(4, Math.round(this.hS * (0.075 - elev * 0.04)));
    const stops: RGB[] = [sky.top, sky.upper, sky.lower, sky.horizon];
    const bands = 10;
    const bandColors: number[] = [];
    for (let b = 0; b <= bands; b++) {
      const t = (b / bands) * 3;
      const i = Math.min(2, Math.floor(t));
      bandColors.push(pack(mix(stops[i], stops[i + 1], t - i)));
    }
    const glow = sky.glow;
    const rings = [0.62, 0.4, 0.24, 0.12, 0.05];
    const ringR = [1.45, 2.1, 3, 4.3, 6].map((k) => k * sr * (1 + (1 - elev) * 0.6));
    for (let y = 0; y < H; y++) {
      const t = Math.min(1, y / bottom) ** 1.25 * bands;
      let band = Math.floor(t);
      const frac = t - band;
      for (let x = 0; x < W; x++) {
        let b = band;
        if (frac > 0.72 && bayer(x, y) / 16 < (frac - 0.72) / 0.28) b = Math.min(bands, band + 1);
        let c = bandColors[b];
        const dx = x - sx;
        const dy = (y - sy) * 1.15;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < sr) {
          c = pack(d < sr - 1.5 ? sky.sun : mix(sky.sun, glow, 0.35));
        } else {
          for (let k = 0; k < ringR.length; k++) {
            if (d < ringR[k]) {
              c = blend(c, glow, rings[k] * (0.55 + (1 - elev) * 0.45));
              break;
            }
          }
        }
        f.buf[y * W + x] = c;
      }
    }
    // Stars in the dim hours.
    if (sky.dim > 0.4) {
      const star = mix(sky.light, [255, 255, 255], 0.6);
      for (let i = 0; i < W * 0.6; i++) {
        const x = Math.floor(hash(i, 1, this.seed) * W);
        const y = Math.floor(hash(i, 2, this.seed) ** 1.6 * bottom * 0.55);
        if (hash(i, 3, this.seed) < (sky.dim - 0.4) * 1.4) f.px(x, y, blend(f.get(x, y), star, 0.5 + hash(i, 4) * 0.4));
      }
    }
  }

  private ridgeTop(rd: Ridge, x: number): number {
    const n = noise1(x * rd.freq, this.seed + rd.base) * 0.7 + noise1(x * rd.freq * 2.7, this.seed * 3 + rd.base) * 0.3;
    let top = rd.base - n * rd.amp;
    if (this.spec.kind === 'meadow' && rd.kind === 'near') {
      // A clearing in the forest edge behind the stag.
      const g = Math.exp(-(((x - this.L.stageX) / (this.L.stageW * 0.22 + 12)) ** 2));
      top += (this.hS + 2 - top) * g;
    }
    return Math.round(top);
  }

  private paintRidges(f: Frame, sky: Sky) {
    const { W } = this;
    const leaf = LEAF_DEEP.tones(sky);
    for (const rd of this.ridges) {
      let body: RGB;
      if (rd.kind === 'far') body = mix(sky.far, sky.haze, rd.haze);
      else if (rd.kind === 'mid') body = mix(sky.ridge, sky.haze, rd.haze);
      else body = mix(unpack(leaf[1]), sky.ink, 0.2);
      const c = pack(body);
      const rim = pack(mix(body, sky.glow, 0.3 + sky.backlit * 0.25));
      const floor = this.hS + 2;
      for (let x = 0; x < W; x++) {
        const top = this.ridgeTop(rd, x);
        f.rect(x, top, 1, floor - top, c);
        // Ridge crests facing the sun catch a line of light.
        if (Math.sign(this.sunX - x) !== Math.sign(this.ridgeTop(rd, x + 1) - top) && rd.kind !== 'near') f.px(x, top, rim);
      }
      for (const p of rd.pines) this.pine(f, p.x, this.ridgeTop(rd, p.x) + 2, p.h, c, rim);
    }
  }

  /** A stepped conifer silhouette with a sunward rim. */
  pine(f: Frame, x: number, base: number, h: number, c: number, rim: number) {
    for (let j = 0; j < h; j++) {
      const t = j / h;
      const tier = j % 3 === 0 ? 1 : 0;
      const hw = Math.max(0, Math.floor(t * h * 0.3) - tier);
      const y = base - h + j;
      f.rect(x - hw, y, hw * 2 + 1, 1, c);
      if (hw > 0) f.px(this.sunX > x ? x + hw : x - hw, y, rim);
    }
    f.px(x, base - h - 1, c);
  }

  private paintGround(f: Frame, sky: Sky) {
    const { W, H } = this;
    const grass = new Material(mix(sky.grass, [0, 0, 0], 0)).tones(sky);
    const soil = SOIL.tones(sky);
    const ink = sky.ink;
    const levels = [
      grass[3],
      grass[2],
      grass[1],
      pack(mix(unpack(soil[1]), unpack(grass[1]), 0.4)),
      soil[0],
      pack(mix(unpack(soil[0]), ink, 0.5)),
      pack(mix(unpack(soil[0]), ink, 0.78)),
    ];
    const depths = [1, 3, 6, 11, 18, 30];
    for (let x = 0; x < W; x++) {
      const g = this.gy[x];
      for (let y = g; y < H; y++) {
        const d = y - g;
        let l = 0;
        while (l < depths.length && d >= depths[l]) l++;
        // Dither the step between levels so the soil reads as painted, not banded.
        if (l < depths.length && depths[l] - d <= 1 && bayer(x, y) < 6) l++;
        f.buf[y * W + x] = levels[Math.min(l, levels.length - 1)];
      }
    }
    // Stones and roots under the turf.
    const rock = ROCK.tones(sky);
    for (let i = 0; i < W / 10; i++) {
      const x = Math.floor(hash(i, 7, this.seed) * W);
      const y = this.gy[x] + 3 + Math.floor(hash(i, 8, this.seed) * 8);
      const w = 1 + Math.floor(hash(i, 9, this.seed) * 3);
      f.rect(x, y, w, 1, rock[1]);
      f.rect(x, y - 1, w, 1, rock[2]);
    }
  }

  private paintOak(f: Frame, sky: Sky) {
    const s = this.state;
    const bark = BARK.tones(sky);
    const tw = s.tw as number;
    // Trunk, flaring into roots, grooved and round.
    trunk(f, s.trunkX - tw / 2, tw, s.canopyY - 8, this.hS + 1, bark, this.sunSide, this.seed, { rim: sky.backlit > 0.3, flare: 4 });
    // Hollow: the squirrels' store.
    f.ellipse(s.trunkX + this.sunSide, s.hollowY, 1.8, 2.6, () => bark[0]);
    f.px(s.trunkX + this.sunSide, s.hollowY + 3, bark[3]);
    // Limbs up into the crown.
    for (const a of [-0.9, -0.35, 0.3, 0.85]) {
      const len = this.hS * 0.2;
      for (let w = 0; w < 3; w++) f.line(s.trunkX + w - 1, s.canopyY, s.trunkX + Math.sin(a) * len + w - 1, s.canopyY - Math.cos(a) * len * 0.55, bark[w === 1 ? 2 : 1]);
    }
    // Crown: leafy clumps, lit on their sunward tops, flecked with the first gold of the fall.
    const leaf = LEAF.tones(sky);
    const autumn = FALLEN.tones(sky);
    const cy = s.canopyY - this.hS * 0.07;
    foliage(
      f,
      s.blobs.map((b: any) => ({ x: s.trunkX + b.dx, y: cy + b.dy, rx: b.rx, ry: b.ry })),
      [pack(mix(unpack(LEAF_DEEP.tones(sky)[0]), sky.ink, 0.2)), LEAF_DEEP.tones(sky)[2], leaf[2], leaf[3]],
      this.sunX,
      this.seed,
      { tone: autumn[3], rate: 0.02 },
    );
    // The acorn store at the roots.
    for (const p of s.pile) drawAcorn(f, sky, s.trunkX + this.sunSide * -(tw / 2 + 6) + p.x, this.hS - 1 - p.y);
    // Fallen leaves on the ground.
    for (const [lx, a, b] of s.leaves) {
      const x = Math.round(lx);
      f.px(x, this.gy[x] + 1 + Math.round(a * 4), b < 0.5 ? autumn[2] : autumn[3]);
    }
  }

  private paintCliff(f: Frame, sky: Sky) {
    const s = this.state;
    const rock_ = ROCK.tones(sky);
    const moss = MOSS.tones(sky);
    const w = Math.round(s.fw * 4 + this.L.stageW * 0.16);
    const x0 = Math.round(s.fx - w / 2);
    const x1 = x0 + w;
    const top = s.cliffTop as number;
    const foot = s.riverTop + 2;
    // A broken granite shoulder: steep near the falls, slumping into boulders at its flanks.
    const edgeL = (y: number) => {
      const t = (y - top) / (foot - top);
      return x0 - t * t * w * 0.35 + (noise1(y * 0.25, this.seed) - 0.5) * 6;
    };
    const edgeR = (y: number) => {
      const t = (y - top) / (foot - top);
      return x1 + t * t * w * 0.35 + (noise1(y * 0.25, this.seed + 9) - 0.5) * 6;
    };
    const crown = (x: number) => top - Math.round(noise1(x * 0.12, this.seed + 4) * 5 + (Math.abs(x - s.fx) < s.fw ? -1 : 0));
    const inside = (x: number, y: number) => y >= crown(x) && y <= foot && x >= edgeL(y) && x <= edgeR(y);
    rock(f, inside, [Math.floor(edgeL(foot)) - 2, top - 8, Math.ceil(edgeR(foot)) + 2, foot], rock_, this.sunSide, this.seed, moss);
    // A few pines rooted in the cracks along the lip.
    const pineC = LEAF_DEEP.tones(sky);
    const rim = pack(mix(unpack(pineC[2]), sky.glow, 0.3));
    this.pine(f, x0 + 4, crown(x0 + 4) + 1, Math.round(this.hS * 0.14), pineC[1], rim);
    this.pine(f, x1 - 5, crown(x1 - 5) + 1, Math.round(this.hS * 0.1), pineC[1], rim);
    this.pine(f, x1 + 3, crown(x1) + 4, Math.round(this.hS * 0.07), pineC[1], rim);
  }

  /** A flowering lime tree at the meadow's heart; the wild colony lives in its hollow. */
  private paintHive(f: Frame, sky: Sky) {
    const s = this.state;
    const bark = BARK.tones(sky);
    const tw = s.hiveW as number;
    const crownY = Math.round(this.hS - this.hS * 0.5);
    trunk(f, s.hiveX - tw / 2, tw, crownY, this.hS + 1, bark, this.sunSide, this.seed, { rim: sky.backlit > 0.3, flare: 3 });
    for (const a of [-0.8, 0.2, 0.9]) {
      const len = this.hS * 0.16;
      for (let w = 0; w < 2; w++) f.line(s.hiveX + w, crownY + 4, s.hiveX + Math.sin(a) * len + w, crownY - Math.cos(a) * len * 0.6, bark[w ? 1 : 2]);
    }
    const leaf = LEAF.tones(sky);
    const blossom = pack(mix([250, 236, 214], sky.light, 0.2));
    const r = rng(this.seed * 5 + 3);
    const blobs = Array.from({ length: 10 }, () => ({
      x: s.hiveX + (r() - 0.5) * this.hS * 0.46,
      y: crownY - this.hS * 0.08 + (r() - 0.6) * this.hS * 0.2,
      rx: this.hS * (0.07 + r() * 0.06),
      ry: this.hS * (0.05 + r() * 0.05),
    }));
    foliage(f, blobs, [pack(mix(unpack(LEAF_DEEP.tones(sky)[0]), sky.ink, 0.15)), LEAF_DEEP.tones(sky)[2], leaf[2], leaf[3]], this.sunX, this.seed + 2, { tone: blossom, rate: 0.16 });
    // The colony's doorway: a single dark hollow low on the trunk.
    const dy = Math.round(this.hS - this.hS * 0.2);
    f.ellipse(s.hiveX + this.sunSide, dy, 1.6, 2.6, () => bark[0]);
    s.door = { x: s.hiveX + this.sunSide, y: dy };
  }

  /** A flowering shrub the hummingbird works, massed behind the foxglove spikes. */
  private paintThicket(f: Frame, sky: Sky) {
    const L = this.L;
    const leaf = LEAF.tones(sky);
    const bloom = FOXGLOVE.tones(sky)[3];
    const r = rng(this.seed * 3 + 1);
    const base = this.hS - 2;
    const blobs = Array.from({ length: 9 }, () => ({
      x: L.stageX + (r() - 0.5) * L.stageW * 0.42,
      y: base - this.hS * (0.05 + r() * 0.09),
      rx: this.hS * (0.06 + r() * 0.06),
      ry: this.hS * (0.04 + r() * 0.05),
    }));
    foliage(f, blobs, [pack(mix(unpack(LEAF_DEEP.tones(sky)[0]), sky.ink, 0.15)), LEAF_DEEP.tones(sky)[2], leaf[2], leaf[3]], this.sunX, this.seed + 4, { tone: bloom, rate: 0.1 });
  }

  private paintWood(f: Frame, sky: Sky) {
    const s = this.state;
    const { W } = this;
    const bark = BARK.tones(sky);
    // Shafts of low sun slanting between the trunks.
    const shaft = mix(sky.glow, sky.light, 0.4);
    for (let k = 0; k < 3; k++) {
      const x0 = this.sunX - this.sunSide * (k * 28 + 10);
      for (let y = 0; y < this.hS; y++) {
        const cx = x0 - this.sunSide * y * 0.55;
        for (let x = Math.round(cx); x < cx + 6 + k * 2; x++) {
          if (bayer(x, y) < 5 - k) f.px(x, y, blend(f.get(x, y), shaft, 0.28));
        }
      }
    }
    // Trunks, far to near: far ones hazed, near ones dark with a golden rim.
    for (const t of s.trunks) {
      const near = 1 - t.depth;
      const tones = hazeTones(hazeTones(bark, sky.haze, t.depth * 0.55), sky.ink, near * 0.35);
      tones[4] = pack(mix(sky.glow, sky.light, 0.3));
      const w = Math.round(t.w * (0.6 + near * 0.9));
      trunk(f, t.x, w, 0, this.hS + 1, tones, this.sunSide, this.seed + t.x, { rim: true, flare: near > 0.5 ? 3 : 1 });
    }
    // A canopy of dark leaves closing overhead.
    const leaf = LEAF_DEEP.tones(sky);
    const roof = Math.round(this.hS * 0.16);
    for (let x = 0; x < W; x++) {
      const edge = roof + Math.round(noise1(x * 0.08, this.seed) * roof * 0.9);
      for (let y = 0; y < edge; y++) {
        if (y > edge - 3 && bayer(x, y) < 8) continue;
        f.px(x, y, y > edge - 5 && hash(x, y, 2) < 0.2 ? leaf[2] : leaf[0]);
      }
    }
  }

  /* ------------------------------------------------- dynamic painting */

  /** Advance the creatures. */
  update(i: Input) {
    const s = this.state;
    const dt = Math.min(0.1, i.dt);
    switch (this.spec.kind) {
      case 'meadow':
        this.updateDeer(i, dt);
        break;
      case 'beavers': {
        const sw = s.swimmer;
        if (sw.under > 0) {
          sw.under -= dt;
          if (sw.under <= 0) {
            sw.dir = -sw.dir;
            sw.x = this.L.stageX - sw.dir * this.L.stageW * 0.6;
          }
        } else {
          sw.x += sw.dir * 7 * dt;
          const past = sw.dir > 0 ? sw.x > s.lodgeX - s.lodgeR : sw.x < s.lodgeX + s.lodgeR;
          if (past) sw.under = 3.5;
        }
        s.builder.t += dt;
        break;
      }
      case 'squirrels':
        this.updateSquirrels(i, dt);
        break;
      case 'bear':
        this.updateBear(dt);
        break;
      case 'hummingbird':
        this.updateHummer(i, dt);
        break;
      case 'web':
        this.updateWeb(i, dt);
        break;
      case 'bees':
        this.updateBees(i, dt);
        break;
      case 'fireflies':
        for (const fl of s.flies) {
          fl.x += (noise1(i.t * 0.3 + fl.seed, 1) - 0.5) * 6 * dt;
          fl.y += (noise1(i.t * 0.3 + fl.seed, 2) - 0.5) * 5 * dt;
          if (i.pointer) {
            const dx = i.px - fl.x;
            const dy = i.py - fl.y;
            const d = Math.hypot(dx, dy);
            if (d < 60 && d > 4) {
              fl.x += (dx / d) * 5 * dt;
              fl.y += (dy / d) * 5 * dt;
            }
          }
          fl.y = Math.min(this.hS - 2, Math.max(this.hS * 0.25, fl.y));
        }
        break;
    }
  }

  /** Paint one frame: the cached statics, then everything that moves. */
  paint(f: Frame, bg: Frame, sky: Sky, i: Input) {
    f.buf.set(bg.buf);
    const s = this.state;
    this.paintClouds(f, sky, i.t);
    this.paintMist(f, sky, i.t);
    switch (this.spec.kind) {
      case 'meadow': {
        const d = s.deer;
        const gy = this.gy[Math.max(0, Math.min(this.W - 1, Math.round(d.x)))];
        this.figure(f, sky, Math.round(d.x) - 30, gy - 44, 60, 48, (g) => drawDeer(g, sky, d.x, gy, d.dir, d as DeerPose, this.sunSide), gy - 14);
        this.paintWater(f, sky, s.pondTop, s.pondBot, i.t, 0);
        this.paintReeds(f, sky, s.pondBot, i.t);
        break;
      }
      case 'beavers':
        this.paintLodge(f, sky, i.t);
        this.paintWater(f, sky, s.waterTop, s.waterBot, i.t, 0);
        this.paintSwimmer(f, sky, i.t);
        this.paintReeds(f, sky, s.waterBot, i.t);
        for (const st of s.stumps) this.stump(f, sky, st.x, s.waterBot + 1, st.h);
        break;
      case 'squirrels':
        this.paintSquirrels(f, sky, i);
        break;
      case 'bear':
        this.paintRiver(f, sky, i.t);
        break;
      case 'hummingbird':
        this.paintSpikes(f, sky, i.t);
        break;
      case 'web':
        this.paintWeb(f, sky, i.t);
        break;
      case 'bees':
        this.paintBees(f, sky, i.t);
        break;
      case 'fireflies':
        this.paintFireflies(f, sky, i.t);
        break;
    }
    const waterScene = this.spec.kind === 'beavers' || this.spec.kind === 'bear';
    if (!waterScene) this.paintGrass(f, sky, i);
    if (this.spec.kind === 'fireflies') this.paintFerns(f, sky, i.t);
    // Stacked layouts keep the forest floor under the words clean.
    else if (this.L.textSide !== 'bottom') this.foreground(f, sky, i.t);
  }

  /**
   * Draw a figure on its own layer, then trace one continuous line of rim
   * light along its sunward edge, the way a low sun outlines an animal.
   */
  private figure(f: Frame, sky: Sky, x0: number, y0: number, w: number, h: number, draw: (g: Frame) => void, topLimit = Infinity) {
    const g = this.scratch;
    const xa = Math.max(0, x0);
    const xb = Math.min(this.W, x0 + w);
    const ya = Math.max(0, y0);
    const yb = Math.min(this.H, y0 + h);
    for (let y = ya; y < yb; y++) g.buf.fill(0, y * this.W + xa, y * this.W + xb);
    draw(g);
    const rimOn = sky.backlit > 0.3;
    const rim = pack(mix(sky.sun, sky.light, 0.25));
    const top = pack(mix(sky.light, sky.glow, 0.3));
    const s = this.sunSide;
    for (let y = ya; y < yb; y++) {
      for (let x = xa; x < xb; x++) {
        const v = g.buf[y * this.W + x];
        if (!v) continue;
        let c = v;
        // Only the sunward contour of the mass lights: a pixel whose sun side is
        // open and whose far side is solid. Thin legs and tines stay dark.
        const solidBehind = g.get(x - s, y) !== 0;
        if (rimOn && !g.get(x + s, y) && solidBehind) c = rim;
        else if (rimOn && y < topLimit && !g.get(x, y - 1) && solidBehind && g.get(x + s, y) !== 0) c = top;
        f.buf[y * this.W + x] = c;
      }
    }
  }

  /** Slanting shafts of sunlight, dithered into whatever lies behind. */
  private shafts(f: Frame, sky: Sky, count: number, strength: number) {
    const c = mix(sky.glow, sky.light, 0.5);
    const sy = this.sunY(this.spec.hour);
    for (let k = 0; k < count; k++) {
      const spread = (k - (count - 1) / 2) * 0.35;
      const w = 4 + k * 3;
      for (let y = Math.max(0, sy); y < this.hS; y++) {
        const d = y - sy;
        const cx = this.sunX - this.sunSide * d * (0.45 + spread) ;
        const fade = 1 - d / (this.hS - sy + 1);
        for (let x = Math.round(cx); x < cx + w; x++) {
          if (bayer(x, y) / 16 < strength * fade) f.px(x, y, blend(f.get(x, y), c, 0.22));
        }
      }
    }
  }

  /** Dark stems and blades close to the camera, framing the stage's far corner. */
  private foreground(f: Frame, sky: Sky, t: number) {
    const { W, H } = this;
    const side = this.L.textSide === 'left' ? 1 : this.L.textSide === 'right' ? -1 : 1;
    const dark = pack(mix(sky.ink, sky.shade, 0.25));
    const edge = pack(mix(mix(sky.ink, sky.shade, 0.25), sky.glow, 0.35));
    const n = Math.round(W * 0.07) + 6;
    for (let i = 0; i < n; i++) {
      const u = hash(i, 11, this.seed);
      const x0 = side > 0 ? W - 1 - Math.round(u * u * W * 0.14) : Math.round(u * u * W * 0.14);
      const h = Math.round(H * (0.12 + hash(i, 12, this.seed) * 0.2) * (1 - u * 0.6));
      const lean = (hash(i, 13, this.seed) - 0.5) * 0.6 - side * 0.25;
      const sway = wind(x0, t, W) * 0.08;
      for (let j = 0; j < h; j++) {
        const k = j / h;
        const x = Math.round(x0 + (lean + sway) * j * k * 0.9);
        const y = H - j;
        f.px(x, y, dark);
        if (k < 0.6) f.px(x + 1, y, dark);
        if (k > 0.3 && hash(i, j, 3) < 0.2) f.px(x - this.sunSide, y, edge);
      }
      // Seed heads on a few stems.
      if (hash(i, 14, this.seed) < 0.3) {
        const x = Math.round(x0 + (lean + sway) * h * 0.9);
        f.rect(x - 1, H - h - 2, 2, 3, dark);
      }
    }
  }

  private paintClouds(f: Frame, sky: Sky, t: number) {
    if (this.spec.kind === 'fireflies') return;
    const { W } = this;
    const lit = mix(sky.lower, sky.light, 0.55);
    const body = mix(sky.upper, sky.glow, 0.28);
    const under = mix(sky.upper, sky.shade, 0.25);
    const ceiling = Math.max(4, Math.min(...this.ridges.map((rd) => rd.base - rd.amp)) - 6);
    for (let k = 0; k < 4; k++) {
      const w = Math.round(W * (0.08 + hash(k, 1, this.seed) * 0.14));
      const y = Math.round(4 + hash(k, 2, this.seed) * (ceiling - 8));
      const x = Math.round(((hash(k, 3, this.seed) * (W + w) + t * (0.8 + k * 0.25)) % (W + w * 2)) - w);
      const rows = [
        [0.3, 0.55, lit],
        [0.1, 0.9, body],
        [0, 1, body],
        [0.15, 0.8, under],
      ] as const;
      rows.forEach(([a, b, c], j) => {
        const cp = pack(c);
        for (let xx = x + Math.round(a * w); xx < x + Math.round(b * w); xx++) {
          if ((xx === x + Math.round(a * w) || xx === x + Math.round(b * w) - 1) && bayer(xx, y + j) < 8) continue;
          f.px(xx, y + j, cp);
        }
      });
    }
  }

  private paintMist(f: Frame, sky: Sky, t: number) {
    const heavy = this.spec.hour < 8 || this.spec.hour > 17.5;
    if (!heavy) return;
    const { W } = this;
    const mist = mix(sky.haze, sky.light, 0.4);
    // Two banks of low mist lying between the ridges: several rows deep,
    // densest in the middle, dithered away at the top, bottom and ends.
    for (let k = 0; k < 2; k++) {
      const y0 = Math.round(this.hS - this.hS * (0.17 + k * 0.1));
      const rows = 5 + k;
      const len = W * (0.5 + hash(k, 5, this.seed) * 0.4);
      const x0 = ((hash(k, 6, this.seed) * W + t * (1.2 + k * 0.8)) % (W + len)) - len;
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, x0 + len); x++) {
        const u = (x - x0) / len;
        const ends = Math.min(1, Math.min(u, 1 - u) * 5);
        for (let j = 0; j < rows; j++) {
          const v = 1 - Math.abs(j - (rows - 1) / 2) / ((rows + 1) / 2);
          const density = ends * v * 0.75;
          if (bayer(x, y0 + j) / 16 < density) f.px(x, y0 + j, blend(f.get(x, y0 + j), mist, 0.4));
        }
      }
    }
  }

  /** Water mirrors whatever has been drawn above it, rippled and tinted. */
  private paintWater(f: Frame, sky: Sky, top: number, bot: number, t: number, flow: number) {
    const { W } = this;
    const deep = mix(sky.water, sky.ink, 0.3);
    for (let y = top; y < bot && y < this.H; y++) {
      const depth = (y - top) / Math.max(1, bot - top);
      const k = 0.28 + Math.floor(depth * 3) * 0.12;
      const src = 2 * top - y - 1;
      const amp = 0.4 + depth * 0.9;
      for (let x = 0; x < W; x++) {
        const ripple = Math.round(Math.sin(y * 0.9 + t * 1.7 + x * 0.05) * amp * (bayer(x, y) < 8 ? 1 : 0.5));
        let c = f.get(Math.max(0, Math.min(W - 1, x + ripple)), Math.max(0, src));
        c = blend(c, deep, k);
        // Glints: short strokes of sky on the surface, drifting with the flow.
        const g = hash(Math.floor((x - t * flow) / 3), y, Math.floor(t * 1.5));
        if (g > 0.986) c = blend(c, sky.light, 0.5);
        f.buf[y * W + x] = c;
      }
    }
    // A glitter path under the sun.
    const sunT = Math.max(0, 1 - sky.dim);
    for (let y = top + 1; y < bot; y++) {
      const spread = 1.5 + (y - top) * 0.3;
      for (let x = Math.round(this.sunX - spread); x < this.sunX + spread; x++) {
        if (hash(x, y, Math.floor(t * 3)) > 0.86 && (y + Math.floor(t * 2)) % 2 === 0) f.px(x, y, blend(f.get(x, y), sky.sun, 0.7 * sunT + 0.2));
      }
    }
    // The shore line.
    const shore = pack(mix(sky.grass, sky.light, 0.25));
    f.hline(0, W - 1, top - 1, blend(shore, sky.shade, 0.3));
  }

  private paintReeds(f: Frame, sky: Sky, shoreY: number, t: number) {
    const reeds = this.state.reeds ?? [];
    const c = LEAF_DEEP.tones(sky);
    const head = BARK.tones(sky)[1];
    for (const rd of reeds) {
      const bend = Math.round(wind(rd.x, t, this.W) * 1.4);
      for (let j = 0; j < rd.h; j++) f.px(rd.x + (j > rd.h * 0.6 ? bend : 0), shoreY - j, c[1]);
      f.px(rd.x + bend, shoreY - rd.h, head);
      f.px(rd.x + bend, shoreY - rd.h - 1, head);
    }
  }

  private stump(f: Frame, sky: Sky, x: number, y: number, h: number) {
    const b = BIRCH.tones(sky);
    for (let j = 0; j < h; j++) {
      f.rect(x, y - j, 3, 1, b[j === h - 1 ? 3 : 2]);
      f.px(x + (this.sunSide > 0 ? 0 : 2), y - j, b[1]);
    }
    // The beaver's point.
    f.px(x + 1, y - h, b[3]);
    f.px(x + 1, y - h - 1, BARK.tones(sky)[2]);
  }

  private paintLodge(f: Frame, sky: Sky, t: number) {
    const s = this.state;
    const st = STICKS.tones(sky);
    const mud = SOIL.tones(sky);
    const R = s.lodgeR as number;
    const hgt = Math.round(R * 0.55);
    const x0 = s.lodgeX;
    const base = s.lodgeY + 1;
    // Mud-packed dome.
    for (let y = base - hgt; y <= base; y++) {
      const k = (base - y) / hgt;
      const hw = Math.round(R * Math.sqrt(1 - k * k));
      for (let x = x0 - hw; x <= x0 + hw; x++) {
        const lit = (x - x0) * this.sunSide > hw * 0.3 && k > 0.2;
        f.px(x, y, lit ? mud[3] : k < 0.25 ? mud[1] : mud[2]);
      }
    }
    // Sticks laid across it every which way.
    for (const [a, b, c, d] of s.sticks) {
      const y = base - Math.round(a * hgt);
      const k = (base - y) / hgt;
      const hw = R * Math.sqrt(1 - k * k);
      const x = x0 + (b - 0.5) * hw * 1.8;
      const len = 3 + c * 6;
      const ang = (d - 0.5) * 1.6;
      f.line(x, y, x + Math.cos(ang) * len, y - Math.sin(ang) * len * 0.6, a > 0.5 ? st[3] : st[1]);
    }
    // The builder at the crown, settling a new stick.
    const bob = Math.sin(s.builder.t * 2.4) > 0.7 ? -1 : 0;
    const carrying = Math.sin(s.builder.t * 0.6) > 0;
    drawBeaver(f, sky, x0 + this.sunSide * -2, base - hgt, this.L.textSide === 'left' ? -1 : 1, false, carrying, bob, this.sunSide);
    void t;
  }

  private paintSwimmer(f: Frame, sky: Sky, t: number) {
    const s = this.state;
    const sw = s.swimmer;
    if (sw.under > 0) {
      // Rings where it dived.
      const age = 3.5 - sw.under;
      if (age < 1.6) {
        const r = 1 + age * 4;
        const c = mix(sky.light, sky.water, 0.4);
        for (let a = 0; a < Math.PI * 2; a += 0.35) f.px(sw.x + Math.cos(a) * r, s.swimY + Math.sin(a) * r * 0.3, blend(f.get(sw.x + Math.cos(a) * r, s.swimY + Math.sin(a) * r * 0.3), c, 0.5));
      }
      return;
    }
    // A V-shaped wake spreading behind.
    const wake = mix(sky.light, sky.water, 0.3);
    for (let i = 2; i < 18; i++) {
      const x = sw.x - sw.dir * i;
      const spread = Math.round(i * 0.35);
      if ((i + Math.floor(t * 6)) % 3 === 0) continue;
      f.px(x, s.swimY - spread + 1, blend(f.get(x, s.swimY - spread + 1), wake, 0.55 - i * 0.025));
      f.px(x, s.swimY + spread + 1, blend(f.get(x, s.swimY + spread + 1), wake, 0.55 - i * 0.025));
    }
    const bob = Math.sin(t * 3) > 0.6 ? 1 : 0;
    drawBeaver(f, sky, sw.x, s.swimY, sw.dir, true, true, bob, this.sunSide);
  }

  private updateDeer(i: Input, dt: number) {
    const d = this.state.deer;
    d.timer -= dt;
    const near = i.pointer && Math.abs(i.px - d.x) < 70 && i.py > this.hS - 60 && i.py < this.hS + 30;
    const approach = (k: string, v: number, rate: number) => (d[k] += (v - d[k]) * Math.min(1, dt * rate));
    switch (d.mode) {
      case 'graze':
        approach('head', 0, 5);
        d.chew = Math.sin(i.t * 7) > 0.4 ? 1 : 0;
        approach('ears', Math.sin(i.t * 0.7) > 0.95 ? -1 : 0, 10);
        if (near || d.timer <= 0) {
          d.mode = 'look';
          d.timer = near ? 1.6 : 2 + Math.random() * 2;
        }
        break;
      case 'look':
        approach('head', 1, 4);
        d.chew = 0;
        approach('ears', near ? 1 : 0.4, 8);
        if (near) d.timer = Math.max(d.timer, 0.8);
        if (d.timer <= 0) {
          d.mode = 'graze';
          d.timer = 5 + Math.random() * 6;
        }
        break;
      case 'startle':
        approach('head', 1, 18);
        d.ears = 1;
        d.tail = 1;
        if (d.timer <= 0) {
          d.mode = 'run';
          d.dir = 1;
          d.gait = 0;
          d.speed = 60;
        }
        break;
      case 'run':
        d.gait += dt * 17;
        d.speed = Math.min(210, d.speed + dt * 420);
        d.x += d.speed * dt;
        d.tail = 1;
        if (d.x > this.W + 24 && this.runDone) {
          this.runDone();
          this.runDone = null;
        }
        break;
    }
    if (d.mode !== 'run') approach('tail', Math.sin(i.t * 1.3) > 0.97 ? 1 : 0, 12);
  }

  /** Send the deer running off to the right. Resolves when it has left the frame. */
  run(): Promise<void> {
    const d = this.state.deer;
    if (!d) return Promise.resolve();
    return new Promise((done) => {
      this.runDone = done;
      d.mode = 'startle';
      d.timer = 0.16;
    });
  }

  /** Put the deer back to grazing, after a return with the back button. */
  reset() {
    const d = this.state.deer;
    if (!d) return;
    Object.assign(d, { x: this.L.stageX, dir: this.L.textSide === 'left' ? -1 : 1, mode: 'graze', gait: NaN, speed: 0, timer: 4 });
  }

  private updateSquirrels(i: Input, dt: number) {
    const s = this.state;
    const c = s.climber;
    c.t += dt;
    const baseY = this.hS - 3;
    const trunkEdge = s.trunkX - this.sunSide * (s.tw / 2 + 1) * 0 + (this.sunSide > 0 ? -s.tw / 2 - 1 : s.tw / 2 + 1) * -1;
    void trunkEdge;
    switch (c.phase) {
      case 'down':
        c.y += 22 * dt;
        if (c.y >= baseY) {
          c.phase = 'toPile';
          c.x = 0;
        }
        break;
      case 'toPile':
        c.x += 14 * dt;
        if (c.x > 8) {
          c.phase = 'forage';
          c.t = 0;
        }
        break;
      case 'forage':
        if (c.t > 1.4) {
          c.acorn = true;
          c.phase = 'back';
        }
        break;
      case 'back':
        c.x -= 14 * dt;
        if (c.x <= 0) c.phase = 'up';
        break;
      case 'up':
        c.y -= 18 * dt;
        if (c.y <= s.hollowY + 3) {
          c.phase = 'stash';
          c.t = 0;
        }
        break;
      case 'stash':
        if (c.t > 1.2) {
          c.acorn = false;
          c.phase = 'down';
        }
        break;
    }
    const sit = s.sitter;
    sit.t += dt;
    if (i.pointer && Math.abs(i.px - s.trunkX) < 80) sit.dir = i.px > s.trunkX ? 1 : -1;
    s.dropTimer -= dt;
    if (s.dropTimer <= 0) {
      s.dropTimer = 3 + Math.random() * 4;
      s.falling.push({ x: s.trunkX + (Math.random() - 0.5) * this.hS * 0.5, y: s.canopyY, vy: 0, bounced: false });
    }
    for (const a of s.falling) {
      a.vy += 120 * dt;
      a.y += a.vy * dt;
      const g = this.gy[Math.max(0, Math.min(this.W - 1, Math.round(a.x)))] - 2;
      if (a.y >= g) {
        a.y = g;
        if (!a.bounced) {
          a.vy = -a.vy * 0.35;
          a.bounced = true;
        } else a.vy = 0;
      }
    }
    if (s.falling.length > 6) s.falling.shift();
  }

  private paintSquirrels(f: Frame, sky: Sky, i: Input) {
    const s = this.state;
    const c = s.climber;
    const side = this.sunSide > 0 ? 1 : -1;
    // The climber works the sunlit face of the trunk, then the ground.
    const trunkX = s.trunkX + side * Math.round(s.tw / 2);
    if (c.phase === 'down' || c.phase === 'up' || c.phase === 'stash') {
      drawSquirrel(f, sky, trunkX, c.y, c.phase === 'down' ? -1 : 1, 'climb', i.t * 14, c.acorn, this.sunSide);
    } else {
      const x = trunkX + side * (3 + c.x);
      drawSquirrel(f, sky, x, this.hS - 1, c.phase === 'back' ? -side : side, c.phase === 'forage' ? 'sit' : 'run', c.phase === 'forage' ? (Math.sin(i.t * 9) > 0 ? 1 : 0) : i.t * 16, c.acorn, this.sunSide);
    }
    const sit = s.sitter;
    const sx = s.trunkX - side * (s.tw / 2 + 8);
    drawSquirrel(f, sky, sx, this.hS - 1, sit.dir, 'sit', Math.sin(sit.t * 8) > 0.2 ? 1 : 0, true, this.sunSide);
    for (const a of s.falling) drawAcorn(f, sky, a.x, a.y);
  }

  private updateBear(dt: number) {
    const s = this.state;
    const b = s.bear;
    s.leapTimer -= dt;
    if (!s.salmon && s.leapTimer <= 0) {
      s.leaps++;
      s.salmon = { t: 0, x0: b.x + b.dir * 6, x1: s.fx, catch: s.leaps % 3 === 0 };
    }
    if (s.salmon) {
      const sm = s.salmon;
      sm.t += dt / 1.2;
      if (sm.catch && sm.t > 0.28 && sm.t < 0.5) b.lunge = Math.min(1, b.lunge + dt * 7);
      if (sm.catch && sm.t >= 0.42) {
        s.salmon = null;
        b.fish = 1.9;
        s.leapTimer = 3.2;
      } else if (sm.t >= 1) {
        s.salmon = null;
        s.leapTimer = 1.4 + Math.random() * 1.4;
      }
    }
    if (b.fish > 0) {
      b.fish -= dt;
      if (b.fish < 1.2) b.lunge = Math.max(0, b.lunge - dt * 2);
    } else if (!s.salmon?.catch) b.lunge = Math.max(0, b.lunge - dt * 3);
  }

  private paintRiver(f: Frame, sky: Sky, t: number) {
    const s = this.state;
    const { W } = this;
    const white = mix(sky.light, [255, 255, 255], 0.6);
    const blue = mix(sky.water, sky.light, 0.3);
    // The falls: streaks sliding down over the lip.
    for (let y = s.cliffTop - 1; y < s.riverTop + 2; y++) {
      for (let x = s.fx - Math.floor(s.fw / 2); x < s.fx + Math.ceil(s.fw / 2); x++) {
        const lane = hash(x, 0, this.seed);
        const v = (y - t * (40 + lane * 30)) * 0.25;
        const streak = hash(x, Math.floor(v), 7) > 0.45;
        const edge = x === s.fx - Math.floor(s.fw / 2) || x === s.fx + Math.ceil(s.fw / 2) - 1;
        f.px(x, y, pack(streak && !edge ? white : mix(blue, white, lane * 0.4)));
      }
    }
    // The river, flowing away from the falls, then the wet near bank.
    this.paintWater(f, sky, s.riverTop, s.riverBot, t, 8);
    const foam = pack(white);
    for (let k = 0; k < s.fw * 5; k++) {
      const a = hash(k, Math.floor(t * 8), 3);
      const x = s.fx + (a - 0.5) * s.fw * 2.4;
      const y = s.riverTop + hash(k, Math.floor(t * 8), 4) ** 2 * 6;
      f.px(x, y, foam);
    }
    for (let y = s.riverTop + 2; y < s.riverBot; y++) {
      for (let x = 0; x < W; x += 1) {
        const v = x - t * 10 * (x > s.fx ? 1 : -1);
        if (hash(Math.floor(v / 4), y, 11) > 0.93) f.px(x, y, blend(f.get(x, y), white, 0.45));
      }
    }
    for (const bo of s.boulders) {
      const rock = ROCK.tones(sky);
      f.ellipse(bo.x, s.riverTop + 4, bo.r + 1, bo.r * 0.6, (nx, ny) => (ny < -0.2 ? rock[3] : rock[2]));
      f.hline(bo.x - bo.r - 1, bo.x + bo.r + 1, s.riverTop + 4 + Math.round(bo.r * 0.6), foam);
    }
    const b = s.bear;
    // Salmon mid-leap: a high arc from the pool toward the lip of the falls.
    if (s.salmon) {
      const sm = s.salmon;
      const x = sm.x0 + (sm.x1 - sm.x0) * sm.t;
      const peak = (s.riverTop - s.cliffTop) * 0.65;
      const y = s.riverTop - Math.sin(sm.t * Math.PI) * peak;
      const pitch = Math.cos(sm.t * Math.PI) * -1.1;
      drawSalmon(f, sky, x, y, Math.sign(sm.x1 - sm.x0) || 1, pitch, this.sunSide);
    }
    drawBear(f, sky, b.x, s.riverTop + 4, b.dir, { lunge: b.lunge, fish: b.fish > 0, breathe: Math.sin(t * 1.5) > 0.6 ? 1 : 0 }, this.sunSide);
    // Water closes around the bear's legs.
    for (let x = b.x - 14; x < b.x + 14; x++) {
      if (hash(x, Math.floor(t * 6), 5) > 0.5) f.px(x, s.riverTop + 4, foam);
      f.px(x, s.riverTop + 5, blend(f.get(x, s.riverTop + 5), blue, 0.6));
    }
  }

  private updateHummer(i: Input, dt: number) {
    const s = this.state;
    const b = s.bird;
    if (b.dart > 0) {
      b.dart -= dt;
      const k = 1 - Math.max(0, b.dart) / 0.22;
      const e = 1 - (1 - k) ** 3;
      b.x = b.fx + (b.tx - b.fx) * e;
      b.y = b.fy + (b.ty - b.fy) * e;
      return;
    }
    b.hover -= dt;
    b.y += Math.sin(i.t * 5) * 0.08;
    if (b.hover <= 0) {
      let tx: number;
      let ty: number;
      const curious = i.pointer && Math.abs(i.px - this.L.stageX) < this.L.stageW * 0.7 && i.py < this.hS && i.py > this.hS * 0.3;
      if (curious) {
        tx = i.px - Math.sign(i.px - b.x || 1) * 9;
        ty = i.py;
        b.hover = 1.4;
      } else {
        b.target = (b.target + 1 + Math.floor(Math.random() * (s.spikes.length - 1))) % s.spikes.length;
        const sp = s.spikes[b.target];
        const bell = 2 + Math.floor(Math.random() * Math.max(1, sp.h * 0.5 - 2));
        tx = sp.x + Math.round(sp.lean * (sp.h - bell));
        ty = this.gy[Math.max(0, Math.min(this.W - 1, sp.x))] - sp.h + bell;
        const side = tx > b.x ? -1 : 1;
        tx += side * 4;
        b.hover = 1 + Math.random() * 1.8;
      }
      b.dir = tx > b.x ? 1 : -1;
      b.fx = b.x;
      b.fy = b.y;
      b.tx = tx;
      b.ty = ty;
      b.dart = 0.22;
    }
  }

  private paintSpikes(f: Frame, sky: Sky, t: number) {
    const s = this.state;
    const stem = LEAF.tones(sky);
    for (const sp of s.spikes) {
      const pal = (sp.kind ? FIREWEED : FOXGLOVE).tones(sky);
      const g = this.gy[Math.max(0, Math.min(this.W - 1, sp.x))];
      const sway = wind(sp.x, t, this.W) * 1.5;
      for (let j = 0; j < sp.h; j++) {
        const k = j / sp.h;
        const x = Math.round(sp.x + (sp.lean + sway * 0.12) * j * (k * 0.8));
        const y = g - j;
        f.px(x, y, stem[j % 4 === 0 ? 1 : 2]);
        // Blooms climb the upper half of the spike, opening lower first.
        if (k > 0.35 && j % 2 === 0) {
          const side = (j / 2) % 2 ? 1 : -1;
          const lit = side * this.sunSide > 0;
          f.px(x + side, y, pal[lit ? 3 : 2]);
          if (k < 0.8) f.px(x + side * 2, y + 1, pal[lit ? 2 : 1]);
          if (sp.kind === 0 && k < 0.7) f.px(x + side, y + 1, pal[0]);
        }
      }
      const tipX = Math.round(sp.x + (sp.lean + sway * 0.12) * sp.h * 0.8);
      f.px(tipX, g - sp.h, stem[3]);
    }
    const b = s.bird;
    if (b.dart > 0) {
      const c = mix(sky.light, [255, 255, 255], 0.3);
      for (let k = 1; k < 7; k++) {
        const x = b.x - (b.tx - b.fx) * 0.06 * k;
        const y = b.y - (b.ty - b.fy) * 0.06 * k;
        if (k % 2) f.px(x, y, blend(f.get(x, y), c, 0.5 - k * 0.06));
      }
    }
    drawHummingbird(f, sky, b.x, b.y, b.dir, Math.floor(t * 30), this.sunSide);
  }

  private updateWeb(i: Input, dt: number) {
    const s = this.state;
    const r = s.rand as () => number;
    for (const g of s.gnats) {
      if (g.stuck) {
        g.life += dt;
        continue;
      }
      g.x += g.vx * dt;
      g.y += (noise1(i.t * 2 + g.seed, 3) - 0.5) * 18 * dt;
      const d = Math.hypot(g.x - s.cx, g.y - s.cy);
      if (d < s.R * 0.95 && !g.tried) {
        g.tried = true;
        if (r() < 0.55) g.stuck = true;
      }
      if (Math.abs(g.x - this.L.stageX) > this.L.stageW * 0.8) Object.assign(g, this.newGnat(r));
    }
    // The spider visits the oldest catch and wraps it, then returns.
    const sp = s.spider;
    sp.t += dt;
    if (!sp.target) {
      const catchy = s.gnats.filter((g: any) => g.stuck && g.life > 2.5);
      if (catchy.length && sp.t > 2) sp.target = catchy[0];
      else {
        sp.x += (s.cx - sp.x) * Math.min(1, dt * 1.5);
        sp.y += (s.cy - sp.y) * Math.min(1, dt * 1.5);
      }
    } else {
      sp.x += (sp.target.x - sp.x) * Math.min(1, dt * 1.8);
      sp.y += (sp.target.y - sp.y) * Math.min(1, dt * 1.8);
      if (Math.hypot(sp.target.x - sp.x, sp.target.y - sp.y) < 1.5) {
        Object.assign(sp.target, this.newGnat(r));
        sp.target = null;
        sp.t = 0;
      }
    }
    // Dew runs down the lower spokes and drips through.
    for (const dr of s.drops) {
      if (dr.fall < 0) {
        dr.d += dt * 0.05;
        if (dr.d > 0.95) {
          const spk = s.spokes[dr.spoke];
          dr.x = s.cx + Math.cos(spk.a) * s.R * spk.len;
          dr.y = s.cy + Math.sin(spk.a) * s.R * spk.len;
          dr.fall = 0;
          dr.vy = 0;
        }
      } else {
        dr.vy += 90 * dt;
        dr.y += dr.vy * dt;
        if (dr.y > this.hS) {
          // Pick a spoke that points downward for the next drop.
          const down = s.spokes.map((sk: any, k: number) => [k, Math.sin(sk.a)]).filter(([, v]: number[]) => v > 0.4);
          dr.spoke = down.length ? down[Math.floor(r() * down.length)][0] : dr.spoke;
          dr.d = 0.15;
          dr.fall = -1;
        }
      }
    }
  }

  private paintWeb(f: Frame, sky: Sky, t: number) {
    const s = this.state;
    const { cx, cy, R } = s;
    const silk = mix(sky.light, [255, 255, 255], 0.55);
    const sun = mix(sky.sun, [255, 255, 255], 0.3);
    const bark = BARK.tones(sky);
    // Anchors: a bough from above on the far side, a seed stalk below.
    const side = this.L.textSide === 'left' ? 1 : this.L.textSide === 'right' ? -1 : 1;
    const bx = cx + side * R * 1.3;
    for (let w = 0; w < 3; w++) f.line(bx + side * 40, cy - R * 1.5 + w, cx - side * R * 0.2, cy - R * 1.1 + w * 0.5, bark[w === 1 ? 2 : 1]);
    const stalkX = Math.round(cx - side * R * 0.9);
    const g = this.gy[Math.max(0, Math.min(this.W - 1, stalkX))];
    const stem = LEAF.tones(sky);
    for (let y = Math.round(cy + R * 0.4); y < g; y++) f.px(stalkX + Math.round(wind(stalkX, t, this.W) * (g - y) * 0.02), y, stem[2]);
    f.rect(stalkX - 1, Math.round(cy + R * 0.4) - 3, 3, 3, BARK.tones(sky)[3]);

    const strand = (x0: number, y0: number, x1: number, y1: number) => {
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / n);
        const y = Math.round(y0 + ((y1 - y0) * k) / n);
        // Where the thread faces the sun it flashes; elsewhere it is barely there.
        const ang = Math.atan2(y - cy, x - cx);
        const glint = Math.cos(ang * 2 - t * 0.4 - Math.atan2(this.sunY(this.spec.hour) - cy, this.sunX - cx) * 2);
        const k2 = glint > 0.86 ? 0.85 : glint > 0.4 ? 0.42 : 0.2;
        f.px(x, y, blend(f.get(x, y), glint > 0.93 ? sun : silk, k2));
      }
    };
    const pts = s.spokes.map((sp: any) => [cx + Math.cos(sp.a) * R * sp.len, cy + Math.sin(sp.a) * R * sp.len]);
    // Guy lines to the anchors.
    strand(pts[0][0], pts[0][1], bx, cy - R * 1.1);
    strand(cx - side * R * 0.6, cy - R * 0.8, cx - side * R * 0.2, cy - R * 1.1);
    strand(pts[Math.floor(pts.length / 2)][0], pts[Math.floor(pts.length / 2)][1], stalkX, cy + R * 0.4 - 2);
    for (const [x, y] of pts) strand(cx, cy, x, y);
    for (let ring = 1; ring < s.rings; ring++) {
      const k = 0.18 + (ring / s.rings) * 0.8;
      for (let i = 0; i < pts.length; i++) {
        const a = s.spokes[i];
        const b = s.spokes[(i + 1) % pts.length];
        strand(
          cx + Math.cos(a.a) * R * a.len * k,
          cy + Math.sin(a.a) * R * a.len * k,
          cx + Math.cos(b.a) * R * b.len * k,
          cy + Math.sin(b.a) * R * b.len * k,
        );
      }
    }
    // Dew beads on the threads, twinkling.
    for (const dw of s.dew) {
      const sp = s.spokes[dw.spoke];
      const k = 0.18 + (dw.ring / s.rings) * 0.8;
      const x = Math.round(cx + Math.cos(sp.a) * R * sp.len * k);
      const y = Math.round(cy + Math.sin(sp.a) * R * sp.len * k);
      f.px(x, y, pack(silk));
      const tw = Math.sin(t * 2.2 + dw.phase);
      if (tw > 0.9) {
        f.px(x - 1, y, pack(sun));
        f.px(x + 1, y, pack(sun));
        f.px(x, y - 1, pack(sun));
        f.px(x, y + 1, pack(sun));
      }
    }
    // Drops on their way down and through.
    for (const dr of s.drops) {
      if (dr.fall < 0) {
        const sp = s.spokes[dr.spoke];
        f.px(cx + Math.cos(sp.a) * R * sp.len * dr.d, cy + Math.sin(sp.a) * R * sp.len * dr.d, pack(mix(silk, sun, 0.5)));
      } else {
        f.px(dr.x, dr.y, pack(silk));
        f.px(dr.x, dr.y - 1, blend(f.get(dr.x, dr.y - 1), silk, 0.4));
      }
    }
    const gnat = HOOF.tones(sky)[1];
    for (const gn of s.gnats) {
      const wob = gn.stuck ? (Math.sin(t * 20 + gn.seed) > 0.5 ? 1 : 0) : 0;
      f.px(gn.x + wob, gn.y, gnat);
      if (!gn.stuck && Math.floor(t * 20 + gn.seed) % 2) f.px(gn.x, gn.y - 1, blend(f.get(gn.x, gn.y - 1), silk, 0.5));
      if (gn.stuck && gn.life > 1) f.px(gn.x, gn.y + 1, blend(f.get(gn.x, gn.y + 1), silk, 0.6));
    }
    drawSpider(f, sky, s.spider.x, s.spider.y - 1, t * 6);
  }

  private updateBees(i: Input, dt: number) {
    const s = this.state;
    const door = s.door ?? { x: s.hiveX, y: this.hS - s.hiveH * 0.65 };
    for (const b of s.bees) {
      if (b.wait > 0) {
        b.wait -= dt;
        continue;
      }
      const fl = s.flowers[b.target];
      const tx = b.home ? door.x : fl.x;
      const ty = b.home ? door.y : this.gy[Math.max(0, Math.min(this.W - 1, fl.x))] - fl.h - 1;
      let dx = tx - b.x;
      let dy = ty - b.y;
      if (i.pointer) {
        const px = i.px - b.x;
        const py = i.py - b.y;
        const d = Math.hypot(px, py);
        if (d < 30 && d > 3) {
          dx += (px / d) * 6;
          dy += (py / d) * 6;
        }
      }
      const d = Math.hypot(dx, dy);
      if (d < 1.2) {
        if (b.home) {
          b.home = false;
          b.pollen = false;
          b.visits = 0;
          b.wait = 1 + Math.random() * 1.5;
          b.x = door.x;
          b.y = door.y;
        } else {
          b.wait = 0.6 + Math.random();
          b.visits++;
          b.pollen = b.visits >= 2;
          if (b.visits >= 3) b.home = true;
          else b.target = Math.floor(Math.random() * s.flowers.length);
        }
        continue;
      }
      const speed = 16;
      b.vx = (dx / d) * speed;
      b.vy = (dy / d) * speed;
      b.x += b.vx * dt;
      b.y += b.vy * dt + Math.sin(i.t * 9 + b.seed) * 0.35;
    }
  }

  private paintBees(f: Frame, sky: Sky, t: number) {
    const s = this.state;
    const stem = LEAF.tones(sky);
    const pals = [CLOVER, DAISY, BUTTERCUP, CORNFLOWER].map((m) => m.tones(sky));
    for (const fl of s.flowers) {
      const g = this.gy[Math.max(0, Math.min(this.W - 1, fl.x))];
      const bend = Math.round(wind(fl.x, t, this.W) * 1.2);
      for (let j = 1; j <= fl.h; j++) f.px(fl.x + (j > fl.h - 2 ? bend : 0), g - j, stem[j % 3 ? 2 : 1]);
      const p = pals[fl.kind];
      const x = fl.x + bend;
      const y = g - fl.h - 1;
      f.px(x, y, p[3]);
      if (fl.kind === 1) {
        f.px(x - 1, y, p[2]);
        f.px(x + 1, y, p[2]);
        f.px(x, y, pals[2][3]);
      } else {
        f.px(x + (this.sunSide > 0 ? 1 : -1), y, p[2]);
        f.px(x, y - 1, p[fl.kind === 0 ? 2 : 3]);
      }
    }
    const gold = pack(mix([242, 190, 40], sky.light, 0.2));
    const dark = pack(mix([30, 22, 16], sky.shade, 0.2));
    const wing = pack(mix(sky.light, [255, 255, 255], 0.6));
    const pollen = pack([255, 170, 40]);
    for (const b of s.bees) {
      if (b.wait > 0 && Math.hypot(b.x - s.hiveX, b.y - (this.hS - s.hiveH * 0.65)) < 3) continue;
      // A faint flight line behind each bee, so its path reads across the meadow.
      if (b.wait <= 0 && b.vx !== undefined) {
        const trail = mix(sky.light, [255, 230, 150], 0.3);
        for (let k = 2; k <= 6; k += 2) {
          const tx = b.x - b.vx * 0.04 * k;
          const ty = b.y - b.vy * 0.04 * k;
          f.px(tx, ty, blend(f.get(tx, ty), trail, 0.5 - k * 0.06));
        }
      }
      drawBee(f, b.x, b.y, Math.floor(t * 24 + b.seed), b.pollen, gold, dark, wing, pollen);
    }
  }

  private paintFireflies(f: Frame, sky: Sky, t: number) {
    const s = this.state;
    for (const fl of s.flies) {
      const cyc = ((t + fl.phase) % fl.period) / fl.period;
      const on = cyc < 0.28 ? Math.sin((cyc / 0.28) * Math.PI) : 0;
      const x = Math.round(fl.x);
      const y = Math.round(fl.y);
      const core: RGB = fl.hue < 0.5 ? [226, 255, 120] : [255, 226, 110];
      if (on > 0.05) {
        const halo = mix(core, sky.shade, 0.3);
        if (on > 0.5) {
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) f.px(x + dx, y + dy, blend(f.get(x + dx, y + dy), halo, on * 0.55));
          for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]])
            if (bayer(x + dx, y + dy) < 8) f.px(x + dx, y + dy, blend(f.get(x + dx, y + dy), halo, on * 0.3));
        }
        f.px(x, y, blend(f.get(x, y), core, 0.4 + on * 0.6));
      } else {
        f.px(x, y, blend(f.get(x, y), sky.shade, 0.5));
      }
    }
  }

  private paintFerns(f: Frame, sky: Sky, t: number) {
    const fern = FERN.tones(sky);
    for (const fr of this.state.ferns) {
      const g = this.gy[Math.max(0, Math.min(this.W - 1, fr.x))];
      const sway = Math.round(wind(fr.x, t, this.W) * 1.2);
      for (let j = 0; j < fr.h; j++) {
        const x = fr.x + fr.s * Math.round(j * 0.6) + (j > fr.h / 2 ? sway : 0);
        const y = g - Math.round(j * 0.8);
        f.px(x, y, fern[1]);
        if (j % 2 === 0) {
          f.px(x - 1, y + 1, fern[2]);
          f.px(x + 1, y + 1, fern[2]);
        }
      }
    }
  }

  private paintGrass(f: Frame, sky: Sky, i: Input) {
    const g = new Material(sky.grass).tones(sky);
    const flowers = [CLOVER, DAISY, BUTTERCUP, CORNFLOWER].map((m) => m.tones(sky)[3]);
    for (const b of this.blades) {
      const base = this.gy[b.x];
      let lean = wind(b.x, i.t, this.W) * (b.h / 3.2);
      if (i.pointer && Math.abs(i.py - base) < 18) {
        const dx = b.x - i.px;
        if (Math.abs(dx) < 10) lean += Math.sign(dx || 1) * (10 - Math.abs(dx)) * 0.3;
      }
      for (let j = 0; j < b.h; j++) {
        const k = j / b.h;
        const x = Math.round(b.x + lean * k * k);
        f.px(x, base - j, g[j === b.h - 1 ? 3 : b.tone]);
      }
      if (b.flower !== undefined) f.px(Math.round(b.x + lean), base - b.h, flowers[b.flower]);
    }
  }
}

/* --------------------------------------------------------- the tree wall */

/**
 * The wall of trunks between two clearings. `p` runs 0..1 across the scroll
 * between clearings: every rank of trunks enters from the right edge exactly
 * at p = 0 and has left past the left edge exactly at p = 1, so nothing ever
 * appears or vanishes inside the frame. The two clearings swap along the
 * middle of the wall, always hidden behind its densest trunks.
 */
const WALL = 1.5; // base wall width, in frame widths
const RAMP = 0.35; // thinning at each ragged end, in frame widths
const RANKS = [
  // Far trunks: thin, hazed into the forest's depth, slower.
  { speed: 0.8, shade: 0.45, ink: 0.1, wMin: 3, wFrac: 0.03, gap: 5, keep: 1.4, rim: false },
  // Middle trunks.
  { speed: 1, shade: 0.2, ink: 0.25, wMin: 6, wFrac: 0.05, gap: 7, keep: 1.25, rim: false },
  // Near trunks: wide and dark, faster; only these catch a thin rim of light.
  { speed: 1.25, shade: 0, ink: 0.5, wMin: 12, wFrac: 0.09, gap: 26, keep: 0.9, rim: true },
];

interface Trunk {
  u: number;
  w: number;
  stub: null | { y: number; dir: number; len: number };
  flare: number;
}

/** Trunk layouts are made once per wall and frame size, never re-rolled while scrolling. */
const trunkCache = new Map<string, Trunk[][]>();

function trunksFor(seed: number, W: number, H: number): Trunk[][] {
  const key = `${seed}:${W}:${H}`;
  const hit = trunkCache.get(key);
  if (hit) return hit;
  const ranks = RANKS.map((rk, ri) => {
    const r = rng(seed * 131 + ri * 17 + 7);
    const width = W * WALL * rk.speed;
    const ramp = W * RAMP * rk.speed;
    const density = (u: number) => Math.max(0, Math.min(1, Math.min(u, width - u) / ramp));
    const out: Trunk[] = [];
    for (let u = 0; u < width; ) {
      // Every trunk draws the same number of random values, kept or not.
      const w = Math.round(rk.wMin + r() * W * rk.wFrac);
      const gapR = r();
      const keepR = r();
      const stubR = r();
      const stubY = r();
      const stubDir = r();
      const stubLen = r();
      const gap = Math.round(2 + gapR * rk.gap * (1.3 - density(u)));
      if (keepR < density(u + w / 2) * rk.keep) {
        out.push({
          u,
          w,
          flare: ri === 2 ? 5 : 2,
          stub: stubR < 0.4 ? { y: Math.round(H * (0.25 + stubY * 0.4)), dir: stubDir < 0.5 ? -1 : 1, len: 3 + Math.round(stubLen * w * 0.5) } : null,
        });
      }
      u += w + gap;
    }
    return out;
  });
  if (trunkCache.size > 24) trunkCache.clear();
  trunkCache.set(key, ranks);
  return ranks;
}

/** Where the (middle rank of the) wall stands on screen at progress p. */
export function wallSpan(W: number, p: number): { left: number; mid: number; right: number } {
  const width = W * WALL;
  const left = W - p * (W + width);
  return { left, mid: left + width / 2, right: left + width };
}

const WALL_BARK = new Material(hex('#4a3a2c'));
const WALL_LEAF = new Material(hex('#27462a'));

export function paintWall(f: Frame, sky: Sky, p: number, seed: number, sunX: number) {
  const { w: W, h: H } = f;
  const span = wallSpan(W, p);
  const width = span.right - span.left;
  const ramp = W * RAMP;
  const density = (u: number) => Math.max(0, Math.min(1, Math.min(u, width - u) / ramp));
  const sunSide = sunX > W / 2 ? 1 : -1;
  const barkBase = WALL_BARK.tones(sky);
  const deepLeaf = WALL_LEAF.tones(sky);

  // The forest's depth where the wall is dense. The dither is anchored to the
  // wall itself (not the screen), so it travels with the trees instead of crawling.
  const depthC = mix(mix(sky.shade, sky.ink, 0.35), [30, 46, 34], 0.25);
  const depthDark = mix(depthC, sky.ink, 0.45);
  const offset = Math.floor(span.left);
  for (let x = 0; x < W; x++) {
    const u = x - offset;
    if (u < 0 || u > width) continue;
    const d = density(u);
    if (d < 0.55) continue;
    const k = Math.min(1, (d - 0.55) / 0.4);
    for (let y = 0; y < H; y++) {
      if (bayer(u, y) / 16 >= k) continue;
      const v = y / H;
      f.px(x, y, pack(v < 0.55 ? depthC : mix(depthC, depthDark, (v - 0.55) * 2.2)));
    }
  }

  const ranks = trunksFor(seed, W, H);
  RANKS.forEach((rk, ri) => {
    const tones = hazeTones(hazeTones(barkBase, sky.shade, rk.shade), sky.ink, rk.ink);
    // A soft rim: bark lit by the glow, not a white line, so passing trunks never strobe.
    tones[4] = pack(mix(unpack(tones[3]), sky.glow, 0.45));
    const widthR = W * WALL * rk.speed;
    // Roots and branch stubs reach up to PAD pixels beyond a trunk, so each
    // rank starts and ends its run that far outside the frame.
    const PAD = 24 + Math.ceil(W * 0.06);
    const left = Math.floor(W + PAD - p * (W + widthR + PAD * 2));
    for (const t of ranks[ri]) {
      const x = left + Math.round(t.u);
      if (x + t.w + 8 < 0 || x - 8 > W) continue;
      trunk(f, x, t.w, 0, H, tones, sunSide, seed + ri * 1000 + Math.round(t.u), { rim: rk.rim, flare: t.flare });
      if (t.stub) {
        for (let k = 0; k < t.stub.len; k++) f.px(t.stub.dir > 0 ? x + t.w + k : x - 1 - k, t.stub.y - Math.round(k * 0.6), tones[k === 0 ? 1 : 2]);
      }
    }
  });

  // The canopy closing overhead, and ferns at the trunks' feet, both in wall space.
  const leafTones = [pack(mix(unpack(deepLeaf[0]), sky.ink, 0.3)), deepLeaf[0], deepLeaf[1], deepLeaf[2]];
  for (let x = 0; x < W; x++) {
    const u = x - offset;
    if (u < 0 || u > width) continue;
    const d = density(u);
    const depth = H * (0.06 + d * 0.2) + noise1(u * 0.09, seed) * H * 0.08;
    for (let y = 0; y < depth + 3; y++) {
      const edge = depth - y;
      if (edge < 3 && bayer(u, y) / 16 > edge / 3) continue;
      const clump = noise2(u * 0.22, y * 0.3, seed + 3);
      const t = edge < 4 && clump > 0.55 ? 3 : clump > 0.7 ? 2 : y < depth * 0.5 ? 0 : 1;
      f.px(x, y, leafTones[t]);
    }
    const fern = Math.round(H * 0.05 * d + noise1(u * 0.2, seed + 5) * H * 0.05 * d);
    for (let y = H - fern; y < H; y++) if (bayer(u, y) < 12) f.px(x, y, leafTones[(u + y) % 5 === 0 ? 2 : 1]);
  }
}
