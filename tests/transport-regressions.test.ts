import { Property } from "scenerystack/axon";
import { expect, it } from "vitest";
import { ChladniModel } from "../src/chladni-patterns/model/ChladniModel.js";
import { ResonanceModel } from "../src/common/model/ResonanceModel.js";
import { SolverType } from "../src/common/model/SolverType.js";

it("Chladni paused Step moves particles without starting playback", () => {
  const m = new ChladniModel();
  m.isPlayingProperty.value = false;
  const before = m.particlePositions.map((p) => p.copy());
  m.step(1 / 60);
  expect(m.particlePositions.every((p, i) => p.equals(before[i]!))).toBe(true);
  m.step(1 / 60, true);
  const changed = m.particlePositions.filter((p, i) => !p.equals(before[i]!)).length;

  expect(changed).toBeGreaterThan(0);
  expect(m.isPlayingProperty.value).toBe(false);
});
it("zero damping gives zero resonance bandwidth", () => {
  const m = new ResonanceModel({ solverTypeProperty: new Property<SolverType>(SolverType.RUNGE_KUTTA_4) });
  m.dampingProperty.value = 0;

  expect(m.bandwidthProperty.value).toBe(0);
});
