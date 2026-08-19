/* §12 checks that need a live browser rather than a screenshot.
 *
 *   node scripts/check.mjs
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = process.env.FW_ROOT
  ? join(process.cwd(), process.env.FW_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript",
  ".svg":"image/svg+xml", ".png":"image/png", ".woff2":"font/woff2" };

const PORT = 8931 + Math.floor(Math.random() * 200);
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    const b = await readFile(p);
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(b);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise((r) => server.listen(PORT, r));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(os.tmpdir(), "fw-check-"));
const chrome = spawn(CHROME, ["--headless=new","--disable-gpu","--no-first-run",
  "--no-default-browser-check","--remote-debugging-port=" + (PORT+1),
  "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });

let wsUrl = null;
for (let i = 0; i < 80 && !wsUrl; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT+1}/json/list`)).json();
    const t = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
    if (t) wsUrl = t.webSocketDebuggerUrl;
  } catch {}
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => {
  const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id:n, method, params })); });

const evalJS = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))
    ?.result?.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Accessibility.enable");
await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/proof/headline.html` });
await sleep(1800);

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  pass  " + name + (extra ? "  " + extra : "")); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  " + extra : "")); }
};

console.log("\n§5 / §12 — the felt headline");

/* The whole point of Method A: it is TEXT, not an image of text. */
const h1text = await evalJS(`document.querySelector('.felt-head').textContent.trim()`);
ok("headline is live text in the DOM", h1text === "Under Construction", `"${h1text}"`);

/* Selectable — §12 says "still selectable text". */
const selected = await evalJS(`(() => {
  const h = document.querySelector('.felt-head');
  const r = document.createRange(); r.selectNodeContents(h);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  return s.toString().trim();
})()`);
ok("headline is selectable", selected === "Under Construction", `"${selected}"`);

/* The filter must actually be applied, not silently dropped. Which variant
   resolves depends on the theme and on prefers-reduced-motion, so assert the
   family rather than one id. */
