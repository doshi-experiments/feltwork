/* Bakes the felt tile: tex/felt-1024.png
 *
 * One seamless, tileable 1024px fractal-noise tile — desaturated, mid-grey,
 * ~14% contrast range. This one file unifies the whole system: the headline
 * fallback clips it into text, and every isometric face overlays it at 7%.
 * Type and objects reading as the same material is the entire point.
 *
 * Baked once and committed. Never run feTurbulence at runtime for something
 * you can bake.
 *
 * No dependencies — there is no image library on this machine, so this
 * writes the PNG itself with node:zlib. Greyscale, 8-bit, filter 0.
 *
 *   node scripts/bake-texture.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const MID = 128;      // mid-grey
const RANGE = 0.14;   // ±7% around mid → the 14% contrast range
const SEED = 7;       // same seed as the headline filter's fibers

/* ── deterministic RNG, so a rebuild is byte-identical ─────────────────── */
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* ── tileable value noise ───────────────────────────────────────────────
   A lattice of `period` × `period` random values, sampled with a smoothstep
   and wrapped with `% period`. Wrapping is what makes it seam-free: the
   right edge interpolates back into the left. */
const smooth = (t) => t * t * (3 - 2 * t);

function lattice(period, rnd) {
  const g = new Float64Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return g;
}

function sample(g, period, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const a = g[y0 * period + x0], b = g[y0 * period + x1];
  const c = g[y1 * period + x0], d = g[y1 * period + x1];
  return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf;
}

/* Fractal sum. Every period divides SIZE, so every octave tiles.
 *
 * `period` is the lattice resolution, so period 256 over a 1024px tile means
 * 4px features. The finest octave is deliberately 4px and not 1–2px: the tile
 * is drawn at background-size 340px, a ~3x downscale, so anything finer than
 * ~3px aliases into mush that nobody sees and that costs a lot of entropy —
 * a per-pixel octave alone doubled the file. Felt nap is fine, not cloudy,
 * but it still has to survive the downscale. */
const OCTAVES = [
  { period: 256, amp: 1.00 },
  { period: 128, amp: 0.60 },
  { period: 64,  amp: 0.34 },
  { period: 32,  amp: 0.18 },
];

const rnd = mulberry32(SEED);
const grids = OCTAVES.map((o) => lattice(o.period, rnd));
const totalAmp = OCTAVES.reduce((s, o) => s + o.amp, 0);

const px = new Uint8Array(SIZE * SIZE);
let lo = Infinity, hi = -Infinity;
const raw = new Float64Array(SIZE * SIZE);

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let v = 0;
    for (let i = 0; i < OCTAVES.length; i++) {
      const { period, amp } = OCTAVES[i];
      const s = period / SIZE;
      v += sample(grids[i], period, x * s, y * s) * amp;
    }
    v /= totalAmp;
    raw[y * SIZE + x] = v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
}

/* Normalise to 0..1, then compress into the narrow band around mid-grey.
   A wide-contrast tile would fight the ramps instead of texturing them.
 *
 * Then quantise to LEVELS distinct values inside that band. The band is only
 * ~36 greys wide to begin with, so 16 of them are ~2.4 apart — invisible at
 * the 7% overlay opacity the faces use, and still smooth clipped into text.
 * Dropping the per-pixel entropy from ~5.2 bits to 4 is what makes the tile
 * shippable: it is the difference between a 322 KB and a ~90 KB file on every
 * page of every site. */
const LEVELS = 16;

for (let i = 0; i < raw.length; i++) {
  const n = (raw[i] - lo) / (hi - lo);
  const q = Math.round(n * (LEVELS - 1)) / (LEVELS - 1);
  px[i] = Math.max(0, Math.min(255, Math.round(MID + (q - 0.5) * RANGE * 255)));
}

/* ── PNG encoder (greyscale, 8-bit, no filtering) ──────────────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 0;   // colour type 0 = greyscale
ihdr[10] = 0;  // deflate
ihdr[11] = 0;  // adaptive filtering
ihdr[12] = 0;  // no interlace

/* Filter 0 (None) on every scanline.
 *
 * This is deliberate and measured, not laziness. Delta filtering normally
 * helps photographic data, but after quantisation this tile holds only 16
 * distinct byte values, so deflate's Huffman stage codes them directly at
 * ~4 bits each. Filtering re-expands that into a wider spread of deltas and
 * makes the file BIGGER. Measured at 1024px:
 *
 *     None 257 KB · Sub 275 · Up 291 · Average 382 · Paeth 273
 *
 * so an adaptive per-row heuristic (which lands on Paeth) is 6% worse than
 * simply not filtering. */
const rows = Buffer.alloc(SIZE * (SIZE + 1));
for (let y = 0; y < SIZE; y++) {
  rows[y * (SIZE + 1)] = 0;
  Buffer.from(px.buffer, y * SIZE, SIZE).copy(rows, y * (SIZE + 1) + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(rows, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "tex", "felt-1024.png");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);

let min = 255, max = 0;
for (let i = 0; i < px.length; i++) { if (px[i] < min) min = px[i]; if (px[i] > max) max = px[i]; }

console.log(
  `felt-1024.png  ${SIZE}x${SIZE}  ${(png.length / 1024).toFixed(1)} KB  ` +
  `levels ${min}–${max} (mid ${MID}, range ${RANGE * 100}%)`
);
