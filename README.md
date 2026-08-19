# Feltwork

The shared design system for rishabhdoshi.com and its experiments.

> Braun gave you the grid, the restraint and the honest label.
> Felt is the material it's all made of.

The layout is severe, the copy is plain, the colour is functional signal.
Everything is then upholstered. Every visual decision traces to one of two
sources — Rams/Vitsœ discipline, or felt physics (matte, soft, compressible,
fibrous, no gloss). Anything that traces to neither gets cut.

Consumed as a devDependency by `portfolio-landing`, `experiments-landing`,
`mr-shake` and `rent-vs-buy-calculator`.

## Status

Built in §10's mandated order, and rolled out to all four sites.

- [x] 1 · `tokens.css`
- [x] 2 · **the felt headline** (the gate)
- [x] 3 · the isometric icons — all four source objects
- [x] 4 · the rail and grid
- [x] 5 · cards and the compression interaction
- [x] 6 · content and copy — all four sites
- [x] 7 · accessibility pass — all four sites

| Site | |
|---|---|
| portfolio-landing | Bauhaus model rebuilt in true isometric felt |
| experiments-landing | the index on the rail |
| mr-shake | tokens + compression; 85 e2e assertions still green |
| rent-vs-buy-calculator | Tailwind removed; Recharts fed from the tokens |

Verification:

```
node scripts/audit.mjs [dir]   # 7 static §12 checks, per codebase
node scripts/check.mjs         # 16 checks in a real browser
```

All five codebases pass all seven static checks; the package passes all
sixteen browser checks. mr-shake's own suites (120 rules + 85 browser
assertions) still pass unchanged — its class names were deliberately left
alone, so its e2e suite acted as the regression harness for the redesign.

### One thing left for you

`package.json` in each site declares `feltwork` as
`github:doshi-experiments/feltwork`. **That repo has to be pushed before CI can
resolve it** — Cloudflare checks out one repo, so a `file:../feltwork` path
would not work there. Local builds already work: each `build.sh` falls back to
a sibling checkout when the dependency is not installed.

Two deploy settings also need changing by hand, because both sites are gaining
a build step they did not have:

- **portfolio-landing** (Cloudflare Pages): build command `npm run build`,
  output directory `dist`.
- **experiments-landing**: `wrangler.jsonc` now points at `./dist`, which is a
  code change rather than a dashboard one — nothing to do beyond shipping it.

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
binding, because "undercover" does not map onto "things written".

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