const filt = await evalJS(`getComputedStyle(document.querySelector('.felt-head')).filter`);
ok("a felt filter is applied", /url\(["']?#felt(-dark)?(-flat|-2)?["']?\)/.test(filt), filt);

/* Both themes must resolve to a felt filter, and to DIFFERENT ones — the
   dark sheet compensates its multiply, so sharing one would be a regression. */
const perTheme = await evalJS(`(() => {
  const el = document.querySelector('.felt-head');
  const root = document.documentElement;
  const prev = root.getAttribute('data-theme');
  const read = (t) => { root.setAttribute('data-theme', t);
    return getComputedStyle(el).filter; };
  const out = { light: read('light'), dark: read('dark') };
  if (prev === null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', prev);
  return out;
})()`);
ok("light and dark resolve to different felt filters",
   /#felt["')]/.test(perTheme.light) && /#felt-dark/.test(perTheme.dark),
   `${perTheme.light} / ${perTheme.dark}`);

/* The correction to §5: no generated content duplicating the headline, so the
   accessible name is the words once, not twice. */
const before = await evalJS(
  `getComputedStyle(document.querySelector('.felt-head'), '::before').content`);
ok("no ::before generated text (a11y-name duplication)", before === "none", before);

const axName = await (async () => {
  const doc = await send("DOM.getDocument", { depth: -1 });
  const node = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: ".felt-head" });
  const ax = await send("Accessibility.getPartialAXTree", { nodeId: node.nodeId });
  const heading = ax.nodes.find((n) => n.role?.value === "heading");
  return heading?.name?.value;
})();
ok("accessible name is the words exactly once",
   axName === "Under Construction", JSON.stringify(axName));

/* §5.1 — the nap destroys small text, so nothing filtered may sit below 34px. */
const tooSmall = await evalJS(`(() => {
  return [...document.querySelectorAll('.felt-head, .felt-head--2')]
    .map(el => parseFloat(getComputedStyle(el).fontSize))
    .filter(px => px < 34);
})()`);
ok("no filtered text below the 34px floor", tooSmall.length === 0, JSON.stringify(tooSmall));

/* §5.2 — at most two Method-A headings in a viewport. This page deliberately
   stacks more than two to compare them, so we only report the count. */
const count = await evalJS(`document.querySelectorAll('.felt-head').length`);
console.log(`  note  ${count} filtered headings on this comparison page ` +
            `(§5 budget is 2 per viewport; this page is a test rig, not a layout)`);

/* Type: the three faces must actually load, not silently fall back. */
const faces = await evalJS(`(async () => { await document.fonts.ready;
  return ['Archivo','Hanken Grotesk','Martian Mono']
    .map(f => f + ':' + document.fonts.check('16px "' + f + '"')).join(' '); })()`);
ok("all three faces loaded", !faces.includes(":false"), faces);

/* §4 needs both axes live on Archivo — weight AND width. */
const axes = await evalJS(`(() => {
  const s = getComputedStyle(document.querySelector('.felt-head'));
  return s.fontWeight + '/' + s.fontStretch;
})()`);
ok("display face carries wght + wdth", axes === "780/118%", axes);

/* ── §8 / §12 — "every interactive element compresses on press and none of
   them lift". Verified by forcing the pseudo-states through CDP and reading
   the resulting matrix, rather than by trusting the stylesheet. ───────── */

console.log("\n§8 — everything compresses, nothing lifts");

await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/proof/system.html` });
await sleep(1600);
await send("DOM.enable");
await send("CSS.enable");

const doc = await send("DOM.getDocument", { depth: -1 });
const target = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: ".card.pressable" });

/* decompose a computed `matrix(a,b,c,d,e,f)`: a = scaleX, d = scaleY, f = ty */
const readTransform = async () => {
  const v = await evalJS(
    `getComputedStyle(document.querySelector('.card.pressable')).transform`);
  if (!v || v === "none") return { scaleX: 1, scaleY: 1, ty: 0 };
  const n = v.match(/matrix\(([^)]+)\)/)[1].split(",").map(Number);
  return { scaleX: n[0], scaleY: n[3], ty: n[5] };
};

const force = (states) =>
  send("CSS.forcePseudoState", { nodeId: target.nodeId, forcedPseudoClasses: states });

/* Wait out the transition before sampling. Recovery is --release, 420ms with
   an overshoot, so reading immediately after forcing the state catches the
   matrix still at identity and looks like the rule never applied. */
const SETTLE = 700;

await force(["hover"]);
await sleep(SETTLE);
const hov = await readTransform();
ok("hover moves DOWN, never up", hov.ty > 0, `translateY ${hov.ty.toFixed(2)}px`);
ok("hover compresses", hov.scaleX < 1 && hov.scaleY < 1,
   `scale ${hov.scaleX.toFixed(3)} × ${hov.scaleY.toFixed(3)}`);

await force(["hover", "active"]);
await sleep(SETTLE);
const act = await readTransform();
ok("press pushes further down", act.ty > hov.ty, `translateY ${act.ty.toFixed(2)}px`);
ok("press squashes vertically", act.scaleY < 1, `scaleY ${act.scaleY.toFixed(3)}`);
/* squashed foam displaces sideways — without this the press reads as a shrink */
ok("press bulges sideways", act.scaleX > 1, `scaleX ${act.scaleX.toFixed(3)}`);

/* Release the forced states and let the card finish recovering. Recovery is
   --release (420ms, with overshoot), and getBoundingClientRect reports the
   TRANSFORMED box — measuring during the settle reads a compressed plinth
   and looks like a broken rhythm. */
await force([]);
await sleep(SETTLE);

/* §9 — a visible pencil focus ring on every interactive element, always.
   Forced through CDP rather than by calling .focus(): programmatic focus does
   not match :focus-visible, so a real rule looks like a missing one. */
const btn = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: ".btn" });
await send("CSS.forcePseudoState",
  { nodeId: btn.nodeId, forcedPseudoClasses: ["focus", "focus-visible"] });
const focusRing = await evalJS(`(() => {
  const s = getComputedStyle(document.querySelector('.btn'));
  return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.outlineOffset].join(' ');
})()`);
ok("focus ring is a 3px pencil outline",
   /solid/.test(focusRing) && /3px/.test(focusRing) && /rgb\(175,\s*126,\s*77\)/.test(focusRing),
   focusRing);
await send("CSS.forcePseudoState", { nodeId: btn.nodeId, forcedPseudoClasses: [] });

/* §7 — every block's height is a multiple of 8px.
   Scoped to the blocks the SYSTEM sizes. A card's height is set by how much
   copy it holds, and forcing that onto the rail would mean clamping text; the
   rhythm is carried by the fixed wells and the spacing tokens instead. */
const offRail = await evalJS(`(() => {
  return [...document.querySelectorAll('.card__plinth, .btn')]
    .map(el => [el.className.split(' ')[0], Math.round(el.getBoundingClientRect().height * 100) / 100])
    .filter(([, h]) => h % 8 !== 0)
    .slice(0, 8);
})()`);
ok("system-sized blocks snap to the 8px rail", offRail.length === 0, JSON.stringify(offRail));

console.log(`\n  ${pass} passed, ${fail} failed\n`);

ws.close(); chrome.kill(); server.close();
process.exit(fail ? 1 : 0);
