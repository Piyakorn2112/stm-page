# stm-page — architecture & conventions

Marketing/generative-art site. Next.js (App Router) · React · TypeScript · CSS Modules.
This file is the source of truth for HOW the code is organised. Follow it; keep it current.

## Directory layout (feature-sliced, under `src/`)

```
src/
  app/          ROUTES ONLY. Each page.tsx just renders its feature. Holds layout.tsx + globals.css.
                Never put components, engines, or feature CSS here.
  features/     One folder per page = composition + that page's TEXT/content. Features CALL
                components; they never contain a heavy visual or its engine.
    home/   HomePage.tsx · sections/* · HomeReveal.tsx · nav.config.tsx · home.module.css
    build/  BuildPage.tsx · WorkContent.tsx · nav.config.tsx · build.module.css
    ring-lab/
  components/
    ui/         Common + structural UI, reusable across pages. Each component owns its folder
                AND its own styles.module.css. e.g. Nav/{Nav,NavInner,navLinks,styles.module.css},
                Footer/{Footer,styles.module.css}.
    graphic/    SELF-CONTAINED heavy visuals — each folder holds the renderer + worker + its
                PER-CASE engine + its own styles.module.css. HeroStructure, EmployeeCard (3D card
                pipeline), ArcField, FlowField, SoftRingsField, TeamField, IdentityGrid, StaticRing.
  lib/          Genuinely REUSABLE, framework-agnostic engines. Today: stm-ring (the ring core).
  utils/        Small reused helpers/hooks (accent, structureTheme, …).
```

**Layering (no cycles):** `app → features → components/{ui,graphic} → lib + utils`.
Features import components via `@/` aliases; a component never imports a feature.

## Where things go
- A heavy/animated visual (canvas, WebGL, generative ring) → `components/graphic/<Name>/`, with its
  worker + engine co-located. A feature renders `<TheVisual/>`; it does not own the engine.
- A reusable, framework-agnostic engine used in many places → `lib/`. A bespoke per-case render
  pipeline (e.g. the 3D card's Three.js stack) stays INSIDE its graphic folder.
- A reused pure helper or hook → `utils/`.
- Page text/copy + composition → the feature.

## CSS conventions
- **`globals.css`** holds: design TOKENS (`:root`), the system-wide editorial PRIMITIVES used by
  every section (`.section`,`.sectionAlt`,`.container`,`.eyebrow`,`.heading`,`.accentWord`,`.lede`,
  `.body`, + the global mobile-align rule), the reset, and any truly site-wide/animation classes.
  Reference primitives as plain class strings (`className="section"`), not via a module.
- **Component/section-specific styling → that component's own `styles.module.css`**, co-located in
  its folder. Do NOT create a shared `primitives.module.css`; do NOT pile component styles into a
  big shared stylesheet or into globals.
- **Design tokens** live in `globals.css :root`: `--ease-standard`, `--ease-overshoot`, `--radius`,
  `--radius-pill`, colours, `--maxw`, `--gutter`. Use the token, not the raw value. Derive a new
  token when a value recurs.
- **Backdrop blur → Tailwind utility** (`backdrop-blur-[12px]`), never a CSS-module `backdrop-filter`
  (Chrome drops it). Never put `transform` on a backdrop-filtered element.
- **Always ship light AND dark handling** for any new visual (swap/lighten colours on
  `prefers-color-scheme`).
- When splitting a CSS module, keep **compound selectors** (`.navOpen .navLinks`) together in ONE
  file, and split media queries that mix concerns by concern.

## Navigation
One `components/ui/Nav/Nav.tsx`, driven by a per-feature `nav.config.tsx`. The config must stay
**serialisable** (it crosses the Server→Client boundary): pass `anchorPrefix`/`currentRoute` strings,
not functions — `Nav` builds the predicates internally. Each page passes its own nav CSS module
(home → `Nav/styles.module.css`; build → its frosted variant in `build.module.css`).

## Hard rules
- **Never modify `lib/stm-ring/src/stmRingCore.ts`** to degrade behaviour. Extend the core ONLY via
  no-op-default options; new capability belongs in wrapper components.
- Imports go through the `@stm-ring` barrel, never deep into its files.
- Aliases: `@/*` → `src/*`; `@stm-ring` → `src/lib/stm-ring/src`.

## Local toolchain
- nvm shim is broken — run node/npm by full path: `/opt/homebrew/bin/node`, `/opt/homebrew/bin/npm`.
- Verify: `/opt/homebrew/bin/node node_modules/typescript/bin/tsc --noEmit` · `npm run build`.
- One pre-existing, tolerated eslint error: `set-state-in-effect` in the hero loader.
- Canvas/physics work is verified HEADLESSLY (node sim → metrics, or SVG/PNG snapshot, or a
  Playwright byte-diff with `reducedMotion:'reduce'` so the canvases settle deterministically).
