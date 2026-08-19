#!/usr/bin/env node
/* feltwork build — emits the system into a consuming site's output dir.
 *
 *   feltwork build --out dist                  # linked (default)
 *   feltwork build --out dist --mode inline --html src/index.html
 *
 * Two modes, because the four sites are not the same shape:
 *
 *   linked  — writes feltwork.css, filters.svg, the fonts, the tile and the
 *             icons into --out. Drops into the existing `cat`-based build in
 *             mr-shake and rent-vs-buy with one added line.
 *
 *   inline  — rewrites one HTML file with the CSS and the filter SVG inlined,
 *             so the shipped artifact is a single self-contained file.
 *             portfolio-landing's whole conceit is "no frameworks, no
 *             libraries, no images — you're reading the source", and linking a
 *             dependency would quietly falsify that line. The tokens are still
 *             authored once here; only the delivery differs.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Order matters: tokens first (everything reads them), then the reset, then
   type, then the pieces that consume both. */
const SHEETS = ["tokens.css", "base.css", "type.css", "felt-head.css", "components.css"];

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name, dflt) => {
  const i = args.indexOf("--" + name);
  return i === -1 ? dflt : args[i + 1];
};

if (cmd !== "build") {
  console.error("usage: feltwork build --out <dir> [--mode linked|inline] [--html <file>]");
  process.exit(1);
}

const out = flag("out");
const mode = flag("mode", "linked");
if (!out) { console.error("feltwork: --out is required"); process.exit(1); }

const css = () =>
  SHEETS.map((f) => {
    const body = readFileSync(join(PKG, "src", f), "utf8");
    /* type.css points at ../fonts/ relative to src/. In a built site the
       fonts sit beside the stylesheet, so rewrite as we concatenate rather
       than making the source file wrong for its own directory. */
    return body.replace(/url\("\.\.\/fonts\//g, 'url("fonts/');
  }).join("\n");

const icons = () => {
  const dir = join(PKG, "src", "iso");
  if (!existsSync(dir)) return {};
  return Object.fromEntries(readdirSync(dir)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => [basename(f, ".svg"), readFileSync(join(dir, f), "utf8")]));
};

if (mode === "linked") {
  mkdirSync(join(out, "fonts"), { recursive: true });
  mkdirSync(join(out, "tex"), { recursive: true });
  mkdirSync(join(out, "iso"), { recursive: true });

  writeFileSync(join(out, "feltwork.css"), css());
  copyFileSync(join(PKG, "src", "filters.svg"), join(out, "filters.svg"));
  copyFileSync(join(PKG, "tex", "felt-1024.png"), join(out, "tex", "felt-1024.png"));

  const fonts = join(PKG, "fonts");
  if (!existsSync(fonts)) {
    console.error("feltwork: fonts/ missing — run `npm run fonts` in the package first");
    process.exit(1);
  }
  for (const f of readdirSync(fonts)) copyFileSync(join(fonts, f), join(out, "fonts", f));

  for (const [name, svg] of Object.entries(icons()))
    writeFileSync(join(out, "iso", `${name}.svg`), svg);

  console.log(`feltwork → ${out}  (linked)`);
  console.log(`  feltwork.css, filters.svg, tex/, fonts/, iso/`);
  console.log(`  link the stylesheet, and INLINE filters.svg and the icons —`);
  console.log(`  an SVG referenced through <img> cannot see the tokens and renders black.`);
} else if (mode === "inline") {
  const htmlPath = flag("html");
  if (!htmlPath) { console.error("feltwork: --mode inline needs --html <file>"); process.exit(1); }

  let html = readFileSync(htmlPath, "utf8");
  const style = `<style>\n/* Feltwork — generated, do not edit here. */\n${css()}\n</style>`;
  const defs = readFileSync(join(PKG, "src", "filters.svg"), "utf8");

  const inject = `${style}\n${defs}`;
  if (html.includes("<!--feltwork-->")) html = html.replace("<!--feltwork-->", inject);
  else html = html.replace("</head>", `${style}\n</head>`).replace("<body>", `<body>\n${defs}`);

  for (const [name, svg] of Object.entries(icons()))
    html = html.replaceAll(`<!--iso:${name}-->`, svg);

  mkdirSync(out, { recursive: true });
  const dest = join(out, basename(htmlPath));
  writeFileSync(dest, html);

  mkdirSync(join(out, "fonts"), { recursive: true });
  mkdirSync(join(out, "tex"), { recursive: true });
  copyFileSync(join(PKG, "tex", "felt-1024.png"), join(out, "tex", "felt-1024.png"));
  for (const f of readdirSync(join(PKG, "fonts")))
    copyFileSync(join(PKG, "fonts", f), join(out, "fonts", f));

  console.log(`feltwork → ${dest}  (inline, ${(html.length / 1024).toFixed(1)} KB)`);
} else {
  console.error(`feltwork: unknown mode "${mode}"`);
  process.exit(1);
}
