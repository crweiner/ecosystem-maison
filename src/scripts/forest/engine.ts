/**
 * The forest engine: one fixed canvas behind the page.
 *
 * The world is rendered at a low resolution (about 150 pixels tall on landscape
 * screens) and scaled up by a whole number with nearest-neighbour sampling, so
 * a pixel is always a crisp square: 3 CSS px on a small phone, 7 on a 32:9
 * monitor. Scrolling walks the visitor through the day: each section of the
 * page names a clearing and its hour, and between clearings a wall of trunks
 * passes across the frame while the next clearing swaps in behind it.
 */
import { bayer, noise2, skyAt, type RGB, type Sky } from './color';
import { Frame } from './raster';
import { ForestScene, paintWall, wallSpan, type Input, type Layout } from './scenes';
import type { Scene } from '../../data/products';

interface Section {
  el: HTMLElement;
  kind: 'scene' | 'trees';
  spec?: Scene;
  copy?: HTMLElement | null;
  scene?: ForestScene;
  bg?: Frame;
  bgHour?: number;
  top: number;
  height: number;
}

export interface ForestOptions {
  /** Called with the current hour of the forest's day as the visitor scrolls. */
  onHour?: (hour: number) => void;
}

export interface ForestController {
  /** Send the deer in this section running off to the right. */
  run(section: HTMLElement): Promise<void>;
  /** Re-read the page layout (after fonts load, for instance) and redraw. */
  refresh(): void;
  reset(): void;
  destroy(): void;
}

/** The world's pixel size in CSS px for a viewport: about 150 world pixels tall. */
export function pixelUnit(vw: number, vh: number): number {
  const byHeight = Math.round(vh / 150);
  // Narrow screens (phones upright): keep at least ~110 pixels of width in the world.
  const byWidth = Math.floor(vw / 110);
  return Math.max(2, Math.min(10, Math.min(byHeight, byWidth)));
}

