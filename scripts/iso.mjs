/* True-isometric geometry for the §6 icon system.
 *
 * §6 says pick ONE projection and use it everywhere. This is it:
 *
 *     screenX = (x - z) * cos30
 *     screenY = (x + z) * 0.5 - y          (y is up)
 *
 * which is the same 30° isometric as the brief's
 * matrix(0.866,0.5,-0.866,0.5,0,0) and CSS's rotateX(54.736) rotateZ(45),
 * just expressed as vertices so shapes can be built from solids instead of
 * hand-authored paths. The portfolio already builds its Bauhaus model from a
 * box factory; this is the same idea under a different projection, so Phase E
 * has something to port onto.
 *
 * Viewer sits at +x +y +z. Three faces are therefore visible on any box, and
 * §6 fixes their shading as a table lookup — never computed, never a
 * brightness() filter:
 *
 *     top   (y max) → --{hue}-light
 *     left  (z max) → --{hue}          base
 *     right (x max) → --{hue}-shadow
 *
 * That mapping encodes the one global light (upper-left, 55°) and is not
 * adjustable per icon.
 */

export const COS30 = Math.cos(Math.PI / 6);   // 0.8660254

export const iso = (x, y, z) => [ (x - z) * COS30, (x + z) * 0.5 - y ];

const pt = ([x, y]) => `${round(x)},${round(y)}`;
const round = (n) => Math.round(n * 1000) / 1000;
export const poly = (pts) => pts.map(pt).join(" ");

/* A box, as its three visible faces. Returns faces far-to-near so a plain
   painter's sort over `depth` gives correct occlusion without a z-buffer. */
export function box({ x, y, z, w, h, d, hue, id = "" }) {
  const x1 = x + w, y1 = y + h, z1 = z + d;
  return [
    { // right — the x-max face
      key: `${id}r`, hue, tone: "shadow", depth: x1 + y + z,
      points: poly([iso(x1, y, z), iso(x1, y, z1), iso(x1, y1, z1), iso(x1, y1, z)]),
    },
    { // left — the z-max face
      key: `${id}l`, hue, tone: "base", depth: x + y + z1,
      points: poly([iso(x, y, z1), iso(x1, y, z1), iso(x1, y1, z1), iso(x, y1, z1)]),
    },
    { // top — the y-max face
      key: `${id}t`, hue, tone: "light", depth: x + y1 + z,
      points: poly([iso(x, y1, z), iso(x1, y1, z), iso(x1, y1, z1), iso(x, y1, z1)]),
    },
  ];
}

/* A square pyramid — the rocket's nose. Only two of its four sides are ever
   visible from this viewpoint, and they take the same left/right tones as a
   box so the light source stays consistent across primitives. */
export function pyramid({ x, y, z, w, h, d, hue, id = "" }) {
  const x1 = x + w, z1 = z + d, y1 = y + h;
  const apex = iso(x + w / 2, y1, z + d / 2);
  return [
    { key: `${id}pr`, hue, tone: "shadow", depth: x1 + y + z + 0.5,
      points: poly([iso(x1, y, z), iso(x1, y, z1), apex]) },
    { key: `${id}pl`, hue, tone: "base", depth: x + y + z1 + 0.5,
      points: poly([iso(x, y, z1), iso(x1, y, z1), apex]) },
  ];
}

/* Places 2D detail flat ON a face, so a circle drawn in local coordinates
   comes out as the correctly skewed ellipse instead of a screen-space circle
   pasted over a solid. Derived from the projection above by differentiating:
   on the z-max face, dX/dx = cos30, dY/dx = 0.5, dY/dy = -1. */
export const faceTransform = {
  left: (z1) => `matrix(${round(COS30)},0.5,0,-1,${round(-z1 * COS30)},${round(z1 * 0.5)})`,
  right: (x1) => `matrix(${round(-COS30)},0.5,0,-1,${round(x1 * COS30)},${round(x1 * 0.5)})`,
};

/* Painter's algorithm. Nothing here needs a real depth buffer — every icon is
   a handful of convex solids. */
export const sortFaces = (faces) => [...faces].sort((a, b) => a.depth - b.depth);

export const bounds = (faces) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of faces) {
    for (const p of f.points.split(" ")) {
      const [px, py] = p.split(",").map(Number);
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
};
