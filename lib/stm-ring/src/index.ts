/**
 * @stm-ring — public surface of the STM generative-ring library.
 *
 * This folder is the seed of a future standalone package. For now it lives in
 * the app (imported via the `@stm-ring` path alias, see tsconfig.json) so it can
 * evolve alongside the site; when it stabilises, this `src/` plus the sibling
 * package.json lift out into their own npm package with ZERO consumer changes —
 * every import already goes through this barrel, never deep into the files.
 *
 * RULE (inherited from the source repo): the engine (`stmRingCore`) is the
 * load-bearing core — extend it only with no-op-default options; never degrade
 * existing behaviour. New capabilities belong in wrapper components, not the core.
 *
 *   - `stmRingCore`  the framework-agnostic engine (geometry, colour, SVG export,
 *                    deterministic-per-seed shape generation). No React.
 *   - `StmRing`      the live React renderer (rest → hover bloom, `forceSeed`
 *                    glide, `animate` cycling). Pure SVG + rAF.
 *   - `MorphRing`    a standalone finite A→B morph used by dense fields.
 */

export * from "./stmRingCore";
export { default as StmRing } from "./StmRing";
export { default as MorphRing } from "./MorphRing";
