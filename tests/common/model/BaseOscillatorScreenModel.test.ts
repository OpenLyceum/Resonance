import { describe, expect, it } from "vitest";
import { BaseOscillatorScreenModel } from "../../../src/common/model/BaseOscillatorScreenModel.js";
import { SolverType } from "../../../src/common/model/SolverType.js";
import { ResonancePreferencesModel } from "../../../src/preferences/ResonancePreferencesModel.js";

describe("shared oscillator driver", () => {
  it.each(Object.values(SolverType))("keeps dragged and inactive oscillators aligned with %s", (solverType) => {
    const preferences = new ResonancePreferencesModel();
    preferences.solverTypeProperty.value = solverType;
    const screen = new BaseOscillatorScreenModel(preferences);
    const reference = screen.resonanceModel;
    reference.drivingEnabledProperty.value = true;
    reference.drivingFrequencyProperty.value = 2;
    screen.resonatorCountProperty.value = 2;
    screen.step(0.02);
    const second = screen.getResonatorModel(1);
    const position = second.positionProperty.value;
    const velocity = second.velocityProperty.value;
    second.isDraggingProperty.value = true;
    screen.step(0.02);
    expect(second.positionProperty.value).toBe(position);
    expect(second.velocityProperty.value).toBe(velocity);
    expect(second.drivingPhaseProperty.value).toBeCloseTo(reference.drivingPhaseProperty.value, 12);
    second.isDraggingProperty.value = false;
    screen.step(0.02);
    expect(second.drivingPhaseProperty.value).toBeCloseTo(reference.drivingPhaseProperty.value, 12);
    reference.isDraggingProperty.value = true;
    const phase = reference.drivingPhaseProperty.value;
    screen.step(0.02);
    expect(reference.drivingPhaseProperty.value).toBeGreaterThan(phase);
    expect(second.drivingPhaseProperty.value).toBeCloseTo(reference.drivingPhaseProperty.value, 12);
    reference.isDraggingProperty.value = false;
    screen.resonatorCountProperty.value = 1;
    reference.isPlayingProperty.value = false;
    screen.step(0.016, true);
    expect(second.drivingPhaseProperty.value).toBeCloseTo(reference.drivingPhaseProperty.value, 12);
    screen.resonatorCountProperty.value = 3;
    reference.isPlayingProperty.value = true;
    screen.step(0.02);
    for (const model of screen.resonatorModels) {
      expect(model.drivingPhaseProperty.value).toBeCloseTo(reference.drivingPhaseProperty.value, 12);
    }
  });

  it("does not disable driving or playback when sweep speed changes", () => {
    const screen = new BaseOscillatorScreenModel(new ResonancePreferencesModel());
    try {
      screen.startSweep();
      screen.resonanceModel.timeSpeedProperty.value = "slow";
      expect(screen.isPlayingProperty.value).toBe(true);
      expect(screen.resonanceModel.drivingEnabledProperty.value).toBe(true);
      screen.isPlayingProperty.value = false;
      expect(screen.sweepController.isSweeping).toBe(true);
      expect(screen.resonanceModel.drivingEnabledProperty.value).toBe(true);
      screen.isPlayingProperty.value = true;
      expect(screen.sweepController.isSweeping).toBe(true);
    } finally {
      screen.stopSweep();
    }
  });
});