export function startForest(canvas: HTMLCanvasElement, sectionEls: HTMLElement[], opts: ForestOptions = {}): ForestController {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas unavailable');
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let U = 4;
  let W = 0;
  let H = 0;
  let vw = 0;
  let vh = 0;
  let image: ImageData;
  let frame: Frame;
  let spare: Frame;
  const sections: Section[] = sectionEls.map((el) => ({
    el,
    kind: el.dataset.forest === 'trees' ? 'trees' : 'scene',
    spec: el.dataset.scene ? (JSON.parse(el.dataset.scene) as Scene) : undefined,
    copy: el.querySelector<HTMLElement>('[data-copy]'),
    top: 0,
    height: 0,
  }));
  const skies = new Map<number, Sky>();
  const input: Input = { t: 0, dt: 0, px: -999, py: -999, pointer: false, reduced: reduce.matches };
  let lastPointer = -1e9;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let running = true;
  let lastHour = -1;
  let active: ForestScene[] = [];
  let dirty = false;

  function skyFor(hour: number): Sky {
    const q = Math.round(hour * 20) / 20;
    let s = skies.get(q);
    if (!s) {
      if (skies.size > 40) skies.clear();
      s = skyAt(q);
      skies.set(q, s);
    }
    return s;
  }

  /** Read where the words sit and lay each clearing out around them. */
  function layoutFor(sec: Section): Layout {
    const r = sec.el.getBoundingClientRect();
    const c = sec.copy?.getBoundingClientRect();
    let textSide: Layout['textSide'] = 'left';
    // Each clearing has its own camera height: low for the flowers (more sky),
    // high for the falls, so no two stops share one backdrop.
    const lift: Record<string, number> = { meadow: 0, beavers: -0.03, squirrels: 0.07, bear: -0.05, hummingbird: 0.09, web: 0.04, bees: 0.02, fireflies: 0.05 };
    let groundY = Math.round(H * (0.78 + (lift[sec.spec?.kind ?? 'meadow'] ?? 0)));
    let stageX = Math.round(W * 0.66);
    let stageW = Math.round(W * 0.6);
    if (c) {
      const x0 = c.left / U;
      const x1 = c.right / U;
      const y0 = (c.top - r.top) / U;
      const centred = c.left < vw * 0.42 && c.right > vw * 0.58;
      if (centred || c.width > vw * 0.72) {
        textSide = 'bottom';
        groundY = Math.round(Math.max(H * 0.36, Math.min(H * 0.64, y0 - 8)));
        stageX = Math.round(W / 2);
        stageW = W;
      } else if ((c.left + c.right) / 2 < vw / 2) {
        textSide = 'left';
        stageW = Math.max(40, Math.round(W - x1 - 4));
        stageX = Math.round(x1 + 4 + stageW / 2);
      } else {
        textSide = 'right';
        stageW = Math.max(40, Math.round(x0 - 4));
        stageX = Math.round(stageW / 2);
      }
    }
    return { W, H, groundY, stageX, stageW, textSide };
  }

  function measure() {
    for (const s of sections) {
      const r = s.el.getBoundingClientRect();
      s.top = r.top + window.scrollY;
      s.height = r.height;
    }
  }

  function build() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    U = pixelUnit(vw, vh);
    W = Math.ceil(vw / U);
    H = Math.ceil(vh / U);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * U}px`;
    canvas.style.height = `${H * U}px`;
    root.style.setProperty('--px', `${U}px`);
    image = ctx!.createImageData(W, H);
    frame = new Frame(W, H);
    frame.buf = new Uint32Array(image.data.buffer);
    spare = new Frame(W, H);
    measure();
    for (const s of sections) {
      if (s.kind !== 'scene' || !s.spec) continue;
      s.scene = new ForestScene(s.spec, layoutFor(s));
      s.bg = new Frame(W, H);
      s.bgHour = undefined;
    }
    render(true);
  }

  /** Which clearing (or pair of clearings, mid-wall) the viewport is in. */
  function locate(): { a: Section; b?: Section; p: number; hour: number } {
    const y = window.scrollY + vh / 2;
    let i = 0;
    while (i < sections.length - 1 && y >= sections[i + 1].top) i++;
    const s = sections[i];
    if (s.kind === 'scene') return { a: s, p: 0, hour: s.spec!.hour };
    const prev = sections.slice(0, i).reverse().find((x) => x.kind === 'scene') ?? sections.find((x) => x.kind === 'scene')!;
    const next = sections.slice(i + 1).find((x) => x.kind === 'scene') ?? prev;
    const p = Math.max(0, Math.min(1, (y - s.top) / Math.max(1, s.height)));
    return { a: prev, b: next, p, hour: prev.spec!.hour + (next.spec!.hour - prev.spec!.hour) * p };
  }

  function ensureBg(s: Section, sky: Sky, hour: number) {
    const q = Math.round(hour * 20) / 20;
    if (s.bgHour === q) return;
    s.scene!.paintStatic(s.bg!, sky, q);
    s.bgHour = q;
  }

  /** Darken the world behind the words: a dithered shade that follows the copy. */
  function shade(ink: RGB) {
    const levels = [0, 0.12, 0.24, 0.36, 0.47, 0.56, 0.62];
    for (const s of sections) {
      if (!s.copy) continue;
      const c = s.copy.getBoundingClientRect();
      if (c.bottom < -40 || c.top > vh + 40) continue;
      const x0 = c.left / U;
      const x1 = c.right / U;
      const y0 = c.top / U;
      // Shade pools around the words: a long dithered falloff sideways and
      // above and below the copy, so the sky beyond it is left whole.
      // Stacked layouts: the forest floor darkens from just above the copy.
      const y1 = c.bottom / U;
      const fadeX = Math.max(18, W * 0.2);
      const fadeY = Math.max(16, H * 0.22);
      const side = s.scene?.L.textSide ?? 'left';
      const bx0 = side === 'right' ? Math.floor(x0 - fadeX) : 0;
      const bx1 = side === 'left' ? Math.ceil(x1 + fadeX) : W;
      const by0 = Math.max(0, Math.floor(y0 - fadeY - 4));
      const by1 = side === 'bottom' ? H : Math.min(H, Math.ceil(y1 + fadeY + 4));
      for (let y = by0; y < by1; y++) {
        const row = y * W;
        for (let x = Math.max(0, bx0); x < Math.min(W, bx1); x++) {
          // A rounded pool of shade, its edge broken by noise like the shadow of a canopy.
          let dx = 0;
          if (side === 'left' && x > x1 - 6) dx = (x - x1 + 6) / fadeX;
          else if (side === 'right' && x < x0 + 6) dx = (x0 + 6 - x) / fadeX;
          let dy = 0;
          if (y < y0 - 2) dy = (y0 - 2 - y) / fadeY;
          else if (side !== 'bottom' && y > y1 + 2) dy = (y - y1 - 2) / fadeY;
          const ragged = (noise2(x * 0.09, y * 0.09, 17) - 0.5) * 0.45;
          const d = Math.sqrt(dx * dx + dy * dy) + ragged;
          const hx = Math.max(0, 1 - d) ** 1.3;
          const hy = 1;
          const k = hx * hy * (levels.length - 1);
          const lv = Math.min(levels.length - 1, Math.floor(k + bayer(x, y) / 16));
          if (lv <= 0) continue;
          const p = frame.buf[row + x];
          const t = levels[lv];
          const r = p & 255;
          const g = (p >> 8) & 255;
          const b = (p >> 16) & 255;
          frame.buf[row + x] =
            (0xff000000 | (Math.round(b + (ink[2] - b) * t) << 16) | (Math.round(g + (ink[1] - g) * t) << 8) | Math.round(r + (ink[0] - r) * t)) >>> 0;
        }
      }
    }
  }

  function render(force = false) {
    const where = locate();
    const sky = skyFor(where.hour);
    const hour = Math.round(where.hour * 20) / 20;
    if (hour !== lastHour || force) {
      lastHour = hour;
      opts.onHour?.(where.hour);
    }
    const reduced = reduce.matches;
    const a = where.a;
    const b = where.b && where.b !== a ? where.b : undefined;
    active = [a.scene!, ...(b ? [b.scene!] : [])];
    ensureBg(a, sky, where.hour);
    if (b) ensureBg(b, sky, where.hour);

    if (!b) {
      a.scene!.paint(frame, a.bg!, sky, input);
    } else if (reduced) {
      // Reduced motion: no wall, a clean cut halfway between clearings.
      const s = where.p < 0.5 ? a : b;
      s.scene!.paint(frame, s.bg!, sky, input);
    } else {
      const span = wallSpan(W, where.p);
      a.scene!.paint(frame, a.bg!, sky, input);
      if (span.mid < W) {
        b.scene!.paint(spare, b.bg!, sky, input);
        const from = Math.max(0, Math.floor(span.mid));
        for (let y = 0; y < H; y++) {
          const row = y * W;
          frame.buf.set(spare.buf.subarray(row + from, row + W), row + from);
        }
      }
      paintWall(frame, sky, where.p, (a.spec?.seed ?? 1) + (b.spec?.seed ?? 2), a.scene!.sunX);
    }
    shade(sky.ink);
    ctx!.putImageData(image, 0, 0);
  }

  function tick(now: number) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    // The world moves at a steady 24 frames a second, like hand-drawn animation.
    if (acc >= 1 / 24) {
      input.dt = acc;
      input.t += acc;
      acc = 0;
      input.pointer = now - lastPointer < 2500;
      for (const s of active) s.update(input);
      render();
      dirty = false;
    } else if (dirty) {
      // Scrolling moves the wall and the sky at the display's own rate.
      render();
      dirty = false;
    }
    schedule();
  }

  function schedule() {
    if (!raf && running && !reduce.matches && !document.hidden) raf = requestAnimationFrame(tick);
  }

  const onScroll = () => {
    if (reduce.matches || !raf) render();
    else dirty = true;
  };
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Phone address bars nudge the height as you scroll; only rebuild for real changes.
      if (w === vw && Math.abs(h - vh) / vh < 0.12) {
        measure();
        render(true);
        return;
      }
      build();
    }, 120);
  };
  const onPointer = (e: PointerEvent) => {
    input.px = e.clientX / U;
    input.py = e.clientY / U;
    lastPointer = performance.now();
  };
  const onVisibility = () => {
    last = performance.now();
    schedule();
  };
  const onMotion = () => {
    input.reduced = reduce.matches;
    render(true);
    schedule();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  reduce.addEventListener('change', onMotion);
  const ro = new ResizeObserver(() => measure());
  ro.observe(document.body);

  build();
  schedule();

  return {
    run(sectionEl) {
      const sec = sections.find((s) => s.el === sectionEl);
      if (!sec?.scene || reduce.matches || !active.includes(sec.scene)) return Promise.resolve();
      return sec.scene.run();
    },
    refresh() {
      build();
    },
    reset() {
      for (const s of sections) s.scene?.reset();
      render(true);
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      reduce.removeEventListener('change', onMotion);
      ro.disconnect();
    },
  };
}

