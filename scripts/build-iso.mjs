/* Builds the §6 isometric icons into src/iso/*.svg.
 *
 * The four source objects, rendered under felt physics rather than the usual
 * flat-iso illustration conventions. §6's five rules, and where each lands:
 *
 *   1. No sharp edges. Every face is stroked in its OWN fill colour at
 *      stroke-width 10, linejoin round, paint-order "stroke fill". That
 *      inflates the polygon by half the stroke and rounds every corner, which
 *      is what makes a cube read as stuffed rather than machined.
 *   2. No specular. Felt is matte — zero gloss, zero rim-light. The only
 *      brightening permitted is a 1.5px fiber-catch line along the top-left
 *      edge at --{hue}-hi.
 *   3. Grain on every face, from the same baked tile the headlines use. That
 *      shared tile is what makes the type and the objects read as one
 *      material rather than two.
 *   4. Contact shadow only. A soft ellipse directly beneath, --ink at 9%.
 *      Nothing casts a long shadow.
 *   5. Chunky proportions. Anything smaller than 1/12 of the bounding box is
 *      deleted rather than drawn.
 *
 * Deliberately not Three.js: a personal site does not need a WebGL runtime to
 * draw four objects, and the restraint is the point.
 *
 * THESE MUST BE INLINED, never referenced with <img src>. §6 says "inline SVG
 * components with a shared <defs>" and that is not a stylistic preference: an
 * SVG loaded through <img> is an isolated document with no access to the host
 * page's custom properties, so every var(--canary-light) resolves to nothing
 * and the whole object renders BLACK — which is both wrong and a §12
 * violation. Inlining is what makes the ramp tokens reach the faces, and it is
 * also what lets one page share a single <defs>.
 *
 *   node scripts/build-iso.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { box, pyramid, sortFaces, bounds, faceTransform, iso, COS30 } from "./iso.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "iso");

/* ── the objects ─────────────────────────────────────────────────────────
   Built from solids, chunky by construction. The rocket is the first one
   because canary is the most legible ramp to judge the shading against. */

const OBJECTS = {
  rocket: {
    hue: "canary",
    title: "Rocket",
    seam: true,          // §6 allows a stitched seam, rationed to twice a page
    solids: [
      /* Fins OVERLAP the body by 4 units. Butted up against it they read as
         two loose cubes parked either side of a tower — every face inflates
         by half the 10-unit stroke, so a fin that merely touches ends up
         visually detached. */
      { fn: box, x: 9, y: 0, z: -6, w: 20, h: 22, d: 12, id: "finR" },
      { fn: box, x: -6, y: 0, z: 9, w: 12, h: 22, d: 20, id: "finL" },
      // body
      { fn: box, x: -13, y: 0, z: -13, w: 26, h: 52, d: 26, id: "body" },
      // nose
      { fn: pyramid, x: -13, y: 52, z: -13, w: 26, h: 26, d: 26, id: "nose" },
    ],
    // a porthole, flat on the left face. 12 units across a ~95-unit bounding
    // box clears §6's 1/12 floor, so it stays.
    /* cy is a HEIGHT here, not an SVG y. faceTransform already carries the
       flip (dY/dy = -1), so local +y is up the object — a negative value
       drops the porthole through the floor. */
    detail: (o) =>
      `<g transform="${faceTransform.left(13)}">
      <ellipse cx="0" cy="34" rx="7.5" ry="7.5"
               fill="var(--${o.hue}-shadow)"
               stroke="var(--${o.hue}-shadow)" stroke-width="3"
               paint-order="stroke fill" opacity="0.85"/>
    </g>`,
  },

  /* Oxford — things written. The robot from the source photograph, holding
     the wooden pencil. */
  robot: {
    hue: "oxford",
    title: "Robot holding a pencil",
    solids: [
      { fn: box, x: -18, y: 0, z: -14, w: 36, h: 34, d: 28, id: "body" },
      { fn: box, x: -13, y: 34, z: -11, w: 26, h: 22, d: 22, id: "head" },
      { fn: box, x: -26, y: 6, z: -8, w: 10, h: 24, d: 16, id: "armL" },
      { fn: box, x: 16,  y: 6, z: -8, w: 10, h: 24, d: 16, id: "armR" },
      // the pencil, stood in the right hand
      { fn: box, x: 19, y: 26, z: -3, w: 6, h: 34, d: 6, hue: "pencil", flat: true, id: "pen" },
    ],
    // two eyes, flat on the face. 7 units across a ~120 box clears 1/12.
    detail: (o) =>
      `<g transform="${faceTransform.left(11)}">
      <ellipse cx="-6" cy="45" rx="3.4" ry="3.4" fill="var(--${o.hue}-shadow)"/>
      <ellipse cx="6"  cy="45" rx="3.4" ry="3.4" fill="var(--${o.hue}-shadow)"/>
    </g>`,
  },

  /* Eucalyptus — work, anything commercial. A stack of banknotes, offset so
     the stack reads as separate leaves rather than one slab. */
  cash: {
    hue: "euca",
    title: "Stack of banknotes",
    seam: false,
    solids: [
      { fn: box, x: -30, y: 0,  z: -20, w: 60, h: 7, d: 40, id: "n1" },
      { fn: box, x: -27, y: 7,  z: -23, w: 60, h: 7, d: 40, id: "n2" },
      { fn: box, x: -31, y: 14, z: -18, w: 60, h: 7, d: 40, id: "n3" },
      { fn: box, x: -28, y: 21, z: -21, w: 60, h: 7, d: 40, id: "n4" },
    ],
  },

  /* Blush — the workshop: experiments, tools, unfinished things. */
  laptop: {
    hue: "blush",
    title: "Laptop",
    solids: [
      /* Screen and keyboard want to read as roughly equal slabs, or the pair
         comes out looking like a low armchair rather than a laptop. */
      { fn: box, x: -34, y: 0, z: -26, w: 68, h: 5,  d: 52, id: "base" },
      { fn: box, x: -34, y: 5, z: -32, w: 68, h: 50, d: 6,  id: "lid" },
    ],
  },
};

