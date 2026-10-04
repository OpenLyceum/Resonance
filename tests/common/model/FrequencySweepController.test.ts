import { NumberProperty, stepTimer } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import { describe, expect, it, vi } from "vitest";
import { FrequencySweepController } from "../../../src/common/model/FrequencySweepController.js";

describe("FrequencySweepController", () => {
  it("preserves a paused sweep and only reports natural completion", () => {
    const frequency = new NumberProperty(1);
    const controller = new FrequencySweepController({
      frequencyProperty: frequency,
      frequencyRange: new Range(1, 3),
      sweepRate: 1,
    });
    const completed = vi.fn();
    controller.sweepCompletedEmitter.addListener(completed);
    try {
      controller.startSweep();
      stepTimer.emit(0.5);
      expect(frequency.value).toBeCloseTo(1.5);
      controller.pauseSweep();
      expect(controller.isSweeping).toBe(true);
      stepTimer.emit(1);
      expect(frequency.value).toBeCloseTo(1.5);
      expect(completed).not.toHaveBeenCalled();
      controller.resumeSweep();
      controller.setSpeedFactor(2);
      expect(completed).not.toHaveBeenCalled();
      stepTimer.emit(0.25);
      expect(frequency.value).toBeCloseTo(2);
      stepTimer.emit(0.5);
      expect(frequency.value).toBe(3);
      expect(controller.isSweeping).toBe(false);
      expect(completed).toHaveBeenCalledTimes(1);
      controller.startSweep();
      controller.stopSweep();
      controller.startSweep();
      controller.reset();
      expect(completed).toHaveBeenCalledTimes(1);
    } finally {
      controller.reset();
    }
  });
});
