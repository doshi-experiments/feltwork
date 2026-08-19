/* Screenshots a local page with headless Chrome over CDP.
 *
 * Borrowed wholesale from mr-shake/test/e2e.mjs, which already drives Chrome
 * this way — no puppeteer in this environment, and Node has a global
 * WebSocket. Generalised here so all four sites get the same before/after
 * check; only mr-shake has tests today.
 *
 *   node scripts/shoot.mjs <path-under-repo> <out.png> [width] [height] [theme] [scale]
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = process.env.FW_ROOT
  ? join(process.cwd(), process.env.FW_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");

const [page, out, w = 1440, h = 1200, theme = "light", scale = 2] = process.argv.slice(2);
if (!page || !out) { console.error("usage: shoot.mjs <page> <out.png> [w] [h] [theme] [scale]"); process.exit(1); }

const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2",
};

const PORT = 8731 + Math.floor(Math.random() * 200);
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    const body = await readFile(p);
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise((r) => server.listen(PORT, r));

const profile = mkdtempSync(join(os.tmpdir(), "fw-shot-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--hide-scrollbars", "--force-device-scale-factor=" + scale,
  "--remote-debugging-port=" + (PORT + 1), "--user-data-dir=" + profile, "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Attach to the PAGE target, not the browser target — the browser-level
   endpoint does not implement the Page domain and captureScreenshot comes
   back undefined there. */
let wsUrl = null;
for (let i = 0; i < 80 && !wsUrl; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT + 1}/json/list`)).json();
    const target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (target) wsUrl = target.webSocketDebuggerUrl;
  } catch {}
}
if (!wsUrl) { console.error("chrome did not come up"); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
};
const send = (method, params = {}) =>
  new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",
  { width: Number(w), height: Number(h), deviceScaleFactor: Number(scale), mobile: false });
await send("Emulation.setEmulatedMedia",
  { features: [{ name: "prefers-color-scheme", value: theme }] });

await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/${page}` });
await sleep(1400);   // fonts + the filter fetch
await send("Runtime.evaluate", {
  expression: `document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)}); document.fonts.ready`,
  awaitPromise: true,
});
await sleep(600);

/* FW_SCROLL=0..1 scrolls to that fraction of the page before capturing, for
   scroll-driven pages where the interesting state is not at the top. It also
   implies a viewport-only capture — grabbing beyond the viewport on a page
   with a 640vh runway yields one screen of content and a mile of blank. */
const scroll = process.env.FW_SCROLL;
if (scroll !== undefined) {
  const info = await send("Runtime.evaluate", { returnByValue: true, expression:
    `(() => { const max = document.documentElement.scrollHeight - innerHeight;
       scrollTo({ top: max * ${Number(scroll)}, behavior: 'instant' });
       return { max, y: scrollY, sh: document.documentElement.scrollHeight, ih: innerHeight }; })()` });
  await sleep(1400);
  if (process.env.FW_DEBUG) {
    console.log("  scroll:", JSON.stringify(info?.result?.value));
    const st = await send("Runtime.evaluate", { returnByValue: true, expression:
      `({ pct: document.querySelector('#pctNum')?.textContent,
          built: document.querySelectorAll('.piece.built').length,
          pieces: document.querySelectorAll('.piece').length,
          shadow: getComputedStyle(document.documentElement).getPropertyValue('--shadow'),
          raf: typeof requestAnimationFrame })` });
    console.log("  state:", JSON.stringify(st?.result?.value));
  }
}
const shot = await send("Page.captureScreenshot",
  { format: "png", captureBeyondViewport: scroll === undefined });
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`${out}  ${w}x${h} @${scale}x  ${theme}`);

ws.close(); chrome.kill(); server.close();
process.exit(0);
