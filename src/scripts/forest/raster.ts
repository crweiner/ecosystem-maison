/**
 * A tiny software rasterizer over one Uint32 pixel buffer. Everything the
 * forest draws goes through here at the world's own resolution, with no
 * anti-aliasing and no fractional pixels; the browser scales the result up
 * by a whole number with `image-rendering: pixelated`.
 */

export class Frame {
  buf: Uint32Array;
  constructor(
    public w: number,
    public h: number,
  ) {
    this.buf = new Uint32Array(w * h);
  }

  px(x: number, y: number, c: number): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf[y * this.w + x] = c;
  }

  get(x: number, y: number): number {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.buf[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    // Nothing to draw once clipped. Without this, an empty span on the first row
    // hands fill() a negative end, which it reads as "from the end of the buffer",
    // and the whole frame is repainted in one colour.
    if (!(x1 > x0 && y1 > y0)) return;
    for (let j = y0; j < y1; j++) this.buf.fill(c, j * this.w + x0, j * this.w + x1);
  }

  hline(x0: number, x1: number, y: number, c: number): void {
    this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, c);
  }

  vline(x: number, y0: number, y1: number, c: number): void {
    this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, c);
  }

  /** Bresenham line, one pixel wide. */
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 4096; guard++) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /**
   * Filled ellipse. `shade(dx, dy)` picks the colour per pixel from its
   * offset to the centre (normalised -1..1), so volumes get lit and rim edges.
   */
  ellipse(cx: number, cy: number, rx: number, ry: number, shade: (nx: number, ny: number) => number): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.px(x, y, shade(nx, ny));
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: number): void {
    this.ellipse(cx, cy, r, r, () => c);
  }

  /** Draw an indexed sprite. Index 0 is transparent; 1..n map to `colors`. */
  sprite(s: Sprite, x: number, y: number, colors: number[], flip = false): void {
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < s.h; j++) {
      for (let i = 0; i < s.w; i++) {
        const v = s.data[j * s.w + i];
        if (v) this.px(flip ? x + s.w - 1 - i : x + i, y + j, colors[v - 1]);
      }
    }
  }

  /** Copy a region of another frame (same size) where it is not transparent. */
  over(src: Frame, x0 = 0, x1 = this.w): void {
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
        const v = src.buf[row + x];
        if (v) this.buf[row + x] = v;
      }
    }
  }
}

export interface Sprite {
  w: number;
  h: number;
  data: Uint8Array;
}

/**
 * Parse a sprite drawn as text. Each row is a string; `.` is transparent and
 * each other character maps through `key` to a colour index (1-based).
 */
export function sprite(rows: string[], key: Record<string, number>): Sprite {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const data = new Uint8Array(w * h);
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch !== '.' && ch !== ' ') data[j * w + i] = key[ch] ?? 0;
    }
  });
  return { w, h, data };
}
