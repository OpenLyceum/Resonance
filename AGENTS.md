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
| Keyboard | `ChladniHotkeyData.ts` (shared by `ChladniScreenView`'s global `KeyboardListener` and `ChladniKeyboardHelpContent`); oscillator screens use `ResonanceKeyboardHelpContent` |
| Colors / i18n | `ResonanceColors.ts`, `src/i18n/strings_{en,es,fr}.json`, `StringManager.ts` |

## Model

- **Oscillators:** RK4 default (1 ms steps); sub-step callbacks feed smooth phase-space graphs.
  Driving amplitude stored in meters, displayed in cm — check `ResonanceConstants` for ranges.
- **Coordinates:** model Y is up; view Y is down; use `ModelViewTransform2`.
- **Property sync:** use `CircularUpdateGuard` when syncing related properties (e.g. m ↔ cm).
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
- **Domain clock:** `BaseModel` / Chladni playback state machines own play/pause and stepping instead of composing fleet-standard `TimeModel`.
- **Template drift (Baton `check-template-drift.sh`):** `biome.json` turns off `noNonNullAssertion` (below).
- **Biome `style.noNonNullAssertion: off`:** Chladni WebGL/canvas particle paths use intentional
  non-null assertions; enabling the rule floods lint without improving safety here.

## Testing

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

`npm run test:coverage` runs Vitest with coverage. The other scripts are the fleet set in `.github/AGENTS.md`.

## Development notes

- **New oscillator screen:** extend `BaseOscillatorScreenModel` / `BaseOscillatorScreenView`;
  register in `main.ts`.
- **Graph layer:** `ConfigurableGraph` + `PlottableProperty` drive phase-space and trace displays.