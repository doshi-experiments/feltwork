/* §12 — the parts of "done means" that are static facts about the source.
 * The browser-dependent ones live in scripts/check.mjs.
 *
 *   node scripts/audit.mjs [dir ...]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const targets = process.argv.slice(2).map((d) => join(process.cwd(), d));
const roots = targets.length ? targets : [join(ROOT, "src"), join(ROOT, "proof")];

const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    if (e === "node_modules" || e === "shots" || e.startsWith(".")) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ([".css", ".html", ".svg", ".js", ".jsx", ".mjs"].includes(extname(p))) out.push(p);
  }
  return out;
};

const files = roots.flatMap((r) => walk(r));
let pass = 0, fail = 0;
const ok = (name, bad, hint = "") => {
  if (!bad.length) { pass++; console.log("  pass  " + name); }
  else {
    fail++;
    console.log("  FAIL  " + name + (hint ? "  — " + hint : ""));
    for (const b of bad.slice(0, 12)) console.log("          " + b);
    if (bad.length > 12) console.log(`          …and ${bad.length - 12} more`);
  }
};

const where = (f, i) => `${relative(ROOT, f)}:${i + 1}`;

console.log("\n§12 — static audit");

/* "All shadows tinted --ink; grep -ri '#000|rgba(0, *0, *0' returns nothing."
   There is no black anywhere in this system, including in shadows. */
const blacks = [];
for (const f of files) {
  readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
    if (/#000(\b|[0-9a-f]{3}\b)/i.test(ln) || /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]/i.test(ln)) {
      blacks.push(`${where(f, i)}  ${ln.trim().slice(0, 80)}`);
    }
  });
}
ok("no black anywhere, shadows included", blacks);

/* "Every hex in the codebase resolves to a token; zero raw hex outside
   tokens.css." Two files are allowed to hold literals and both are
   documented: tokens.css is the source of truth, and the filter needs a
   literal lighting-color because SVG filter primitives cannot read var(). */
const ALLOW = new Set(["tokens.css"]);
const hexes = [];
let exempt = 0;
const exemptFiles = [];
for (const f of files) {
  const name = basename(f);
  if (ALLOW.has(name)) continue;
  const lines = readFileSync(f, "utf8").split("\n");

  /* A marker in the file's header exempts the WHOLE file. That is the right
     grain for a standalone asset like the app icon: it is rasterised into the
     PWA icons and never lives in a document that has the tokens, so every
     value in it is necessarily a literal. The header comment names the ramp
     stop each one was copied from. */
  if (lines.slice(0, 20).some((l) => /feltwork-allow-hex/.test(l))) {
    exemptFiles.push(relative(ROOT, f));
    continue;
  }

  lines.forEach((ln, i) => {
    if (/lighting-color|feFunc|__|^\s*\*/.test(ln)) return;      // filter internals + comments
    const m = ln.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (!m) return;
    /* An explicit, greppable exemption. The only legitimate use is the
       pre-paint anti-FOUC script, which runs before any stylesheet exists and
       so cannot read --paper. Marked lines are counted and reported, never
       silently skipped — an exemption nobody can see is just a hole. */
    const marked = /feltwork-allow-hex/.test(ln) ||
      lines.slice(Math.max(0, i - 6), i).some((p) => /feltwork-allow-hex/.test(p));
    if (marked) { exempt++; return; }
    hexes.push(`${where(f, i)}  ${m.join(" ")}  ${ln.trim().slice(0, 60)}`);
  });
}
ok("no raw hex outside tokens.css", hexes);
/* Exemptions are always reported, never silent — one nobody can see is a hole. */
if (exempt) console.log(`          note: ${exempt} exempt line(s) — pre-paint ground`);
for (const f of exemptFiles) console.log(`          note: ${f} exempt — standalone asset`);

/* "Every 3D face uses a measured ramp stop — no brightness(), no
   black-mixing, no invented tints." */
