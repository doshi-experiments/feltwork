/* Copies the three variable faces out of node_modules into a target dir.
 *
 * Mirrors the IBM Plex copy loop the two apps already use in build.sh, so the
 * self-hosting pattern stays the same one this project already understands.
 *
 * Fontsource splits variable fonts per axis. The `-wdth-` file is the
 * TWO-axis file — it declares both `font-weight` and `font-stretch` ranges —
 * so Archivo and Martian Mono take that one, since the brief sets width and
 * weight together. Hanken Grotesk only ever ships wght, which is all §4 asks
 * of it. `-latin-` is already the Latin subset, so no subsetting step.
 *
 *   node scripts/copy-fonts.mjs [outDir]
 */
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] || join(root, "proof", "fonts");

/* [ package, file, emitted name ] — axes verified against the shipped CSS:
   Archivo      wght 100–900  wdth  62%–125%   (§4 needs 750–800 / 112–125)
   Martian Mono wght 100–800  wdth  75%–112.5% (§4 needs 500 / 87.5)
   Hanken       wght 100–900                   (§4 needs 400)             */
const FACES = [
  ["archivo",       "archivo-latin-wdth-normal.woff2",       "Archivo.woff2"],
  ["hanken-grotesk","hanken-grotesk-latin-wght-normal.woff2","HankenGrotesk.woff2"],
  ["martian-mono",  "martian-mono-latin-wdth-normal.woff2",  "MartianMono.woff2"],
];

mkdirSync(out, { recursive: true });

for (const [pkg, file, name] of FACES) {
  const src = join(root, "node_modules", "@fontsource-variable", pkg, "files", file);
  const dst = join(out, name);
  copyFileSync(src, dst);
  console.log(`  ${name.padEnd(20)} ${(statSync(dst).size / 1024).toFixed(1)} KB`);
}

console.log(`fonts → ${out}`);
