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

## Tool & form UI (generators + future tools)
The marketing/content PAGES are done and serve the site well — leave them. This vocabulary is for
INTERACTIVE TOOLS (e.g. `/tools/business-card`) and future ones. **FLAT by default** — depth comes
from a hairline + a barely-there tint, NOT shadows.
- **No drop shadow on containers / fields / panels / pills / tabs.** Hover & active states = a
  `border-color` shift + a faint inverse-tone wash (`color-mix(in srgb, var(--fg) 4–6%, transparent)`),
  never a grey wash, never a `box-shadow`.
- **Drop shadows are reserved for genuinely TACTILE objects** you grab or lift — a draggable slider
  knob, the 3D card, the folding-letter on /contact. If it isn't a physical thing, it's flat.
- **Field focus adopts the live `--accent`** (border + a soft `color-mix(accent 13%)` ring), not a
  fixed hue, so the tool's chosen colour threads the form.
- **Labelled control = a "stack":** a header row (small uppercase-tracked label LEFT + the live value
  RIGHT, tabular-nums) over the full-width control — always surface the current value.
- **Segmented PILL GROUP, not a native `<select>`/dropdown, for ≤~5 exclusive options:** flat
  transparent pills (`--faint` text) → active = solid inverse-tone fill (`--fg` bg / `--bg` text);
  hover = subtle tint + border. (Same active-pill trick gives a "lifted" feel with no shadow.)
- **For browsing a LARGE/continuous set, a horizontal SNAP REEL/carousel** (centre item = selected,
  swipe + momentum, settles snapped, `touch-action: pan-y` so vertical page scroll still passes)
  beats a long list/dropdown — see `RingGrid layout="reel"`.
- **Solid-pill primary CTA (`--fg`/`--bg`) + ghost secondary** (the nav-CTA identity); flat, hover
  lightens via `opacity`.
- **Labels:** ~0.7rem, 600, ~0.09em tracked, UPPERCASE, `--faint`. DROP labels a clear placeholder
  already covers; keep them where a value needs naming for accuracy (export/print forms).
- Adapted from the `glass-editor` ("Latent Write") tool-kit — we keep the CRAFT (the stack, pill
  groups, considered labels/descriptions, flat tinted states) but NOT its glass/translucent system.

## Navigation
One `components/ui/Nav/Nav.tsx`, driven by a per-feature `nav.config.tsx`. The config must stay
**serialisable** (it crosses the Server→Client boundary): pass `anchorPrefix`/`currentRoute` strings,
not functions — `Nav` builds the predicates internally. Each page passes its own nav CSS module
(home → `Nav/styles.module.css`; build → its frosted variant in `build.module.css`).

## Internationalization (i18n)
**next-intl**, locales `en` (default) + `th`, `localePrefix: "as-needed"` — English keeps the bare URLs
(`/`, `/contact`), Thai is served under `/th`. Config in `src/i18n/{routing,request,navigation}.ts`;
`src/middleware.ts` runs the locale middleware. Routes live under **`src/app/[locale]/`** (the locale
layout is the root layout — renders `<html lang>` + `NextIntlClientProvider`).
- **`messages/en.json` is the SOURCE OF TRUTH**; `messages/th.json` is generated. Namespaced by feature
  (`nav`, `footer`, `home.*`, `contact.*`, `showcase`, `work.*`, `product.*`, `tools.*`, `businessCard.*`).
  Keys are stable; values only differ per locale.
- **Use copy via `useTranslations("ns")`** (works in server + client components). Rich inline markup
  (the `accentWord` headings) uses **`t.rich`** with tag renderers. ICU placeholders (`{year}`,`{name}`)
  and rich tags must be preserved by translators. Pass `{ year: String(...) }` to avoid number grouping.
- **Internal links use the locale-aware `Link`/navigation from `@/i18n/navigation`** (not `next/link`)
  so the active locale is preserved.
- **Every `page.tsx` calls `setRequestLocale(locale)`** (after `await params`) so pages stay statically
  rendered; the locale layout does too.
- **Fonts:** body stack is `var(--font-sans), var(--font-thai), …` = **Inter → Prompt**. Inter has no Thai
  glyphs, so Latin renders in Inter and Thai falls through to Prompt automatically (English words inside
  Thai stay Inter). Prompt is `next/font` `Prompt` (`preload:false`). `html[lang="th"]` bumps line-height
  (Thai stacks tall). Brand/product names + file-format acronyms stay Latin.
- **Language-switch UX — no nav toggle.** A per-section `LocaleReadLink` (`components/ui/LocaleReadLink`)
  sits at the bottom of each section's text container and fades in (opacity only, slow) for the section in
  view; its label is the OTHER language (อ่านภาษาไทย on en · "Read in English" on th), linking to the same
  path in that locale.
- **Translation is a pipeline, never ad-hoc.** Rules: **`docs/i18n/thai-localization.md`** (canonical —
  read before translating; **naturalness OUTRANKS literal fidelity** — §1 ★, slight drift OK, Apple-TH is a
  baseline to beat). Workflow + run log: `docs/i18n/localization-pipeline.md`. Agents:
  `.claude/agents/thai-localizer.md` (translate) → `.claude/agents/thai-localization-reviewer.md`
  (critique + fix). **Always translate then review**; fold new term decisions into the rules-doc glossary.
- Known: Next 16 prints a `middleware → proxy` deprecation warning (still works; rename later once
  next-intl confirms `proxy.ts` support).

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
