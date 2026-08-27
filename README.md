# Feltwork

The shared design system for rishabhdoshi.com and its experiments.

> Braun gave you the grid, the restraint and the honest label.
> Felt is the material it's all made of.

The layout is severe, the copy is plain, the colour is functional signal.
Everything is then upholstered. Every visual decision traces to one of two
sources — Rams/Vitsœ discipline, or felt physics (matte, soft, compressible,
fibrous, no gloss). Anything that traces to neither gets cut.

## Status: shelved — nothing consumes this today

It was rolled out to all four sites and then **reverted from every one of
them**. As of August 2026 no repo depends on Feltwork; each site is back on
the styling it had before:

| Site | Feltwork rollout | Now |
|---|---|---|
| experiments-landing | `0810f2b` | reverted in `1d98944` |
| mr-shake | `e609f9f` | reverted in `74bf0a5` |
| rent-vs-buy-calculator | `0227ca8` | reverted in `9db87c9` |
| portfolio-landing | `e33f5ac` | reverted in `eeac4b0` |

The reverts are plain `git revert`s and record no reason, so none is claimed
here. Treat the rest of this README as documentation of **what Feltwork is**
— which is still accurate — rather than of anything currently in production.

Picking it back up means, per site: adding `feltwork` as a devDependency
(`github:doshi-experiments/feltwork` — a `file:../feltwork` path won't
resolve in CI, since Cloudflare checks out one repo), then reversing the
revert. `portfolio-landing` and `experiments-landing` would also each gain a
build step they don't currently have, which means changing their deploy
settings by hand rather than only shipping code.

The package itself still builds and verifies on its own:

```
node scripts/audit.mjs [dir]   # 7 static §12 checks, per codebase
node scripts/check.mjs         # 16 checks in a real browser
```

## What's here

| Path | |
|---|---|
| `src/tokens.css` | the measured ramps, the rail, motion. The only file with raw hex. |
| `src/base.css` | the reset, the shelf rail, the 12-column grid |
| `src/type.css` | the three faces and the scale |
| `src/felt-head.css` | the headline, its fallback, and the theme/reduced-motion paths |
| `src/components.css` | cards, buttons, links, focus, and the compression |
| `src/filters.svg` | `#felt` and its five variants |
| `src/iso/*.svg` | the four objects, generated |
| `tex/felt-1024.png` | the baked tile — committed, never generated at runtime |
| `bin/feltwork.mjs` | `feltwork build`, the CLI the four sites call |
| `scripts/iso.mjs` | the isometric projection and solid primitives |
| `scripts/build-iso.mjs` | turns solids into §6-compliant SVG |
| `scripts/bake-texture.mjs` | writes the tile with `node:zlib`, no image library |
| `scripts/copy-fonts.mjs` | pulls the Latin variable woff2s out of node_modules |
| `scripts/shoot.mjs` | screenshots a page over CDP (borrowed from mr-shake's e2e) |
| `scripts/check.mjs` | the §12 assertions that need a live browser |
| `scripts/audit.mjs` | the §12 assertions that are static facts |
| `proof/headline.html` | the gate artifact |
| `proof/system.html` | the shelving system end to end |
| `proof/tune.html` | the parameter sweep the filter was tuned against |

## Consuming it

**Icons and the filter must be INLINED, never `<img src>`.** An SVG in an
`<img>` is an isolated document with no access to the host page's custom
properties, so every `var(--canary-light)` resolves to nothing and the object
renders solid black. `feltwork build` emits them as files to inline; in
`inline` mode it does the injection for you via `<!--iso:rocket-->` markers.

## Colour has a job

Each hue carries one permanent meaning and is never reused for anything else.
Landing sites use the category meanings; each app documents its own local
binding, because "undercover" does not map onto "things written". (The
per-app columns below describe the reverted rollout, not current code.)

| | landing sites | mr-shake | rent-vs-buy |
|---|---|---|---|
| canary | shipped | Mr. Shake | signal |
| oxford | written | — | — |
| eucalyptus | work | civilian | buy |
| blush | the workshop | undercover | rent |
| pencil | interaction only — focus, rules, the cursor. Never a category. | | |

## Three deliberate departures from the brief

1. **The halo is a filter stage, not a pseudo-element.** As written, the same
   element carries `filter:url(#felt)` while its `::before` carries
   `url(#felt-halo)` — but a CSS filter applies to the whole subtree, so the
   halo gets filtered twice. `attr(data-text)` also duplicates the headline
   into the accessibility tree. An `feMerge` branch fixes both and costs one
   pass instead of two.
2. **`surfaceScale` 6.5 and nap `baseFrequency` 0.26/0.32**, against the
   brief's 1.2–2.5 and 0.045/0.062. At the brief's numbers the nap is
   invisible and the result is ragged ink, not felt. Tuned against a
   six-variant sweep at 92px and at the 34px floor.
3. **A dark theme, which the brief does not define.** The ground flips; the
   felt does not. Zero new hues — a felt object doesn't change colour when you
   move it onto a dark table, so every "text on felt" ratio is identical in
   both themes.

## Commands

```
npm run bake     # re-bake tex/felt-1024.png
npm run fonts    # copy the variable woff2s into ./fonts
node scripts/shoot.mjs proof/headline.html out.png 1300 1750 light 2
node scripts/check.mjs
```