const computed = [];
for (const f of files.filter((x) => x.includes("/iso/") || x.includes("build-iso"))) {
  readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
    if (/filter:\s*brightness|brightness\(|saturate\(/.test(ln)) {
      computed.push(`${where(f, i)}  ${ln.trim().slice(0, 70)}`);
    }
  });
}
ok("no computed face shading (brightness/saturate)", computed);

/* "Border-radius under 8px anywhere" is banned by §13. --s-1 (4px) is a
   spacing step, not a radius; the radius scale starts at 10. */
const radii = [];
for (const f of files) {
  if (basename(f) === "tokens.css") continue;
  readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
    const m = ln.match(/border-radius:\s*([0-9.]+)px/);
    if (m && Number(m[1]) > 0 && Number(m[1]) < 8) {
      radii.push(`${where(f, i)}  ${ln.trim().slice(0, 70)}`);
    }
  });
}
ok("no border-radius under 8px", radii);

/* §13 anti-brief, the mechanically checkable half. */
const banned = [];
for (const f of files) {
  readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
    if (/^\s*(\*|\/\/|<!--)/.test(ln)) return;
    if (/backdrop-filter/.test(ln)) banned.push(`${where(f, i)}  glassmorphism: ${ln.trim().slice(0, 50)}`);
    /* §13 bans gradient MESHES and blobs — decorative colour blends. Two uses
       are not that and stay legal: `repeating-linear-gradient` draws hairlines
       (the model's ground grid is drawn, not downloaded), and a radial that
       fades to transparent is how a soft contact shadow is made. A blend
       between two different colours is the thing being ruled out. */
    if (/conic-gradient/.test(ln))
      banned.push(`${where(f, i)}  gradient: ${ln.trim().slice(0, 50)}`);
    if (/(?<!repeating-)linear-gradient/.test(ln) && !/transparent/.test(ln))
      banned.push(`${where(f, i)}  gradient: ${ln.trim().slice(0, 50)}`);
    if (/radial-gradient/.test(ln) && !/transparent/.test(ln))
      banned.push(`${where(f, i)}  gradient: ${ln.trim().slice(0, 50)}`);
  });
}
ok("no glassmorphism or gradients", banned);

/* Consuming sites must not REDEFINE a Feltwork core token.
 *
 * This is not hypothetical tidiness. mr-shake used --ink to mean "the text
 * colour"; Feltwork uses --ink for the darkest measured slate, and its dark
 * theme resolves --chip to it. The alias made --chip white on the dark sheet
 * and every card blew out — silently, because a var() that resolves to the
 * wrong thing still resolves. Alias onto the tokens, never over them. */
const CORE = [
  "paper", "chip", "ink", "ink-deep", "pencil", "text", "text-mute", "rule",
  "canary", "oxford", "euca", "blush",
];
const shadowed = [];
for (const f of files.filter((x) => extname(x) === ".css" || extname(x) === ".html")) {
  if (basename(f) === "tokens.css") continue;
  readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
    const m = ln.match(/^\s*--([a-z0-9-]+)\s*:/i);
    if (m && CORE.includes(m[1])) {
      shadowed.push(`${where(f, i)}  redefines --${m[1]}  ${ln.trim().slice(0, 50)}`);
    }
  });
}
ok("no site redefines a Feltwork core token", shadowed);

/* Spacing must come off the 8px rail. Catches hand-typed odd values. */
const offRail = [];
for (const f of files.filter((x) => extname(x) === ".css")) {
  if (basename(f) === "tokens.css") continue;
  readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
    const m = ln.match(/(?:margin|padding|gap)[a-z-]*:\s*([^;]+);/);
    if (!m) return;
    /* the visually-hidden clip recipe is not spacing */
    if (/clip|position:\s*absolute;\s*width:\s*1px/.test(ln)) return;
    for (const v of m[1].matchAll(/(-?[0-9.]+)px/g)) {
      const n = Math.abs(Number(v[1]));
      if (n && n % 8 !== 0 && n !== 4) offRail.push(`${where(f, i)}  ${n}px  ${ln.trim().slice(0, 56)}`);
    }
  });
}
ok("spacing snaps to the 8px rail", offRail);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
