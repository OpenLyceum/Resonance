# Implementation Notes - Resonance

Developer-facing notes on the architecture. The physics itself is documented for educators in
[model.md](./model.md).

## Architecture Overview

Resonance is a four-screen SceneryStack simulation. The first three screens share oscillator
infrastructure; Chladni is a separate model/view stack.

```
main.ts
  ├─ SingleOscillatorScreen      BaseOscillatorScreenModel + BaseOscillatorScreenView
  ├─ MultipleOscillatorsScreen
  ├─ PhaseAnalysisScreen         + phase-space / trace graph emphasis
  └─ ChladniScreen               ChladniModel + ChladniScreenView (independent)

src/common/model/
  ├─ BaseModel.ts                time control, dt capping, solver strategy
  ├─ ResonanceModel.ts           single driven damped oscillator (state + derived analytics)
  ├─ BaseOscillatorScreenModel.ts  1–10 ResonanceModel instances, sweep, shared driver params
  ├─ RungeKuttaSolver.ts, AdaptiveRK45Solver.ts, AnalyticalSolver.ts
  ├─ FrequencySweepController.ts, TraceDataModel.ts, MeasurementLineModel.ts
  └─ ResonanceConstants.ts       physics ranges, layout, sweep rate

src/common/view/
  ├─ BaseOscillatorScreenView.ts   driver plate, springs, masses, ruler, control panel
  ├─ OscillatorScreenSummaryContent.ts
  └─ graph/ConfigurableGraph.ts, PlottableProperty.ts

src/chladni-patterns/
  ├─ model/ChladniModel.ts       coordinates ModalCalculator, ParticleManager, sweep, curve cache
  └─ view/                       Canvas/WebGL renderers, sonification, control panel
```

Data flows Model → View through AXON `Property` objects. Model +y is up; views subtract through
`ModelViewTransform2`.

## Key design decisions

- **Displacement-driven forcing.** `ResonanceModel.getDerivatives` uses F_drive = k·A·sin(phase),
  not an independent force amplitude — stiffer springs drive harder at the same plate displacement.
- **CircularUpdateGuard.** Syncing related UI properties (e.g. cm display ↔ meters storage) uses the
  guard to prevent feedback loops.
- **Shared driver, per-resonator m/k.** `BaseOscillatorScreenModel` distributes natural frequencies
  1.0–5.5 Hz across N oscillators per configuration mode.
- **Chladni exceptions (documented in AGENTS.md).**
  - `ResonanceSonification.ts`: raw `setTimeout` after Web Audio gain fade (wall-clock, not sim time).
  - `ResonanceCurveCalculator.ts`: progressive precompute via `requestAnimationFrame` with version
    guard — background cache only, never partial reads in physics.
- **Nested constants carve-out.** Shared + per-screen constants under `src/common/` and screen
  folders; no single root constants file beyond `ResonanceConstants.ts`.

## Numerical integration

| Solver | Key | Default |
|---|---|---|
| RK4 | `rk4` | **yes** — 1 ms fixed step |
| Adaptive RK45 | `adaptiveRK45` | optional |
| Analytical | `analytical` | closed-form check |

`BaseModel` caps frame dt at 100 ms and sub-steps large deltas. Sub-step callbacks (decimation 4)
feed smooth phase-space graphs on the Phase Analysis screen.

## Common components

- `ResonanceColors.ts` — `ProfileColorProperty` palette (Chladni has one hardcoded near-invisible
  hit-target fill carve-out in `ChladniScreenView.ts`).
- `OscillatorControlPanel` — presets combo (`ResonancePresets`), parameter controls, sweep button.
- `StringManager.getA11yStrings()` — shared oscillator a11y; Chladni has `ChladniScreenSummaryContent`.

## Testing

```bash
npm test                  # Vitest unit tests (ResonanceModel, BaseModel, …)
npm run test:fuzz:quick   # Playwright fuzz smoke (optional)
```

Key invariants tested: f₀ = (1/2π)√(k/m), critical damping b = 2√(mk), solver agreement,
energy behavior without drive/damping.

## Multi-screen pattern

Oscillator screens extend base model/view; Chladni does not. Register new screens in `main.ts`;
add locale keys and summary content. See `doc/multi-screen.md`.

## Related docs

- [model.md](./model.md) — educator physics guide
- [AGENTS.md](../AGENTS.md) — sim-specific AI context and pitfall list
