# Code review — Resonance — 2026-11-16

Reviewed commit: `285ada2db8e8cd54a1d2f5b85702c4673cf210c8`. Working tree was clean at review start.
Selected as one of the ten oldest catalogued simulations by the earliest root commit's author timestamp: `2025-11-02T06:37:04-08:00`. This is source-history age, not GitHub repository-creation age.

## Scope

Oscillator stepping, analytical-solver resynchronization and substeps; shared resonator setup; sweep/playback state; Chladni particle stepping and time controls.

This is a targeted functional code review with broad automated checks, not a full release certification. The findings below describe the reviewed commit. The remediation section records the subsequent corrections.

## Findings

### P2: Make the paused Chladni Step button advance one slice

Location: `src/chladni-patterns/view/ChladniScreenView.ts:609`.

The Step callback calls `ChladniModel.step(STEP_DT)`, which delegates to `ParticleManager.step`. ParticleManager immediately returns when `isPlayingProperty` is false. Since Step is used while paused, it always refreshes an unchanged visualization.

The diagnostic starts a ChladniModel paused, copies all particle positions, and calls the same step method with 1/60 s: zero particles change. This differs from the oscillator screens, which have a forced-step path.

Recommendation: provide an explicit `stepOnce` or forced-step argument through ChladniModel and ParticleManager. Advance one slice while keeping playback paused; test the actual button callback as well as ordinary paused frames.

## Validation

Node v26.13.0. `npm run lint`, `npm run check`, `npm run build`, `npm run check:architecture`, and the existing `npm test` suite pass (469 tests). Local Baton compliance passes with warnings; GitHub security settings could not be read by the checker.

Template drift is pre-existing and separate from the functional findings:

```text
❌ Resonance (3)
   dependency    @biomejs/biome — @biomejs/biome@^2.6.5 ≠ template ^2.6.6
   dependency    vitest — vitest@^5.0.5 ≠ template ^5.1.0
   package       devDependencies — devDependencies order differs from the template (shared entries first, sim-specific after)
```

An additional exploratory probe found `bandwidthProperty` returns Infinity for zero damping. A source search found no current consumer of this property, so this dormant discrepancy is not counted among the six functional findings.

## Reproducer

Temporarily save the following as `tests/review-diagnostic.test.ts`, then run `npm test -- tests/review-diagnostic.test.ts` inside this repository under Node 26. The assertion intentionally fails on the reviewed commit. Remove the temporary test afterward.

```ts
import {it,expect} from "vitest";
import {ChladniModel} from "../src/chladni-patterns/model/ChladniModel.js";
import {Property} from "scenerystack/axon";
import {ResonanceModel} from "../src/common/model/ResonanceModel.js";
import {SolverType} from "../src/common/model/SolverType.js";
it("Chladni paused Step moves particles without starting playback",()=>{
 const m=new ChladniModel();m.isPlayingProperty.value=false;
 const before=m.particlePositions.map(p=>p.copy());
 m.step(1/60);
 const changed=m.particlePositions.filter((p,i)=>!p.equals(before[i]!)).length;
 console.log("changed particles",changed);
 expect(changed).toBeGreaterThan(0);expect(m.isPlayingProperty.value).toBe(false);
});
```

## Limits and retained evidence

No new browser fuzz, live video/camera, heap profiling, manual screen-reader audit, remote dependency audit, or educator sign-off was performed in this review. Unit mocks and source tracing do not substitute for these checks. The November 15 fleet-fuzz results in the superproject review log are prior evidence, not a new browser run.

Validation logs and original diagnostic sources/output are retained locally in `/tmp/oldest-review/`; temporary evidence may be removed by the system. This report preserves the actionable reproducers.


## Remediation — 2026-11-16

The Chladni button now forces one particle step while keeping playback paused. Ordinary paused frames remain stationary. The dormant zero-damping bandwidth calculation now returns zero rather than Infinity.

Permanent regression coverage: `tests/transport-regressions.test.ts`. The historical diagnostic above describes the original failure; use the permanent regression suite to validate the corrected transport path.

Aligned template-owned configuration and shared dependency declarations with SceneryStackTemplate: Biome ^2.6.6, its 2.6.6 schema and locked executable, dependency ordering, and Resonance’s Vitest declaration where applicable. Preserved documented per-simulation configuration exceptions.

Final validation and commit identifiers are recorded in the superproject’s `review-log.md`.
