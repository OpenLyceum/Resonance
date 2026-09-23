# AGENTS.md — Resonance

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenLyceum/.github/AGENTS.md](https://github.com/OpenLyceum/.github/blob/main/AGENTS.md).

## Project

Interactive resonance simulation: driven mass-spring systems and Chladni plate patterns.

Educator physics: [`doc/model.md`](doc/model.md). Architecture: [`doc/implementation-notes.md`](doc/implementation-notes.md).

| Screen | Folder | Focus |
|---|---|---|
| Single Oscillator | `src/single-oscillator/` | Driven damped harmonic oscillator |
| Multiple Oscillators | `src/multiple-oscillators/` | 1–10 oscillators with different natural frequencies |
| Phase Analysis | `src/phase-analysis/` | Phase lag and phase-space plots |
| Chladni Patterns | `src/chladni-patterns/` | 2D plate modes, particles on nodal lines |

First three screens share `BaseOscillatorScreenModel` / `BaseOscillatorScreenView`.

## Key files

| Area | Location |
|---|---|
| Oscillator physics | `src/common/model/ResonanceModel.ts`, `BaseModel.ts`; `src/ResonanceConstants.ts` |
| ODE solvers | `src/common/model/{RungeKutta,AdaptiveRK45,Analytical}Solver.ts`, `ODESolver.ts` |
| Frequency sweep | `FrequencySweepController.ts`, `SweepButton.ts` |
| Trace / graph | `OscillatorTraceNode.ts`, `TraceDataModel.ts`, `src/common/view/graph/ConfigurableGraph.ts` |
| Chladni | `src/chladni-patterns/model/`, `src/chladni-patterns/view/`, `ResonanceCurveCalculator.ts`, `ResonanceSonification.ts` |
| Colors / i18n | `ResonanceColors.ts`, `src/i18n/strings_{en,es,fr}.json`, `StringManager.ts` |

## Model

- **Oscillators:** RK4 default (1 ms steps); sub-step callbacks feed smooth phase-space graphs.
  Driving amplitude stored in meters, displayed in cm — check `ResonanceConstants` for ranges.
- **Coordinates:** model Y is up; view Y is down; use `ModelViewTransform2`.
- **Property sync:** use `CircularUpdateGuard` when syncing related properties (e.g. m ↔ cm).
- **Chladni sonification (allowed exception):** `ResonanceSonification.ts` uses a raw
  `setTimeout(…, 30 ms)` after a gain fade — wall-clock teardown, not `stepTimer`, so fade-out
  completes while paused (CONVENTIONS.md §2.9 / §7).
- **Progressive curve precompute (allowed exception):** `ResonanceCurveCalculator.ts` chunks
  resonance-strength lookup across `requestAnimationFrame` with a `computationVersion` guard —
  background precompute, not physics stepping (CONVENTIONS.md §2.9 / §7).

## Accessibility

Follows the shared [OpenLyceum accessibility convention](https://github.com/OpenLyceum/Baton/blob/main/ACCESSIBILITY.md).
`BaseOscillatorScreenView` registers `OscillatorScreenSummaryContent` (shared by the three
oscillator screens); `ChladniScreenView` registers `ChladniScreenSummaryContent`. Both set explicit
`pdomOrder` and live current-details derived from the model. Per-control `accessibleName` /
`accessibleHelpText` and screen-summary strings live under `resonance.a11y` in each locale JSON,
via `StringManager.getA11yStrings()`.

## Compliance carve-outs

- **Root constants:** `src/ResonanceConstants.ts`; domain-specific `ChladniConstants` stays under chladni-patterns.
- **Hardcoded colors:** near-invisible `rgba(0,0,0,0.01)` hit-target fill in `ChladniScreenView.ts`
  (interaction surface, not themed chrome).
- **Domain clock:** `BaseModel` / Chladni playback state machines own play/pause and stepping instead of composing fleet-standard `TimeModel` (`src/common/TimeModel.ts` is present for shared reference only).
- **Vitest environment:** `jsdom` (not the fleet-default `happy-dom`) — canvas/DOM-heavy model tests need it; `tests/setup.ts` + `execArgv: ["--expose-gc"]` are otherwise fleet-standard.
- **Biome `style.noNonNullAssertion: off`:** Chladni WebGL/canvas particle paths use intentional
  non-null assertions; enabling the rule floods lint without improving safety here.


### `package.json` overrides

JSON cannot carry comments, so the rationale for forced transitive pins lives here. Prefer
**tilde (`~`) or exact** versions — caret (`^`) lets minors drift under what is meant to be a
hard pin. Dependabot ignores these three names (see `.github/dependabot.yml`) so it does not
open PRs that fight the overrides. Revisit when SceneryStack drops or re-pins them upstream.

| Override | Pin | Why |
|---|---|---|
| `lodash` | `~4.18.1` | SceneryStack declares `~4.17.12`. Bump clears Dependabot/npm advisories patched in 4.18.x (e.g. GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh). |
| `three` | `~0.125.2` | SceneryStack declares `^0.104.0`. Floor is 0.125.0 for GHSA-fq6p-x6j3-cmmq (ReDoS). Staying on the 0.125 line avoids a larger API jump; **0.125.x still has open CVEs** (e.g. XSS GHSA-7vvq-7r29-5vg3, fixed only in ≥0.137.0). Remove this override if/when SceneryStack stops depending on `three` or pins a patched line itself. LightPropagation keeps a higher `three` pin — do not force 0.125 there. |
| `brace-expansion` | `~5.0.9` | Transitive via `vite-plugin-pwa` / Workbox. Clears npm audit (originally GHSA-mh99-v99m-4gvg; keep ≥5.0.9 for GHSA-rgw5-rvv9-x895). |

## Testing

Fleet-standard Vitest layout (`jsdom`, `tests/setup.ts`, `execArgv: ["--expose-gc"]`):

| Path | Purpose |
|---|---|
| `tests/common/model/ResonanceModel.test.ts` | Core oscillator model |
| `tests/common/model/BaseModel.test.ts` | Shared model base |
| `tests/common/model/ODESolvers.test.ts` | Numerical integrators |
| `tests/common/model/AnalyticalSolver.test.ts` | Analytic reference paths |
| `tests/common/model/SolverType.test.ts` | Solver enumeration |
| `tests/common/model/ResonatorConfigMode.test.ts` | Resonator configuration |
| `tests/common/util/CircularUpdateGuard.test.ts` | Property sync guard |
| `tests/common/util/ListenerTracker.test.ts` | Listener lifecycle |
| `tests/common/ResonanceConstants.test.ts` | Constant ranges / conversions |
| `tests/common/ResonanceColors.test.ts` | Color profile registration |
| `tests/preferences/ResonancePreferencesModel.test.ts` | Preferences model |
| `tests/i18n/StringManager.test.ts` | String accessors |
| `tests/i18n/ResonanceStrings.test.ts` | Locale key parity |
| `tests/memory-leak.test.ts` | WeakRef + `forceGC` dispose regression |
| `tests/fuzz/fuzz.spec.ts` | Playwright fuzz smoke (optional; not default CI) |

Put unit tests only under root `tests/` (never co-locate or use `__tests__/`). Run `npm test`; CI
runs the suite when a `test` script is present.

## Commands

```bash
npm run lint && npm run check && npm run build && npm test
```

`npm run release` intentionally skips `npm test` in some sims — append `&& npm test` before the version bump so a release cannot ship a failing suite.

| Command | Description |
|---|---|
| `npm start` / `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run build:single` | Single-file build mode |
| `npm run check` | TypeScript (main + scripts + test projects) |
| `npm run lint` / `npm run fix` | Biome check / auto-fix |
| `npm test` | Vitest unit tests |
| `npm run test:coverage` | Vitest with coverage |
| `npm run test:fuzz` | Playwright fuzz (60s default) |
| `npm run test:fuzz:quick` | 30s fuzz |
| `npm run test:fuzz:long` | 5 min fuzz |
| `npm run icons` | Regenerate PWA icons |

Fuzz env: `FUZZ_SEED`, `FUZZ_DURATION`.

## Development notes

- **New oscillator screen:** extend `BaseOscillatorScreenModel` / `BaseOscillatorScreenView`;
  register in `main.ts`.
- **Graph layer:** `ConfigurableGraph` + `PlottableProperty` drive phase-space and trace displays.
- **PWA:** after `npm run build`, installable offline via Workbox (`dist/manifest.webmanifest`).