/* ── emit ────────────────────────────────────────────────────────────────── */

const TONE_TOKEN = { light: "-light", base: "", shadow: "-shadow" };

function render(name, o) {
  /* A solid may carry its own hue. Only the robot's pencil uses this — it is
     the one unfelted material in the source photographs, and §2 reserves
     pencil for interaction, so it appears as an OBJECT here and never as a
     category or a surface. */
  /* A solid may carry its own hue, and may be `flat`.
     Only the robot's pencil uses either. The pencil is the one unfelted
     material in the source photographs — wood, not fabric — and it has a
     single measured value with no ramp behind it. Rather than fabricate two
     stops for it (§12: no invented tints, and §1: the colours are measured),
     it renders flat across all three faces. Losing the shading is the point:
     the one thing on the page that is not felt does not obey the felt
     lighting model, so it reads as a different substance. */
  const faces = sortFaces(o.solids.flatMap((s) => {
    const { fn, hue, flat, ...rest } = s;
    const out = fn({ ...rest, hue: hue || o.hue });
    return flat ? out.map((f) => ({ ...f, flat: true })) : out;
  }));

  const b = bounds(faces);
  const pad = 26;                     // room for the inflate + the shadow
  const vb = [b.minX - pad, b.minY - pad, b.w + pad * 2, b.h + pad * 2 + 10];

  /* Contact shadow: one soft ellipse where the object actually meets the
     floor, slightly wider than its footprint. --ink at 9%, blurred
     generously, and nothing longer than that — nothing here casts a long
     shadow.

     Derived from the GROUND-PLANE footprint (the solids' x/z extents at
     y = 0), not from the screen bounding box. The two are not the same: the
     silhouette's lowest pixel is a projected fin corner, well below where the
     object touches the floor, so anchoring to it leaves the shadow visibly
     detached and hanging in space. */
  const gx = [], gz = [];
  for (const s of o.solids) { gx.push(s.x, s.x + s.w); gz.push(s.z, s.z + s.d); }
  const x0 = Math.min(...gx), x1 = Math.max(...gx);
  const z0 = Math.min(...gz), z1 = Math.max(...gz);
  const corners = [iso(x0, 0, z0), iso(x1, 0, z0), iso(x1, 0, z1), iso(x0, 0, z1)];
  const cxs = corners.map((c) => c[0]), cys = corners.map((c) => c[1]);
  const shadow =
    `<ellipse cx="${round((Math.min(...cxs) + Math.max(...cxs)) / 2)}"
             cy="${round((Math.min(...cys) + Math.max(...cys)) / 2)}"
             rx="${round((Math.max(...cxs) - Math.min(...cxs)) / 2 + 7)}"
             ry="${round((Math.max(...cys) - Math.min(...cys)) / 2 + 4)}"
             fill="var(--ink)" opacity="0.09" filter="url(#fw-contact)"/>`;

  const facePaths = faces.map((f) => {
    const tok = `var(--${f.hue}${f.flat ? "" : TONE_TOKEN[f.tone]})`;
    return `<polygon points="${f.points}" fill="${tok}" stroke="${tok}"
             stroke-width="10" stroke-linejoin="round" paint-order="stroke fill"/>`;
  }).join("\n      ");

  /* Fiber catch: the one brightening §6 permits — where the nap catches the
     light along an edge. ONE edge per top face, the top-left one, and no
     more. Two edges chained together draw a visible chevron across the face,
     which is decoration rather than lighting, and §12 says anything you can
     remove without losing meaning goes.

     Top-face winding from box() is [back, right, front, left], so the
     top-left edge is back → left: points 0 → 3. */
  const catchLine = faces.filter((f) => f.tone === "light").map((f) => {
    const p = f.points.split(" ");
    return `<line x1="${p[0].split(",")[0]}" y1="${p[0].split(",")[1]}"
              x2="${p[3].split(",")[0]}" y2="${p[3].split(",")[1]}"
              stroke="var(--${o.hue}-hi)" stroke-width="1.5"
              stroke-linecap="round" opacity="0.55"/>`;
  }).join("\n      ");

  /* §6 stitching — suggests construction, which is Rams-honest. Becomes twee
     if repeated, so it is one edge on one object. */
  const seam = o.seam
    ? (() => {
        const f = faces.find((x) => x.key === "bodyl");
        const p = f.points.split(" ");
        return `<polyline points="${p[0]} ${p[3]}" fill="none"
              stroke="var(--${o.hue}-shadow)" stroke-width="2"
              stroke-dasharray="1 7" stroke-linecap="round" opacity="0.75"/>`;
      })()
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(round).join(" ")}"
     class="iso iso--${name}" role="img" aria-hidden="true" focusable="false">
  <title>${o.title}</title>
  <defs>
    <filter id="fw-contact" x="-60%" y="-140%" width="220%" height="380%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <clipPath id="fw-clip-${name}">
      ${faces.map((f) => `<polygon points="${f.points}"/>`).join("\n      ")}
    </clipPath>
  </defs>

  ${shadow}

  <g class="iso__body">
      ${facePaths}
      ${catchLine}
      ${seam}
      ${o.detail ? o.detail(o) : ""}
  </g>

  <!-- Grain, clipped to the silhouette. Same tile as the headlines: that is
       what makes the type and the objects one material.

       Root-relative on purpose. These icons are INLINED into a host page
       (see the note at the top of the file), so a path relative to this file
       would resolve against the page instead and 404. Every site serves the
       tile at /tex/. -->
  <g clip-path="url(#fw-clip-${name})" style="mix-blend-mode:overlay" opacity="0.07">
    <image href="/tex/felt-1024.png" x="${round(vb[0])}" y="${round(vb[1])}"
           width="${round(vb[2])}" height="${round(vb[3])}"
           preserveAspectRatio="xMidYMid slice"/>
  </g>
</svg>
`;
}

function round(n) { return Math.round(n * 1000) / 1000; }

mkdirSync(OUT, { recursive: true });
for (const [name, o] of Object.entries(OBJECTS)) {
  const svg = render(name, o);
  writeFileSync(join(OUT, `${name}.svg`), svg);
  console.log(`  src/iso/${name}.svg  ${(svg.length / 1024).toFixed(1)} KB  hue ${o.hue}`);
}
