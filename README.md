# stm-page

The Srang Tech Mai company site. Next.js 16 (App Router, Turbopack) · React 19 ·
pure-SVG generative rings, no animation libraries.

## Structure

```
app/
  page.tsx                  composes the page (hero + sections)
  layout.tsx, globals.css   shell + design tokens (light/dark via OS scheme)
  components/
    structure/              the landing HERO (cloned /structure scene)
      StructureScene.tsx      orchestrator: loader → bloom → field → idle morphs
      StructureGrid.tsx       spherical honeycomb field of small rings
      StructureHeroRing.tsx   the big centred brand ring
      structureTheme.ts       light/dark theme, follows prefers-color-scheme
    site/                   the company-page sections (placeholder content)
      SiteNav, SiteHero, Sections, RingForge, CtaRing
lib/
  stm-ring/                 the generative-ring LIBRARY (future package)
    src/{stmRingCore,StmRing,MorphRing,index}.ts(x)
```

## The ring library (`@stm-ring`)

The generative-ring system lives in `lib/stm-ring/` and is consumed through the
`@stm-ring` path alias (see `tsconfig.json`). It is structured to become a
standalone npm package: all imports go through the barrel (`src/index.ts`), never
deep into files, so extraction is a config change with zero consumer edits. See
`lib/stm-ring/README.md`.

**Rule:** the engine (`stmRingCore`) is load-bearing — extend it only with
no-op-default options; new capabilities belong in wrapper components.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```
