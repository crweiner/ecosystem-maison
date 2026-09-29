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
import { skyAt, type Sky } from './color';
import { Frame } from './raster';
import { ForestScene, paintWall, wallCover, wallSpan, type Input, type Layout } from './scenes';
import { boardReach, entranceSign, kiosk } from './signs';
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
  let frame: Frame | undefined;
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
  const input: Input = { t: 0, dt: 0, px: -999, py: -999, pointer: false, reduced: reduce.matches, tap: null };
  /** Under reduced motion there is no loop; a tap still plays out briefly so it is acknowledged. */
  let burstUntil = 0;
  let down: { x: number; y: number; t: number; ui: boolean } | null = null;
  /** Words, controls and chrome belong to the page, not the forest. */
  const isUI = (el: EventTarget | null) =>
    el instanceof Element && !!el.closest('a, button, input, select, textarea, label, [data-copy], nav, .masthead, .whereabouts, .colophon');
  let lastPointer = -1e9;
  let raf = 0;
  /**
   * Idle cadence: after a few seconds without a scroll, a pointer or a tap the
   * forest keeps breathing at 8 frames a second and sleeps between frames on a
   * timer, instead of waking with every display refresh. Any activity snaps it
   * straight back to 24.
   */
  const IDLE_AFTER = 6000;
  let lastActivity = performance.now();
  let idleTimer = 0;
  const isIdle = () => performance.now() - Math.max(lastActivity, lastPointer) > IDLE_AFTER;
  function wake() {
    lastActivity = performance.now();
    if (idleTimer) {
      window.clearTimeout(idleTimer);
      idleTimer = 0;
      schedule();
    }
  }
  let last = performance.now();
  let acc = 0;
  let running = true;
  let lastHour = -1;
  let active: ForestScene[] = [];
  /** The clearing showing at a column of the last frame drawn, or null where the wall stands solid. */
  let sceneAt: (x: number) => ForestScene | null = () => null;
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
        // Stack the clearing above the whole sign (roof, pinned band and frame), not just the words.
        groundY = Math.round(Math.max(H * 0.36, Math.min(H * 0.64, y0 - boardReach(W, H) - 2)));
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

  /**
   * The tallest the viewport gets: phone browsers hide their toolbars as you
   * scroll, growing the viewport without a resize worth rebuilding for. The
   * world is sized to that large viewport so it always reaches the bottom edge.
   */
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  const largeHeight = () => Math.max(window.innerHeight, probe.getBoundingClientRect().height || 0);

  function build() {
    // A hidden tab, a collapsed frame or a rotation mid-flight can report no size;
    // wait for a real one rather than allocating an empty canvas.
    if (window.innerWidth < 1 || window.innerHeight < 1) return;
    vw = window.innerWidth;
    vh = window.innerHeight;
    const lh = largeHeight();
    U = pixelUnit(vw, vh);
    W = Math.ceil(vw / U);
    H = Math.ceil(lh / U);
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

  /**
   * Which clearing (or pair of clearings, mid-wall) the viewport is in. The
   * wall's passage spans the short treeline gap plus half a screen either
   * side, so it moves at a calm pace and is entirely off screen whenever a
   * clearing fills the frame.
   */
  function locate(): { a: Section; b?: Section; p: number; hour: number } {
    const y = window.scrollY + vh / 2;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (s.kind !== 'trees') continue;
      const start = s.top - vh / 2;
      const end = s.top + s.height + vh / 2;
      // Exclusive edges: at rest on a clearing, the wall has not begun.
      if (y <= start || y >= end) continue;
      const prev = sections.slice(0, i).reverse().find((x) => x.kind === 'scene') ?? sections.find((x) => x.kind === 'scene')!;
      const next = sections.slice(i + 1).find((x) => x.kind === 'scene') ?? prev;
      const p = Math.max(0, Math.min(1, (y - start) / Math.max(1, end - start)));
      return { a: prev, b: next, p, hour: prev.spec!.hour + (next.spec!.hour - prev.spec!.hour) * p };
    }
    let i = 0;
    while (i < sections.length - 1 && y >= sections[i + 1].top) i++;
    let s = sections[i];
    if (s.kind !== 'scene') s = sections.slice(0, i).reverse().find((x) => x.kind === 'scene') ?? sections[0];
    return { a: s, p: 0, hour: s.spec!.hour };
  }

  function ensureBg(s: Section, sky: Sky, hour: number) {
    const q = Math.round(hour * 20) / 20;
    if (s.bgHour === q) return;
    s.scene!.paintStatic(s.bg!, sky, q);
    s.bgHour = q;
  }

  /**
   * The words' signage: a carved entrance sign in the dawn and dusk meadows,
   * a trailhead kiosk at every clearing. Each is lit by its own clearing's
   * hour and drawn from the words' box, so it scrolls with them.
   */
  function boards(frame: Frame) {
    // While the deer runs, the words fade out; their boards step aside with them.
    if (root.classList.contains('is-wandering')) return;
    const reach = boardReach(W, H);
    for (const s of sections) {
      if (!s.copy || !s.spec || !s.scene) continue;
      const c = s.copy.getBoundingClientRect();
      // Words with no box (hidden, or not laid out yet) get no board.
      if (c.width < 1 || c.height < 1) continue;
      const spec = {
        x0: c.left / U,
        x1: c.right / U,
        y0: c.top / U,
        y1: c.bottom / U,
        side: s.scene.L.textSide,
        kind: s.spec.kind,
        sunSide: s.scene.sunSide,
        seed: s.spec.seed,
      };
      if (spec.y1 + reach < 0 || spec.y0 - reach > H + H) continue;
      const sky = skyFor(s.spec.hour);
      if (s.spec.kind === 'meadow') entranceSign(frame, sky, spec);
      else kiosk(frame, sky, spec);
    }
  }

  function render(force = false) {
    // Nothing to draw into until the viewport has had a real size.
    if (!frame) return;
    const where = locate();
    const hour = Math.round(where.hour * 20) / 20;
    if (hour !== lastHour || force) {
      lastHour = hour;
      opts.onHour?.(where.hour);
    }
    const reduced = reduce.matches;
    const a = where.a;
    const b = where.b && where.b !== a ? where.b : undefined;
    active = [a.scene!, ...(b ? [b.scene!] : [])];
    // Each clearing is always lit at its own hour: its backdrop is painted once
    // and never re-tinted while scrolling, so the frame cannot step or flicker.
    // Time passes behind the wall of trunks, where one clearing swaps for the next.
    const skyA = skyFor(a.spec!.hour);
    ensureBg(a, skyA, a.spec!.hour);
    const skyB = b ? skyFor(b.spec!.hour) : skyA;
    if (b) ensureBg(b, skyB, b.spec!.hour);
    let sky = skyA;

    if (!b) {
      const only = a.scene!;
      sceneAt = () => only;
      only.paint(frame, a.bg!, skyA, input);
    } else if (reduced) {
      // Reduced motion: no wall, a clean cut halfway between clearings.
      const s = where.p < 0.5 ? a : b;
      const shown = s.scene!;
      sceneAt = () => shown;
      sky = where.p < 0.5 ? skyA : skyB;
      shown.paint(frame, s.bg!, sky, input);
    } else {
      const cover = wallCover(W, where.p);
      const left = a.scene!;
      const right = b.scene!;
      sceneAt = (x) => (x < cover.x0 ? left : x > cover.x1 ? right : null);
      const span = wallSpan(W, where.p);
      a.scene!.paint(frame, a.bg!, skyA, input);
      if (span.mid < W) {
        b.scene!.paint(spare, b.bg!, skyB, input);
        const from = Math.max(0, Math.floor(span.mid));
        for (let y = 0; y < H; y++) {
          const row = y * W;
          frame.buf.set(spare.buf.subarray(row + from, row + W), row + from);
        }
      }
      // Only the moving trunks take the in-between hour, finely stepped.
      sky = skyAt(Math.round(where.hour * 100) / 100);
      paintWall(frame, sky, where.p, (a.spec?.seed ?? 1) + (b.spec?.seed ?? 2), a.scene!.sunX);
      if (span.mid < W / 2) sky = skyB;
    }
    boards(frame);
    ctx!.putImageData(image, 0, 0);
  }

  function tick(now: number) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    // The world moves at a steady 24 frames a second, like hand-drawn animation;
    // left alone, it slows to 8 to spare the battery.
    // (Idle ticks arrive on a ~8/s timer; every one of them paints.)
    const rate = isIdle() ? 8 : 24;
    if (acc >= (1 / rate) * 0.8) {
      input.dt = acc;
      input.t += acc;
      acc = 0;
      input.pointer = now - lastPointer < 2500;
      // A tap lands in whichever clearing shows where it falls; the wall's solid middle keeps it.
      const tap = input.tap;
      const tapped = tap ? sceneAt(tap.x) : null;
      for (const s of active) {
        input.tap = s === tapped ? tap : null;
        s.update(input);
      }
      input.tap = null;
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
    const allowed = !reduce.matches || performance.now() < burstUntil;
    if (raf || idleTimer || !running || !allowed || document.hidden) return;
    if (isIdle()) {
      idleTimer = window.setTimeout(() => {
        idleTimer = 0;
        raf = requestAnimationFrame(tick);
      }, 110);
    } else {
      raf = requestAnimationFrame(tick);
    }
  }

  const onScroll = () => {
    wake();
    if (reduce.matches || !raf) render();
    else dirty = true;
  };
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Phone address bars nudge the height as you scroll. The world already
      // covers the large viewport, so only a real change (rotation, window
      // resize) rebuilds; a toolbar just moves the scroll centre.
      if (w === vw && Math.abs(h - vh) / vh < 0.12) {
        vh = h;
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
    wake();
    // Say so with the cursor when the forest under a mouse would answer a click.
    if (e.pointerType === 'mouse') {
      const hot = !isUI(e.target) && !!sceneAt(input.px)?.hot(input.px, input.py);
      root.classList.toggle('forest-hot', hot);
    }
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
  // A tap is a press and release that barely moves: anything longer is a scroll or a drag.
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now(), ui: isUI(e.target) };
  };
  const onUp = (e: PointerEvent) => {
    const d = down;
    down = null;
    if (!d || d.ui || e.button > 0) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || performance.now() - d.t > 500) return;
    input.tap = { x: e.clientX / U, y: e.clientY / U };
    input.px = input.tap.x;
    input.py = input.tap.y;
    lastPointer = performance.now();
    if (reduce.matches) {
      burstUntil = performance.now() + 1400;
      last = performance.now();
    }
    wake();
    schedule();
  };
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
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
      wake();
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
      window.clearTimeout(idleTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      probe.remove();
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('visibilitychange', onVisibility);
      reduce.removeEventListener('change', onMotion);
      ro.disconnect();
    },
  };
}

