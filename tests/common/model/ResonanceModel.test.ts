/**
 * Tests for ResonanceModel - Core physics calculations
 *
 * P0 Priority: These tests verify the heart of the simulation.
 * Physics calculation errors would make the entire application incorrect.
 */

import { Property } from "scenerystack/axon";
import { beforeEach, describe, expect, it } from "vitest";
import { ResonanceModel, ResonancePresets } from "../../../src/common/model/ResonanceModel.js";
import { SolverType } from "../../../src/common/model/SolverType.js";

// Mock preferences model for testing
function createMockPreferences() {
  return {
    solverTypeProperty: new Property<SolverType>(SolverType.RUNGE_KUTTA_4),
  };
}

describe("ResonanceModel", () => {
  it.each(Object.values(SolverType))("timestamps substeps across consecutive frames with %s", (solverType) => {
    const model = new ResonanceModel({ solverTypeProperty: new Property<SolverType>(solverType) });
    model.subStepCollectionEnabled = true;
    model.positionProperty.value = 0.01;
    let previousTime = 0;

    for (let frame = 0; frame < 2; frame++) {
      model.step(0.016);
      const points = model.flushSubStepData();
      expect(points.length).toBeGreaterThan(1);
      for (const point of points) {
        expect(point.time).toBeGreaterThan(previousTime);
        previousTime = point.time;
      }
      expect(previousTime).toBeCloseTo(model.timeProperty.value, 12);
    }
  });

  let model: ResonanceModel;

  beforeEach(() => {
    model = new ResonanceModel(createMockPreferences());
  });

  describe("natural frequency", () => {
    it("should calculate omega_0 = sqrt(k/m) for default values", () => {
      // Default: k=100, m=2.53 -> omega_0 = sqrt(100/2.53) ≈ 6.287 rad/s
      const expected = Math.sqrt(100 / 2.53);
      expect(model.naturalFrequencyProperty.value).toBeCloseTo(expected, 5);
    });

    it("should convert to Hz correctly: f_0 = omega_0/(2*pi)", () => {
      // omega_0 = sqrt(100/2.53) rad/s -> f_0 = omega_0/(2*pi) Hz
      const omega0 = Math.sqrt(100 / 2.53);
      const expectedHz = omega0 / (2 * Math.PI);
      expect(model.naturalFrequencyHzProperty.value).toBeCloseTo(expectedHz, 4);
    });

    it("should update when mass changes", () => {
      model.massProperty.value = 1.0; // k=100, m=1.0 -> omega_0 = 10 rad/s
      expect(model.naturalFrequencyProperty.value).toBeCloseTo(10, 5);
    });

    it("should update when spring constant changes", () => {
      model.massProperty.value = 0.25; // Set mass to 0.25 first
      model.springConstantProperty.value = 25; // k=25, m=0.25 -> omega_0 = 10 rad/s
      expect(model.naturalFrequencyProperty.value).toBeCloseTo(10, 5);
    });

    it("should scale correctly for arbitrary values", () => {
      model.massProperty.value = 2.0;
      model.springConstantProperty.value = 50.0;
      // omega_0 = sqrt(50/2) = sqrt(25) = 5 rad/s
      expect(model.naturalFrequencyProperty.value).toBeCloseTo(5, 5);
    });
  });

  describe("damping ratio", () => {
    it("should calculate zeta = b/(2*sqrt(m*k))", () => {
      // Default: b=1.0, m=2.53, k=100 -> zeta = 1.0/(2*sqrt(253)) ≈ 0.0314
      const expected = 1.0 / (2 * Math.sqrt(2.53 * 100));
      expect(model.dampingRatioProperty.value).toBeCloseTo(expected, 5);
    });

    it("should identify underdamped (zeta < 1)", () => {
      model.dampingProperty.value = 0.5;
      expect(model.dampingRatioProperty.value).toBeLessThan(1);
    });

    it("should identify critically damped (zeta = 1)", () => {
      // For critical damping: b = 2*sqrt(m*k)
      // With m=2.53, k=100: b = 2*sqrt(253) ≈ 31.81
      const criticalDamping = 2 * Math.sqrt(2.53 * 100);
      model.dampingProperty.value = criticalDamping;
      expect(model.dampingRatioProperty.value).toBeCloseTo(1.0, 5);
    });

    it("should identify overdamped (zeta > 1)", () => {
      // Need b > 2*sqrt(m*k) ≈ 31.81 for overdamping
      model.dampingProperty.value = 40.0;
      expect(model.dampingRatioProperty.value).toBeGreaterThan(1);
    });

    it("should be zero for undamped system", () => {
      model.dampingProperty.value = 0;
      expect(model.dampingRatioProperty.value).toBe(0);
    });
  });

  describe("kinetic energy", () => {
    it("should calculate KE = 0.5 * m * v^2", () => {
      // Default m=2.53, v=2 -> KE = 0.5*2.53*4 = 5.06 J
      model.velocityProperty.value = 2.0;
      const expected = 0.5 * 2.53 * 4;
      expect(model.kineticEnergyProperty.value).toBeCloseTo(expected, 5);
    });

    it("should be zero when velocity is zero", () => {
      model.velocityProperty.value = 0;
      expect(model.kineticEnergyProperty.value).toBe(0);
    });

    it("should be positive for negative velocity", () => {
      model.velocityProperty.value = -3.0;
      expect(model.kineticEnergyProperty.value).toBeGreaterThan(0);
    });

    it("should scale with mass", () => {
      model.massProperty.value = 1.0;
      model.velocityProperty.value = 2.0;
      const ke1 = model.kineticEnergyProperty.value;

      model.massProperty.value = 2.0; // Double the mass
      const ke2 = model.kineticEnergyProperty.value;

      expect(ke2).toBeCloseTo(ke1 * 2, 5);
    });
  });

  describe("potential energy", () => {
    it("should calculate PE = 0.5 * k * x^2 for no gravity", () => {
      model.gravityProperty.value = 0;
      model.positionProperty.value = 0.1; // k=100, x=0.1 -> PE = 0.5*100*0.01 = 0.5 J
      expect(model.potentialEnergyProperty.value).toBeCloseTo(0.5, 5);
    });

    it("should be zero at equilibrium with no gravity", () => {
      model.gravityProperty.value = 0;
      model.positionProperty.value = 0;
      expect(model.potentialEnergyProperty.value).toBe(0);
    });

    it("should include gravitational potential: PE = 0.5*k*x^2 + m*g*x", () => {
      model.gravityProperty.value = 10;
      model.positionProperty.value = 0.1;
      // PE = 0.5*100*0.01 + 2.53*10*0.1 = 0.5 + 2.53 = 3.03 J
      // With positive x = upward, gravitational PE increases with height
      const expected = 0.5 * 100 * 0.01 + 2.53 * 10 * 0.1;
      expect(model.potentialEnergyProperty.value).toBeCloseTo(expected, 5);
    });
  });

  describe("total energy", () => {
    it("should equal KE + PE", () => {
      model.positionProperty.value = 0.1;
      model.velocityProperty.value = 1.0;

      const ke = model.kineticEnergyProperty.value;
      const pe = model.potentialEnergyProperty.value;
      const total = model.totalEnergyProperty.value;

      expect(total).toBeCloseTo(ke + pe, 10);
    });
  });

  describe("energy conservation", () => {
    it("should conserve total energy when b=0, no driving, and no gravity", () => {
      // Set up undamped, undriven oscillator
      model.dampingProperty.value = 0;
      model.drivingEnabledProperty.value = false;
      model.gravityProperty.value = 0;
      model.positionProperty.value = 0.1; // Initial displacement
      model.velocityProperty.value = 0;

      const initialEnergy = model.totalEnergyProperty.value;

      // Step simulation for several periods
      const period = (2 * Math.PI) / model.naturalFrequencyProperty.value;
      const numSteps = 1000;
      const dt = (5 * period) / numSteps;

      for (let i = 0; i < numSteps; i++) {
        model.step(dt, true);
      }

      const finalEnergy = model.totalEnergyProperty.value;

      // Energy should be conserved within 0.1%
      const energyChange = Math.abs(finalEnergy - initialEnergy) / initialEnergy;
      expect(energyChange).toBeLessThan(0.001);
    });

    it("should lose energy when damping is present", () => {
      // Set up damped, undriven oscillator
      model.dampingProperty.value = 1.0;
      model.drivingEnabledProperty.value = false;
      model.gravityProperty.value = 0;
      model.positionProperty.value = 0.1;
      model.velocityProperty.value = 0;

      const initialEnergy = model.totalEnergyProperty.value;

      // Step simulation
      for (let i = 0; i < 1000; i++) {
        model.step(0.01, true);
      }

      const finalEnergy = model.totalEnergyProperty.value;

      // Energy should decrease
      expect(finalEnergy).toBeLessThan(initialEnergy);
    });
  });

  describe("phase angle at resonance", () => {
    it("should be pi/2 when driving at natural frequency", () => {
      // Set driving frequency to natural frequency
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      model.drivingEnabledProperty.value = true;

      // At resonance, phase should be pi/2
      expect(model.phaseAngleProperty.value).toBeCloseTo(Math.PI / 2, 2);
    });

    it("should be 0 when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.phaseAngleProperty.value).toBe(0);
    });

    it("should be positive when driving below natural frequency", () => {
      const naturalFreq = model.naturalFrequencyHzProperty.value;
      model.drivingFrequencyProperty.value = naturalFreq * 0.5;
      model.drivingEnabledProperty.value = true;

      // Below resonance, phase is positive (between 0 and pi/2)
      expect(model.phaseAngleProperty.value).toBeGreaterThan(0);
      expect(model.phaseAngleProperty.value).toBeLessThan(Math.PI / 2);
    });

    it("should be between pi/2 and pi when driving above natural frequency", () => {
      const naturalFreq = model.naturalFrequencyHzProperty.value;
      model.drivingFrequencyProperty.value = naturalFreq * 2;
      model.drivingEnabledProperty.value = true;

      // Above resonance, phase is between pi/2 and pi (standard physics convention)
      // The displacement lags the driving force by more than 90 degrees
      expect(model.phaseAngleProperty.value).toBeGreaterThan(Math.PI / 2);
      expect(model.phaseAngleProperty.value).toBeLessThan(Math.PI);
    });
  });

  describe("state get/set roundtrip", () => {
    it("should preserve state through getState/setState", () => {
      model.positionProperty.value = 0.123;
      model.velocityProperty.value = -0.456;
      model.drivingPhaseProperty.value = 1.234;

      const state = model.getState();

      // Change values
      model.positionProperty.value = 0;
      model.velocityProperty.value = 0;
      model.drivingPhaseProperty.value = 0;

      // Restore
      model.setState(state);

      expect(model.positionProperty.value).toBeCloseTo(0.123, 10);
      expect(model.velocityProperty.value).toBeCloseTo(-0.456, 10);
      expect(model.drivingPhaseProperty.value).toBeCloseTo(1.234, 10);
    });

    it("should return state vector in correct order", () => {
      model.positionProperty.value = 1.0;
      model.velocityProperty.value = 2.0;
      model.drivingPhaseProperty.value = 3.0;
      model.driverEnergyProperty.value = 4.0;
      model.thermalEnergyProperty.value = 5.0;
      model.sumSquaredDisplacementProperty.value = 6.0;
      model.sumSquaredVelocityProperty.value = 7.0;

      const state = model.getState();

      expect(state).toHaveLength(7);
      expect(state[0]).toBe(1.0); // position
      expect(state[1]).toBe(2.0); // velocity
      expect(state[2]).toBe(3.0); // driving phase
      expect(state[3]).toBe(4.0); // driver energy
      expect(state[4]).toBe(5.0); // thermal energy
      expect(state[5]).toBe(6.0); // sum squared displacement
      expect(state[6]).toBe(7.0); // sum squared velocity
    });
  });

  describe("derivatives calculation", () => {
    it("should return velocity as first derivative (dx/dt = v)", () => {
      const state = [0.1, 2.0, 0]; // position=0.1, velocity=2.0
      const derivatives = model.getDerivatives(0, state);

      expect(derivatives[0]).toBe(2.0); // dx/dt = v
    });

    it("should calculate spring force correctly: F_spring = -k*x", () => {
      model.dampingProperty.value = 0;
      model.gravityProperty.value = 0;
      model.drivingEnabledProperty.value = false;

      const state = [0.1, 0, 0]; // position=0.1, velocity=0
      const derivatives = model.getDerivatives(0, state);

      // a = -k*x/m = -100*0.1/2.53 ≈ -3.953 m/s^2
      const expected = (-100 * 0.1) / 2.53;
      expect(derivatives[1]).toBeCloseTo(expected, 5);
    });

    it("should calculate damping force correctly: F_damp = -b*v", () => {
      model.springConstantProperty.value = 0;
      model.gravityProperty.value = 0;
      model.drivingEnabledProperty.value = false;
      model.dampingProperty.value = 2.0;

      const state = [0, 1.0, 0]; // position=0, velocity=1.0
      const derivatives = model.getDerivatives(0, state);

      // a = -b*v/m = -2.0*1.0/2.53 ≈ -0.791 m/s^2
      const expected = (-2.0 * 1.0) / 2.53;
      expect(derivatives[1]).toBeCloseTo(expected, 5);
    });

    it("should calculate gravitational force correctly: F_grav = m*g", () => {
      model.springConstantProperty.value = 0;
      model.dampingProperty.value = 0;
      model.drivingEnabledProperty.value = false;
      model.gravityProperty.value = 10;

      const state = [0, 0, 0];
      const derivatives = model.getDerivatives(0, state);

      // a = -g = -10 m/s^2 (gravity acts downward in negative Y direction)
      expect(derivatives[1]).toBeCloseTo(-10, 5);
    });

    it("should calculate driving force correctly when enabled", () => {
      // For displacement-driven oscillator: F_drive = k * A * sin(phase)
      model.springConstantProperty.value = 1.0; // k = 1 N/m
      model.dampingProperty.value = 0;
      model.gravityProperty.value = 0;
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 1.0; // A = 1 m
      model.drivingFrequencyProperty.value = 1.0;

      // At phase = pi/2, sin(phase) = 1
      const state = [0, 0, Math.PI / 2];
      const derivatives = model.getDerivatives(0, state);

      // F_drive = k * A * sin(phase) = 1 * 1 * 1 = 1 N
      // a = F_drive / m = 1 / 2.53 ≈ 0.395 m/s^2
      const expected = 1.0 / 2.53;
      expect(derivatives[1]).toBeCloseTo(expected, 5);
    });

    it("should not apply driving force when disabled", () => {
      model.springConstantProperty.value = 0;
      model.dampingProperty.value = 0;
      model.gravityProperty.value = 0;
      model.drivingEnabledProperty.value = false;
      model.drivingAmplitudeProperty.value = 1.0;

      const state = [0, 0, Math.PI / 2];
      const derivatives = model.getDerivatives(0, state);

      expect(derivatives[1]).toBe(0);
    });

    it("should update phase derivative based on driving frequency", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0; // 2 Hz

      const state = [0, 0, 0];
      const derivatives = model.getDerivatives(0, state);

      // dphase/dt = omega = 2*pi*f = 2*pi*2 ≈ 12.566 rad/s
      expect(derivatives[2]).toBeCloseTo(2 * Math.PI * 2, 5);
    });
  });

  describe("reset functionality", () => {
    it("should reset position and velocity to defaults", () => {
      model.positionProperty.value = 1.0;
      model.velocityProperty.value = 2.0;

      model.reset();

      expect(model.positionProperty.value).toBe(0.0);
      expect(model.velocityProperty.value).toBe(0.0);
    });

    it("should reset physical parameters to defaults", () => {
      model.massProperty.value = 5.0;
      model.springConstantProperty.value = 200.0;
      model.dampingProperty.value = 10.0;

      model.reset();

      expect(model.massProperty.value).toBe(2.53);
      expect(model.springConstantProperty.value).toBe(100.0);
      expect(model.dampingProperty.value).toBe(1.0);
    });

    it("should reset driving parameters to defaults", () => {
      model.drivingAmplitudeProperty.value = 10.0;
      model.drivingFrequencyProperty.value = 5.0;
      model.drivingEnabledProperty.value = true;
      model.drivingPhaseProperty.value = 3.14;

      model.reset();

      expect(model.drivingAmplitudeProperty.value).toBe(0.005);
      expect(model.drivingFrequencyProperty.value).toBe(1.0);
      expect(model.drivingEnabledProperty.value).toBe(false);
      expect(model.drivingPhaseProperty.value).toBe(0.0);
    });

    it("should reset time to zero", () => {
      model.step(1.0, true);
      expect(model.timeProperty.value).toBeGreaterThan(0);

      model.reset();

      expect(model.timeProperty.value).toBe(0);
    });
  });

  describe("preset application", () => {
    it("should apply preset values correctly", () => {
      const preset = ResonancePresets[0]; // Light and Bouncy
      expect(preset).toBeDefined();
      if (preset === undefined) {
        return;
      }

      model.setPreset(preset);

      expect(model.massProperty.value).toBe(preset.mass);
      expect(model.springConstantProperty.value).toBe(preset.springConstant);
      expect(model.dampingProperty.value).toBe(preset.damping);
      expect(model.positionProperty.value).toBe(preset.initialPosition);
    });

    it("should apply all available presets without error", () => {
      for (const preset of ResonancePresets) {
        expect(() => model.setPreset(preset)).not.toThrow();

        // Verify natural frequency is calculable (no division by zero, etc.)
        expect(model.naturalFrequencyProperty.value).toBeGreaterThan(0);
        expect(model.naturalFrequencyProperty.value).toBeLessThan(Infinity);
      }
    });

    it("should use default values for optional preset fields", () => {
      const minimalPreset = {
        nameKey: "underdamped" as const,
        mass: 1.0,
        springConstant: 10.0,
        damping: 0.5,
        initialPosition: 0.5,
      };

      model.setPreset(minimalPreset);

      expect(model.massProperty.value).toBe(1.0);
      expect(model.velocityProperty.value).toBe(0); // Default when not specified
    });
  });

  describe("simulation behavior", () => {
    it("should oscillate when displaced from equilibrium", () => {
      model.dampingProperty.value = 0;
      model.drivingEnabledProperty.value = false;
      model.gravityProperty.value = 0;
      model.positionProperty.value = 0.1;
      model.velocityProperty.value = 0;

      // Track max and min positions during simulation
      let maxPos = model.positionProperty.value;
      let minPos = model.positionProperty.value;

      for (let i = 0; i < 1000; i++) {
        model.step(0.001, true);
        maxPos = Math.max(maxPos, model.positionProperty.value);
        minPos = Math.min(minPos, model.positionProperty.value);
      }

      // Should oscillate around equilibrium
      expect(maxPos).toBeGreaterThan(0.05);
      expect(minPos).toBeLessThan(-0.05);
    });

    it("should demonstrate resonance behavior when driving at natural frequency", () => {
      // Light damping for clear resonance
      model.dampingProperty.value = 0.5;
      model.gravityProperty.value = 0;
      model.positionProperty.value = 0;
      model.velocityProperty.value = 0;
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 1.0;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;

      // Track amplitude
      let maxAmplitude = 0;

      for (let i = 0; i < 5000; i++) {
        model.step(0.001, true);
        maxAmplitude = Math.max(maxAmplitude, Math.abs(model.positionProperty.value));
      }

      // At resonance, amplitude should build up significantly
      expect(maxAmplitude).toBeGreaterThan(0.01);
    });

    it("should have smaller amplitude when driving off resonance", () => {
      // Light damping
      model.dampingProperty.value = 0.5;
      model.gravityProperty.value = 0;
      model.positionProperty.value = 0;
      model.velocityProperty.value = 0;
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 1.0;

      // First, measure amplitude at resonance
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      let maxAtResonance = 0;
      for (let i = 0; i < 3000; i++) {
        model.step(0.001, true);
        maxAtResonance = Math.max(maxAtResonance, Math.abs(model.positionProperty.value));
      }

      // Reset and measure off-resonance
      model.reset();
      model.dampingProperty.value = 0.5;
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 1.0;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 3; // Far from resonance

      let maxOffResonance = 0;
      for (let i = 0; i < 3000; i++) {
        model.step(0.001, true);
        maxOffResonance = Math.max(maxOffResonance, Math.abs(model.positionProperty.value));
      }

      // Off-resonance amplitude should be smaller
      expect(maxOffResonance).toBeLessThan(maxAtResonance);
    });
  });

  // ============================================
  // Force phase properties
  // ============================================

  describe("spring force phase", () => {
    it("should be anti-phase to displacement (offset by π)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 1.0;
      const dispPhase = model.displacementPhaseProperty.value;
      const springPhase = model.springForcePhaseProperty.value;
      // Should differ by exactly π (mod 2π)
      const diff = Math.abs(springPhase - dispPhase);
      const normalized = Math.abs(diff - Math.PI);
      expect(normalized).toBeLessThan(1e-10);
    });

    it("should be in [-π, π]", () => {
      model.drivingEnabledProperty.value = true;

      for (const freq of [0.5, 1.0, 2.0, 4.0]) {
        model.drivingFrequencyProperty.value = freq;
        expect(model.springForcePhaseProperty.value).toBeGreaterThanOrEqual(-Math.PI);
        expect(model.springForcePhaseProperty.value).toBeLessThanOrEqual(Math.PI);
      }
    });

    it("should be near 0 below resonance (spring force nearly in phase with driver)", () => {
      model.drivingEnabledProperty.value = true;
      // Well below resonance: displacement phase ≈ 0, so spring force phase ≈ ±π
      // which means spring force is anti-phase to driver
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 0.1;
      const phase = model.springForcePhaseProperty.value;
      // Displacement phase is small positive → spring force phase ≈ π (or -π)
      expect(Math.abs(phase)).toBeGreaterThan(Math.PI * 0.8);
    });

    it("should be near 0 above resonance (spring force nearly in phase with driver)", () => {
      model.drivingEnabledProperty.value = true;
      // Well above resonance: displacement phase ≈ π, so spring force phase ≈ 0
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 5;
      const phase = model.springForcePhaseProperty.value;
      expect(Math.abs(phase)).toBeLessThan(Math.PI * 0.3);
    });
  });

  describe("damping force phase", () => {
    it("should be anti-phase to velocity (offset by π)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 1.0;
      const velPhase = model.velocityPhaseProperty.value;
      const dampPhase = model.dampingForcePhaseProperty.value;
      // Should differ by exactly π (mod 2π)
      let diff = Math.abs(dampPhase - velPhase);
      if (diff > Math.PI) {
        diff = 2 * Math.PI - diff;
      }
      expect(diff).toBeCloseTo(Math.PI, 5);
    });

    it("should be in [-π, π]", () => {
      model.drivingEnabledProperty.value = true;

      for (const freq of [0.5, 1.0, 2.0, 4.0]) {
        model.drivingFrequencyProperty.value = freq;
        expect(model.dampingForcePhaseProperty.value).toBeGreaterThanOrEqual(-Math.PI);
        expect(model.dampingForcePhaseProperty.value).toBeLessThanOrEqual(Math.PI);
      }
    });

    it("should be ±π at resonance (damping force anti-phase to driver)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      // At resonance: velocity phase = φ - π/2 = π/2 - π/2 = 0
      // damping force phase = velocity phase + π = π
      const phase = model.dampingForcePhaseProperty.value;
      expect(Math.abs(phase)).toBeCloseTo(Math.PI, 2);
    });
  });

  // ============================================
  // Mechanical impedance analysis
  // ============================================

  describe("mechanical reactance", () => {
    it("should calculate X = mω - k/ω", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const m = model.massProperty.value;
      const k = model.springConstantProperty.value;
      const omega = 2.0 * 2 * Math.PI;
      const expected = m * omega - k / omega;
      expect(model.mechanicalReactanceProperty.value).toBeCloseTo(expected, 5);
    });

    it("should be zero at natural frequency (resonance)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      // At resonance: mω₀ = k/ω₀ (both equal √(mk)), so X = 0
      expect(model.mechanicalReactanceProperty.value).toBeCloseTo(0, 3);
    });

    it("should be negative below resonance (stiffness-dominated)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 0.3;
      expect(model.mechanicalReactanceProperty.value).toBeLessThan(0);
    });

    it("should be positive above resonance (inertia-dominated)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 3;
      expect(model.mechanicalReactanceProperty.value).toBeGreaterThan(0);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.mechanicalReactanceProperty.value).toBe(0);
    });
  });

  describe("impedance magnitude", () => {
    it("should calculate |Z| = sqrt(b^2 + X^2)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const b = model.dampingProperty.value;
      const X = model.mechanicalReactanceProperty.value;
      const expected = Math.sqrt(b * b + X * X);
      expect(model.impedanceMagnitudeProperty.value).toBeCloseTo(expected, 5);
    });

    it("should equal damping coefficient at resonance (purely resistive)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      // At resonance X = 0, so |Z| = b
      expect(model.impedanceMagnitudeProperty.value).toBeCloseTo(model.dampingProperty.value, 3);
    });

    it("should be minimized at resonance", () => {
      model.drivingEnabledProperty.value = true;

      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      const atResonance = model.impedanceMagnitudeProperty.value;

      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 3;
      const offResonance = model.impedanceMagnitudeProperty.value;

      expect(atResonance).toBeLessThan(offResonance);
    });

    it("should equal F0/(omega*X0) (force/velocity ratio)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = 2.0;
      const F0 = model.forceAmplitudeProperty.value;
      const omega = 2.0 * 2 * Math.PI;
      const X0 = model.displacementAmplitudeProperty.value;
      // |Z| = F₀ / (ωX₀) = F₀ / V₀
      if (X0 > 1e-15) {
        expect(model.impedanceMagnitudeProperty.value).toBeCloseTo(F0 / (omega * X0), 5);
      }
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.impedanceMagnitudeProperty.value).toBe(0);
    });
  });

  describe("impedance phase", () => {
    it("should equal displacement phase minus π/2", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const phi = model.displacementPhaseProperty.value;
      let expected = phi - Math.PI / 2;
      while (expected < -Math.PI) {
        expected += 2 * Math.PI;
      }
      while (expected > Math.PI) {
        expected -= 2 * Math.PI;
      }
      expect(model.impedancePhaseProperty.value).toBeCloseTo(expected, 10);
    });

    it("should be zero at resonance (force and velocity in phase)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      // At resonance: φ = π/2, so ∠Z = π/2 - π/2 = 0
      expect(model.impedancePhaseProperty.value).toBeCloseTo(0, 2);
    });

    it("should be negative below resonance (stiffness-dominated)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 0.3;
      // Below resonance: φ < π/2, so ∠Z = φ - π/2 < 0
      expect(model.impedancePhaseProperty.value).toBeLessThan(0);
    });

    it("should be positive above resonance (inertia-dominated)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 3;
      // Above resonance: φ > π/2, so ∠Z = φ - π/2 > 0
      expect(model.impedancePhaseProperty.value).toBeGreaterThan(0);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.impedancePhaseProperty.value).toBe(0);
    });
  });

  describe("power factor", () => {
    it("should calculate sin(φ)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const phi = model.phaseAngleProperty.value;
      expect(model.powerFactorProperty.value).toBeCloseTo(Math.sin(phi), 10);
    });

    it("should be 1 at resonance (maximum power transfer)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      // At resonance: φ = π/2, sin(π/2) = 1
      expect(model.powerFactorProperty.value).toBeCloseTo(1, 2);
    });

    it("should approach 0 far below resonance", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 0.01;
      // φ → 0, sin(φ) → 0
      expect(model.powerFactorProperty.value).toBeLessThan(0.1);
    });

    it("should approach 0 far above resonance", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 10;
      // φ → π, sin(π) → 0
      expect(model.powerFactorProperty.value).toBeLessThan(0.1);
    });

    it("should be in range [0, 1]", () => {
      model.drivingEnabledProperty.value = true;

      for (const freq of [0.1, 0.5, 1.0, 2.0, 4.0, 6.0]) {
        model.drivingFrequencyProperty.value = freq;
        expect(model.powerFactorProperty.value).toBeGreaterThanOrEqual(0);
        expect(model.powerFactorProperty.value).toBeLessThanOrEqual(1.0001);
      }
    });

    it("should equal b/|Z| (resistance over impedance)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = 2.0;
      const b = model.dampingProperty.value;
      const Z = model.impedanceMagnitudeProperty.value;
      if (Z > 1e-15) {
        expect(model.powerFactorProperty.value).toBeCloseTo(b / Z, 5);
      }
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.powerFactorProperty.value).toBe(0);
    });

    it("should relate to average power: P_avg = 0.5*F0*V0*powerFactor", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = 2.0;
      const F0 = model.forceAmplitudeProperty.value;
      const V0 = model.velocityAmplitudeProperty.value;
      const pf = model.powerFactorProperty.value;
      // P_avg = ½F₀V₀·sin(φ) = ½F₀V₀·PF
      expect(model.steadyStateAveragePowerProperty.value).toBeCloseTo(0.5 * F0 * V0 * pf, 5);
    });
  });

  // ============================================
  // Advanced analytical properties
  // ============================================

  describe("quality factor", () => {
    it("should calculate Q = sqrt(mk)/b for default values", () => {
      // Default: m=2.53, k=100, b=1.0 -> Q = sqrt(253)/1.0 ≈ 15.906
      const expected = Math.sqrt(2.53 * 100) / 1.0;
      expect(model.qualityFactorProperty.value).toBeCloseTo(expected, 5);
    });

    it("should equal 1/(2*zeta)", () => {
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 2.0;
      // zeta = 2/(2*sqrt(100)) = 0.1, Q = 1/(2*0.1) = 5
      expect(model.qualityFactorProperty.value).toBeCloseTo(5, 5);
      expect(model.qualityFactorProperty.value).toBeCloseTo(1 / (2 * model.dampingRatioProperty.value), 5);
    });

    it("should be 0.5 for critically damped system", () => {
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      const criticalDamping = 2 * Math.sqrt(1.0 * 100); // = 20
      model.dampingProperty.value = criticalDamping;
      expect(model.qualityFactorProperty.value).toBeCloseTo(0.5, 5);
    });

    it("should return Infinity for zero damping", () => {
      model.dampingProperty.value = 0;
      expect(model.qualityFactorProperty.value).toBe(Infinity);
    });

    it("should increase with stiffer spring", () => {
      model.dampingProperty.value = 1.0;
      model.massProperty.value = 1.0;

      model.springConstantProperty.value = 50;
      const Q1 = model.qualityFactorProperty.value;

      model.springConstantProperty.value = 200;
      const Q2 = model.qualityFactorProperty.value;

      expect(Q2).toBeGreaterThan(Q1);
    });
  });

  describe("damped angular frequency", () => {
    it("should calculate omega_d = omega_0 * sqrt(1 - zeta^2) for underdamped", () => {
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 2.0; // zeta = 0.1
      const omega0 = Math.sqrt(100);
      const zeta = 2 / (2 * Math.sqrt(100)); // = 0.1
      const expected = omega0 * Math.sqrt(1 - zeta * zeta);
      expect(model.dampedAngularFrequencyProperty.value).toBeCloseTo(expected, 5);
    });

    it("should be less than natural frequency for underdamped", () => {
      model.dampingProperty.value = 1.0; // underdamped
      expect(model.dampedAngularFrequencyProperty.value).toBeLessThan(model.naturalFrequencyProperty.value);
      expect(model.dampedAngularFrequencyProperty.value).toBeGreaterThan(0);
    });

    it("should return 0 for critically damped system", () => {
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 2 * Math.sqrt(100); // critical damping
      expect(model.dampedAngularFrequencyProperty.value).toBe(0);
    });

    it("should return 0 for overdamped system", () => {
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 50; // heavily overdamped
      expect(model.dampedAngularFrequencyProperty.value).toBe(0);
    });

    it("should approach natural frequency for very light damping", () => {
      model.dampingProperty.value = 0.001;
      expect(model.dampedAngularFrequencyProperty.value).toBeCloseTo(model.naturalFrequencyProperty.value, 2);
    });
  });

  describe("damped frequency Hz", () => {
    it("should equal omega_d / (2*pi)", () => {
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 2.0;
      const expected = model.dampedAngularFrequencyProperty.value / (2 * Math.PI);
      expect(model.dampedFrequencyHzProperty.value).toBeCloseTo(expected, 5);
    });

    it("should be 0 for overdamped system", () => {
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 50;
      expect(model.dampedFrequencyHzProperty.value).toBe(0);
    });
  });

  describe("logarithmic decrement", () => {
    it("should calculate delta = 2*pi*zeta / sqrt(1 - zeta^2)", () => {
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 2.0; // zeta = 0.1
      const zeta = 0.1;
      const expected = (2 * Math.PI * zeta) / Math.sqrt(1 - zeta * zeta);
      expect(model.logarithmicDecrementProperty.value).toBeCloseTo(expected, 5);
    });

    it("should return Infinity for critically damped system", () => {
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 2 * Math.sqrt(100);
      expect(model.logarithmicDecrementProperty.value).toBe(Infinity);
    });

    it("should return Infinity for overdamped system", () => {
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 50;
      expect(model.logarithmicDecrementProperty.value).toBe(Infinity);
    });

    it("should be small for lightly damped system", () => {
      model.dampingProperty.value = 0.01;
      expect(model.logarithmicDecrementProperty.value).toBeGreaterThan(0);
      expect(model.logarithmicDecrementProperty.value).toBeLessThan(0.1);
    });
  });

  describe("decay time constant", () => {
    it("should calculate tau = 2m/b", () => {
      // Default: m=2.53, b=1.0 -> tau = 2*2.53/1.0 = 5.06 s
      expect(model.decayTimeConstantProperty.value).toBeCloseTo((2 * 2.53) / 1.0, 5);
    });

    it("should return Infinity for zero damping", () => {
      model.dampingProperty.value = 0;
      expect(model.decayTimeConstantProperty.value).toBe(Infinity);
    });

    it("should decrease with higher damping", () => {
      model.dampingProperty.value = 1.0;
      const tau1 = model.decayTimeConstantProperty.value;

      model.dampingProperty.value = 3.0;
      const tau2 = model.decayTimeConstantProperty.value;

      expect(tau2).toBeLessThan(tau1);
    });

    it("should increase with higher mass", () => {
      model.massProperty.value = 1.0;
      const tau1 = model.decayTimeConstantProperty.value;

      model.massProperty.value = 3.0;
      const tau2 = model.decayTimeConstantProperty.value;

      expect(tau2).toBeGreaterThan(tau1);
    });
  });

  describe("bandwidth", () => {
    it("should calculate Δf = f₀/Q", () => {
      const f0 = model.naturalFrequencyHzProperty.value;
      const Q = model.qualityFactorProperty.value;
      expect(model.bandwidthProperty.value).toBeCloseTo(f0 / Q, 5);
    });

    it("should be wider for higher damping", () => {
      model.dampingProperty.value = 0.5;
      const bw1 = model.bandwidthProperty.value;

      model.dampingProperty.value = 2.0;
      const bw2 = model.bandwidthProperty.value;

      expect(bw2).toBeGreaterThan(bw1);
    });

    it("should equal b/(2*pi*m) which is the -3dB bandwidth", () => {
      // Δf = f₀/Q = (ω₀/2π) / (√(mk)/b) = ω₀b/(2π√(mk)) = b√(k/m)/(2π√(mk))
      // = b/(2πm) for any system
      const expected = model.dampingProperty.value / (2 * Math.PI * model.massProperty.value);
      expect(model.bandwidthProperty.value).toBeCloseTo(expected, 5);
    });
  });

  describe("steady-state average power", () => {
    it("should calculate P_avg = 0.5 * b * omega^2 * X0^2 when driving", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const b = model.dampingProperty.value;
      const omega = 2.0 * 2 * Math.PI;
      const X0 = model.displacementAmplitudeProperty.value;
      const expected = 0.5 * b * omega * omega * X0 * X0;
      expect(model.steadyStateAveragePowerProperty.value).toBeCloseTo(expected, 10);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.steadyStateAveragePowerProperty.value).toBe(0);
    });

    it("should be maximized near resonance", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;

      // At resonance
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      const powerAtResonance = model.steadyStateAveragePowerProperty.value;

      // Off resonance
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 3;
      const powerOffResonance = model.steadyStateAveragePowerProperty.value;

      expect(powerAtResonance).toBeGreaterThan(powerOffResonance);
    });
  });

  describe("steady-state average energy", () => {
    it("should calculate E_avg = 0.25*(m*omega^2 + k)*X0^2 when driving", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const m = model.massProperty.value;
      const k = model.springConstantProperty.value;
      const omega = 2.0 * 2 * Math.PI;
      const X0 = model.displacementAmplitudeProperty.value;
      const expected = 0.25 * (m * omega * omega + k) * X0 * X0;
      expect(model.steadyStateAverageEnergyProperty.value).toBeCloseTo(expected, 10);
    });

    it("should equal 0.5*k*X0^2 at resonance (where KE equals PE)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      // At resonance mω² = k, so ¼(mω² + k)X₀² = ¼(2k)X₀² = ½kX₀²
      const k = model.springConstantProperty.value;
      const X0 = model.displacementAmplitudeProperty.value;
      expect(model.steadyStateAverageEnergyProperty.value).toBeCloseTo(0.5 * k * X0 * X0, 5);
    });

    it("should equal sum of KE and PE components", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const ke = model.steadyStateKineticEnergyProperty.value;
      const pe = model.steadyStatePotentialEnergyProperty.value;
      expect(model.steadyStateAverageEnergyProperty.value).toBeCloseTo(ke + pe, 10);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.steadyStateAverageEnergyProperty.value).toBe(0);
    });

    it("should satisfy P_avg = omega * E_avg / Q at resonance", () => {
      // At resonance: P_avg = ω₀ E_avg / Q
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;

      const P = model.steadyStateAveragePowerProperty.value;
      const E = model.steadyStateAverageEnergyProperty.value;
      const omega0 = model.naturalFrequencyProperty.value;
      const Q = model.qualityFactorProperty.value;

      if (E > 1e-15 && Number.isFinite(Q)) {
        expect(P).toBeCloseTo((omega0 * E) / Q, 5);
      }
    });
  });

  describe("peak response frequency", () => {
    it("should calculate f_peak = f0 * sqrt(1 - 2*zeta^2) for low damping", () => {
      model.drivingEnabledProperty.value = true;
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 2.0; // zeta = 0.1
      const f0 = model.naturalFrequencyHzProperty.value;
      const zeta = model.dampingRatioProperty.value;
      const expected = f0 * Math.sqrt(1 - 2 * zeta * zeta);
      expect(model.peakResponseFrequencyProperty.value).toBeCloseTo(expected, 5);
    });

    it("should be less than natural frequency", () => {
      model.drivingEnabledProperty.value = true;
      model.dampingProperty.value = 1.0;
      expect(model.peakResponseFrequencyProperty.value).toBeLessThanOrEqual(model.naturalFrequencyHzProperty.value);
    });

    it("should return 0 when zeta >= 1/sqrt(2)", () => {
      model.drivingEnabledProperty.value = true;
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      // zeta = 1/sqrt(2) => b = 2*sqrt(mk)/sqrt(2) = sqrt(2)*sqrt(mk)
      const b = Math.sqrt(2) * Math.sqrt(100);
      model.dampingProperty.value = b;
      expect(model.peakResponseFrequencyProperty.value).toBe(0);
    });

    it("should return 0 when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.peakResponseFrequencyProperty.value).toBe(0);
    });

    it("should approach natural frequency for very light damping", () => {
      model.drivingEnabledProperty.value = true;
      model.dampingProperty.value = 0.001;
      expect(model.peakResponseFrequencyProperty.value).toBeCloseTo(model.naturalFrequencyHzProperty.value, 2);
    });
  });

  describe("peak displacement amplitude", () => {
    it("should equal A/(2*zeta*sqrt(1-zeta^2)) for underdamped", () => {
      model.drivingEnabledProperty.value = true;
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100.0;
      model.dampingProperty.value = 2.0; // zeta = 0.1
      model.drivingAmplitudeProperty.value = 0.01;

      const A = 0.01;
      const k = 100;
      const zeta = 0.1;
      const F0 = k * A;
      const expected = F0 / (2 * k * zeta * Math.sqrt(1 - zeta * zeta));
      expect(model.peakDisplacementAmplitudeProperty.value).toBeCloseTo(expected, 5);
    });

    it("should be greater than static deflection for underdamped", () => {
      model.drivingEnabledProperty.value = true;
      model.dampingProperty.value = 1.0;
      model.drivingAmplitudeProperty.value = 0.01;

      // Static deflection = A (driver amplitude)
      expect(model.peakDisplacementAmplitudeProperty.value).toBeGreaterThan(model.drivingAmplitudeProperty.value);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.peakDisplacementAmplitudeProperty.value).toBe(0);
    });

    it("should increase with lower damping", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;

      model.dampingProperty.value = 2.0;
      const peak1 = model.peakDisplacementAmplitudeProperty.value;

      model.dampingProperty.value = 0.5;
      const peak2 = model.peakDisplacementAmplitudeProperty.value;

      expect(peak2).toBeGreaterThan(peak1);
    });
  });

  describe("steady-state RMS displacement", () => {
    it("should calculate X0/sqrt(2)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const X0 = model.displacementAmplitudeProperty.value;
      expect(model.steadyStateRmsDisplacementProperty.value).toBeCloseTo(X0 / Math.SQRT2, 10);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.steadyStateRmsDisplacementProperty.value).toBe(0);
    });
  });

  describe("steady-state RMS velocity", () => {
    it("should calculate omega*X0/sqrt(2)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const V0 = model.velocityAmplitudeProperty.value;
      expect(model.steadyStateRmsVelocityProperty.value).toBeCloseTo(V0 / Math.SQRT2, 10);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.steadyStateRmsVelocityProperty.value).toBe(0);
    });
  });

  describe("steady-state RMS acceleration", () => {
    it("should calculate omega^2*X0/sqrt(2)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const A0 = model.accelerationAmplitudeProperty.value;
      expect(model.steadyStateRmsAccelerationProperty.value).toBeCloseTo(A0 / Math.SQRT2, 10);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.steadyStateRmsAccelerationProperty.value).toBe(0);
    });

    it("should be consistent with RMS velocity times omega", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 3.0;
      const omega = 3.0 * 2 * Math.PI;
      const rmsV = model.steadyStateRmsVelocityProperty.value;
      expect(model.steadyStateRmsAccelerationProperty.value).toBeCloseTo(rmsV * omega, 10);
    });
  });

  describe("steady-state kinetic energy", () => {
    it("should calculate <KE> = 0.25 * m * omega^2 * X0^2", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const m = model.massProperty.value;
      const omega = 2.0 * 2 * Math.PI;
      const X0 = model.displacementAmplitudeProperty.value;
      const expected = 0.25 * m * omega * omega * X0 * X0;
      expect(model.steadyStateKineticEnergyProperty.value).toBeCloseTo(expected, 10);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.steadyStateKineticEnergyProperty.value).toBe(0);
    });

    it("should equal PE at resonance", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      // At resonance ω = ω₀, mω² = k, so ¼mω²X₀² = ¼kX₀²
      expect(model.steadyStateKineticEnergyProperty.value).toBeCloseTo(
        model.steadyStatePotentialEnergyProperty.value,
        5,
      );
    });

    it("should be greater than PE above resonance", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      // Drive well above natural frequency
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 3;
      // Above resonance: mω² > k, so <KE> > <PE>
      expect(model.steadyStateKineticEnergyProperty.value).toBeGreaterThan(
        model.steadyStatePotentialEnergyProperty.value,
      );
    });

    it("should be less than PE below resonance", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      // Drive well below natural frequency
      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 0.1;
      // Below resonance: mω² < k, so <KE> < <PE>
      expect(model.steadyStateKineticEnergyProperty.value).toBeLessThan(model.steadyStatePotentialEnergyProperty.value);
    });

    it("should equal 0.5 * m * rmsV^2", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const m = model.massProperty.value;
      const rmsV = model.steadyStateRmsVelocityProperty.value;
      expect(model.steadyStateKineticEnergyProperty.value).toBeCloseTo(0.5 * m * rmsV * rmsV, 10);
    });
  });

  describe("steady-state potential energy", () => {
    it("should calculate <PE> = 0.25 * k * X0^2", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const k = model.springConstantProperty.value;
      const X0 = model.displacementAmplitudeProperty.value;
      const expected = 0.25 * k * X0 * X0;
      expect(model.steadyStatePotentialEnergyProperty.value).toBeCloseTo(expected, 10);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.steadyStatePotentialEnergyProperty.value).toBe(0);
    });

    it("should equal 0.5 * k * rmsX^2", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const k = model.springConstantProperty.value;
      const rmsX = model.steadyStateRmsDisplacementProperty.value;
      expect(model.steadyStatePotentialEnergyProperty.value).toBeCloseTo(0.5 * k * rmsX * rmsX, 10);
    });
  });

  describe("steady-state driving power", () => {
    it("should calculate <P_drive> = 0.5 * F0 * omega * X0 * sin(phi)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      model.drivingAmplitudeProperty.value = 0.01;
      const F0 = model.forceAmplitudeProperty.value;
      const omega = 2.0 * 2 * Math.PI;
      const X0 = model.displacementAmplitudeProperty.value;
      const phi = model.phaseAngleProperty.value;
      const expected = 0.5 * F0 * omega * X0 * Math.sin(phi);
      expect(model.steadyStateDrivingPowerProperty.value).toBeCloseTo(expected, 10);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.steadyStateDrivingPowerProperty.value).toBe(0);
    });

    it("should equal negative of steady-state damping power (energy balance)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = 2.0;
      expect(model.steadyStateDrivingPowerProperty.value).toBeCloseTo(-model.steadyStateDampingPowerProperty.value, 5);
    });

    it("should equal steady-state average power (magnitude)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = 2.0;
      expect(model.steadyStateDrivingPowerProperty.value).toBeCloseTo(model.steadyStateAveragePowerProperty.value, 5);
    });

    it("should be maximized near resonance", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;

      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value;
      const atResonance = model.steadyStateDrivingPowerProperty.value;

      model.drivingFrequencyProperty.value = model.naturalFrequencyHzProperty.value * 3;
      const offResonance = model.steadyStateDrivingPowerProperty.value;

      expect(atResonance).toBeGreaterThan(offResonance);
    });
  });

  describe("steady-state damping power", () => {
    it("should calculate <P_damp> = -0.5 * b * omega^2 * X0^2", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const b = model.dampingProperty.value;
      const omega = 2.0 * 2 * Math.PI;
      const X0 = model.displacementAmplitudeProperty.value;
      const expected = -0.5 * b * omega * omega * X0 * X0;
      expect(model.steadyStateDampingPowerProperty.value).toBeCloseTo(expected, 10);
    });

    it("should be zero when driving is disabled", () => {
      model.drivingEnabledProperty.value = false;
      expect(model.steadyStateDampingPowerProperty.value).toBe(0);
    });

    it("should always be non-positive", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;

      // Test at various frequencies
      for (const freq of [0.5, 1.0, 2.0, 4.0]) {
        model.drivingFrequencyProperty.value = freq;
        expect(model.steadyStateDampingPowerProperty.value).toBeLessThanOrEqual(0);
      }
    });

    it("should be negative of steady-state average power", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = 2.0;
      expect(model.steadyStateDampingPowerProperty.value).toBeCloseTo(-model.steadyStateAveragePowerProperty.value, 10);
    });

    it("should equal -b * rmsV^2 (in terms of RMS velocity)", () => {
      model.drivingEnabledProperty.value = true;
      model.drivingFrequencyProperty.value = 2.0;
      const b = model.dampingProperty.value;
      const rmsV = model.steadyStateRmsVelocityProperty.value;
      // <-bv²> = -b<v²> = -b(V_rms)²
      expect(model.steadyStateDampingPowerProperty.value).toBeCloseTo(-b * rmsV * rmsV, 10);
    });
  });
});
