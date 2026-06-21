# @stm-ring

The STM generative-ring system, packaged as a self-contained library.

A ring's centre-line is a closed Fourier/epicycle sum, resampled by arc length,
corner-rounded, and emitted as ordered weave "strands" with per-vertex OKLab
colour and a drifting "charge" arc. Every ring is **deterministic per seed**
(`hashId → mulberry32`), so the same input always yields the same identity.

## Usage

Imported through the `@stm-ring` path alias (configured in the app's
`tsconfig.json` → `./lib/stm-ring/src`). Always import from the package root, not
from individual files:

```ts
import { StmRing, MorphRing, randomSeed, exportSVG } from "@stm-ring";
```

- **`StmRing`** — live React renderer. Modes: rest-until-hover (default),
  `forceSeed` (settle to a seed, glide between seeds), `animate` (continuous
  cycling). Props: `grayscale`, `white`, `segments`/`pieces` (cheaper),
  `fps` (cap), `baseColors` (recolour the rest wire), `hoverable`.
- **`MorphRing`** — standalone finite A→B morph at a settled pose; seamless
  `static → morph → static`. Used by dense fields.
- **`stmRingCore`** — the framework-agnostic engine: `buildRing`,
  `buildRingMorph`, `exportSVG`, `exportThumbnailSVG`, `makeHover`, `randomSeed`,
  `PALETTE` (the 3 brand colours), and geometry constants.

## Design rule

The core engine is load-bearing. **Extend it only with options that default to a
no-op**, so existing callers stay byte-identical. New capabilities belong in
wrapper components, not in the core.

## Extracting to a real package

Everything is already routed through `src/index.ts`. To publish: build `src/` to
`dist/`, point `main`/`types`/`exports` at `dist`, and replace the app's
`@stm-ring` path alias with the published dependency. No consumer code changes.
