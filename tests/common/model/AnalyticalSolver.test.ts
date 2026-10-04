/**
 * Tests for AnalyticalSolver - Exact closed-form ODE solver
 *
 * These tests verify the analytical solver produces correct solutions for
 * the driven, damped harmonic oscillator across all three damping regimes.
 */

import { Property } from "scenerystack/axon";
import { beforeEach, describe, expect, it } from "vitest";
import { AnalyticalSolver } from "../../../src/common/model/AnalyticalSolver.js";
import { ODESolver } from "../../../src/common/model/ODESolver.js";
import { ResonanceModel } from "../../../src/common/model/ResonanceModel.js";
import { RungeKuttaSolver } from "../../../src/common/model/RungeKuttaSolver.js";
import { SolverType } from "../../../src/common/model/SolverType.js";

describe("AnalyticalSolver", () => {
  it.each([0, 0.7, Math.PI / 2])("matches RK4 at undamped resonance with initial phase %s", (phase) => {
    const models = [SolverType.ANALYTICAL, SolverType.RUNGE_KUTTA_4].map((solverType) => {
      const model = new ResonanceModel({ solverTypeProperty: new Property<SolverType>(solverType) });
      model.massProperty.value = 1;
      model.springConstantProperty.value = 4;
      model.dampingProperty.value = 0;
      model.gravityProperty.value = 0;
      model.positionProperty.value = 0.02;
      model.velocityProperty.value = -0.01;
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = 1 / Math.PI;
      model.drivingPhaseProperty.value = phase;
      return model;
    });
    const analytical = models[0]!;
    const numerical = models[1]!;
    for (let i = 0; i < 200; i++) {
      for (const model of models) {
        model.step(0.02);
      }
      expect(analytical.positionProperty.value).toBeCloseTo(numerical.positionProperty.value, 9);
      expect(analytical.velocityProperty.value).toBeCloseTo(numerical.velocityProperty.value, 9);
    }
    // Resynchronize the IVP when the driver changes, then returns to resonance.
    for (const frequency of [0.4, 1 / Math.PI]) {
      for (const model of models) {
        model.drivingFrequencyProperty.value = frequency;
        model.step(0.02);
      }
      expect(analytical.positionProperty.value).toBeCloseTo(numerical.positionProperty.value, 9);
      expect(analytical.velocityProperty.value).toBeCloseTo(numerical.velocityProperty.value, 9);
    }
  });

  describe("API conformance", () => {
    it("should extend ODESolver", () => {
      const solver = new AnalyticalSolver();
      expect(solver).toBeInstanceOf(ODESolver);
    });

    it("should have step method with correct signature", () => {
      const solver = new AnalyticalSolver();
      expect(typeof solver.step).toBe("function");
    });

    it("should have setFixedTimestep method", () => {
      const solver = new AnalyticalSolver();
      expect(typeof solver.setFixedTimestep).toBe("function");
      // Should be callable without error (no-op)
      solver.setFixedTimestep(0.001);
    });
  });

  describe("basic functionality", () => {
    let model: ResonanceModel;

    beforeEach(() => {
      const solverTypeProperty = new Property<SolverType>(SolverType.ANALYTICAL);
      model = new ResonanceModel({ solverTypeProperty });
    });

    it("should update state when stepping", () => {
      model.positionProperty.value = 0.1;
      model.velocityProperty.value = 0;
      model.drivingEnabledProperty.value = false;

      const initialState = model.getState();
      const solver = new AnalyticalSolver();
      solver.step(0.1, model);

      const newState = model.getState();
      // Position should have changed
      const initialX = initialState[0];
      expect(initialX).toBeDefined();
      expect(newState[0]).not.toBeCloseTo(initialX as number, 5);
    });

    it("should not change state when dt is 0", () => {
      model.positionProperty.value = 0.1;
      model.velocityProperty.value = 0.05;

      const initialState = model.getState();
      const solver = new AnalyticalSolver();
      solver.step(0, model);

      const newState = model.getState();
      const initialX = initialState[0];
      const initialV = initialState[1];
      expect(initialX).toBeDefined();
      expect(initialV).toBeDefined();
      expect(newState[0]).toBeCloseTo(initialX as number, 10);
      expect(newState[1]).toBeCloseTo(initialV as number, 10);
    });

    it("should preserve energy for undamped oscillator", () => {
      model.positionProperty.value = 0.1;
      model.velocityProperty.value = 0;
      model.dampingProperty.value = 0;
      model.drivingEnabledProperty.value = false;

      const initialEnergy = model.totalEnergyProperty.value;
      const solver = new AnalyticalSolver();

      // Run for many periods
      for (let i = 0; i < 1000; i++) {
        solver.step(0.001, model);
      }

      const finalEnergy = model.totalEnergyProperty.value;
      // Energy should be conserved to high precision
      expect(finalEnergy).toBeCloseTo(initialEnergy, 8);
    });
  });

  describe("underdamped regime", () => {
    let model: ResonanceModel;

    beforeEach(() => {
      const solverTypeProperty = new Property<SolverType>(SolverType.ANALYTICAL);
      model = new ResonanceModel({ solverTypeProperty });
      // Set up underdamped case: ζ = 0.1
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100;
      model.dampingProperty.value = 2.0; // ζ = 2/(2*sqrt(1*100)) = 0.1
      model.drivingEnabledProperty.value = false;
    });

    it("should oscillate with decaying amplitude", () => {
      model.positionProperty.value = 0.1;
      model.velocityProperty.value = 0;

      const solver = new AnalyticalSolver();
      let maxAmplitude = 0.1;

      // Track peak amplitudes over time
      for (let i = 0; i < 500; i++) {
        solver.step(0.01, model);
        const pos = Math.abs(model.positionProperty.value);
        if (pos > maxAmplitude * 0.9 && pos < maxAmplitude) {
          maxAmplitude = pos;
        }
      }

      // Final amplitude should be much smaller due to damping
      const finalAmplitude = Math.abs(model.positionProperty.value);
      expect(finalAmplitude).toBeLessThan(0.1);
    });

    it("should match analytical free oscillation formula", () => {
      model.positionProperty.value = 1.0;
      model.velocityProperty.value = 0;

      const solver = new AnalyticalSolver();
      const omega0 = Math.sqrt(100 / 1);
      const zeta = 2 / (2 * Math.sqrt(1 * 100));
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);

      const t = 0.5;
      solver.step(t, model);

      // Analytical solution for x(t) with x0=1, v0=0
      const C1 = 1.0;
      const C2 = (zeta * omega0 * C1) / omegaD;
      const expected = Math.exp(-zeta * omega0 * t) * (C1 * Math.cos(omegaD * t) + C2 * Math.sin(omegaD * t));

      expect(model.positionProperty.value).toBeCloseTo(expected, 8);
    });
  });

  describe("critically damped regime", () => {
    let model: ResonanceModel;

    beforeEach(() => {
      const solverTypeProperty = new Property<SolverType>(SolverType.ANALYTICAL);
      model = new ResonanceModel({ solverTypeProperty });
      // Set up critical damping: ζ = 1
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100;
      model.dampingProperty.value = 20.0; // ζ = 20/(2*sqrt(100)) = 1.0
      model.drivingEnabledProperty.value = false;
    });

    it("should return to equilibrium without oscillation", () => {
      model.positionProperty.value = 0.1;
      model.velocityProperty.value = 0;

      const solver = new AnalyticalSolver();
      let crossedZero = false;

      for (let i = 0; i < 100; i++) {
        const before = model.positionProperty.value;
        solver.step(0.01, model);
        const after = model.positionProperty.value;
        if (before * after < 0) {
          crossedZero = true;
        }
      }

      // Should not oscillate (no zero crossings from positive initial position)
      expect(crossedZero).toBe(false);
      // Should be near equilibrium
      expect(Math.abs(model.positionProperty.value)).toBeLessThan(0.001);
    });

    it("should match analytical formula for critical damping", () => {
      model.positionProperty.value = 1.0;
      model.velocityProperty.value = 0;

      const solver = new AnalyticalSolver();
      const omega0 = 10; // sqrt(100/1)

      const t = 0.2;
      solver.step(t, model);

      // Analytical: x(t) = (C1 + C2*t) * exp(-ω0*t)
      // With x0=1, v0=0: C1=1, C2=ω0
      const expected = (1 + omega0 * t) * Math.exp(-omega0 * t);

      expect(model.positionProperty.value).toBeCloseTo(expected, 8);
    });
  });

  describe("overdamped regime", () => {
    let model: ResonanceModel;

    beforeEach(() => {
      const solverTypeProperty = new Property<SolverType>(SolverType.ANALYTICAL);
      model = new ResonanceModel({ solverTypeProperty });
      // Set up overdamped: ζ = 2
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100;
      model.dampingProperty.value = 40.0; // ζ = 40/(2*sqrt(100)) = 2.0
      model.drivingEnabledProperty.value = false;
    });

    it("should return to equilibrium slowly without oscillation", () => {
      model.positionProperty.value = 0.1;
      model.velocityProperty.value = 0;

      const solver = new AnalyticalSolver();
      let crossedZero = false;

      for (let i = 0; i < 200; i++) {
        const before = model.positionProperty.value;
        solver.step(0.01, model);
        const after = model.positionProperty.value;
        if (before * after < 0) {
          crossedZero = true;
        }
      }

      // Should not oscillate
      expect(crossedZero).toBe(false);
    });
  });

  describe("driven oscillator", () => {
    let model: ResonanceModel;

    beforeEach(() => {
      const solverTypeProperty = new Property<SolverType>(SolverType.ANALYTICAL);
      model = new ResonanceModel({ solverTypeProperty });
      model.massProperty.value = 1.0;
      model.springConstantProperty.value = 100;
      model.dampingProperty.value = 2.0;
      model.drivingEnabledProperty.value = true;
      model.drivingAmplitudeProperty.value = 0.01;
      model.drivingFrequencyProperty.value = 1.0;
    });

    it("should reach steady state with driving", () => {
      model.positionProperty.value = 0;
      model.velocityProperty.value = 0;

      const solver = new AnalyticalSolver();

      // Run for long enough for transient to decay
      for (let i = 0; i < 500; i++) {
        solver.step(0.01, model);
      }

      // Now track amplitude over one period
      const period = 1 / model.drivingFrequencyProperty.value;
      let maxPos = -Infinity;
      let minPos = Infinity;

      for (let i = 0; i < 100; i++) {
        solver.step(period / 100, model);
        maxPos = Math.max(maxPos, model.positionProperty.value);
        minPos = Math.min(minPos, model.positionProperty.value);
      }

      const amplitude = (maxPos - minPos) / 2;
      const expectedAmplitude = model.displacementAmplitudeProperty.value;

      expect(amplitude).toBeCloseTo(expectedAmplitude, 3);
    });
  });

  describe("parameter change continuity", () => {
    let model: ResonanceModel;

    beforeEach(() => {
      const solverTypeProperty = new Property<SolverType>(SolverType.ANALYTICAL);
      model = new ResonanceModel({ solverTypeProperty });
    });

    it("should maintain position continuity when mass changes", () => {
      model.positionProperty.value = 0.1;
      model.velocityProperty.value = 0.05;
      model.drivingEnabledProperty.value = false;

      const solver = new AnalyticalSolver();

      // Step forward
      solver.step(0.1, model);
      const posBeforeChange = model.positionProperty.value;

      // Change mass
      model.massProperty.value *= 2;

      // Step should continue smoothly
      solver.step(0.001, model);
      const posAfterChange = model.positionProperty.value;

      // Position should be continuous (small change for small dt)
      expect(Math.abs(posAfterChange - posBeforeChange)).toBeLessThan(0.01);
    });

    it("should maintain velocity continuity when spring constant changes", () => {
      model.positionProperty.value = 0;
      model.velocityProperty.value = 0.1;
      model.drivingEnabledProperty.value = false;

      const solver = new AnalyticalSolver();

      solver.step(0.1, model);
      const velBeforeChange = model.velocityProperty.value;

      // Change spring constant
      model.springConstantProperty.value *= 1.5;

      solver.step(0.001, model);
      const velAfterChange = model.velocityProperty.value;

      // Velocity should be continuous
      expect(Math.abs(velAfterChange - velBeforeChange)).toBeLessThan(0.01);
    });
  });

  describe("cross-solver agreement", () => {
    it("should agree with RK4 for simple oscillation", () => {
      const analyticalSolverType = new Property<SolverType>(SolverType.ANALYTICAL);
      const rk4SolverType = new Property<SolverType>(SolverType.RUNGE_KUTTA_4);

      const analyticalModel = new ResonanceModel({
        solverTypeProperty: analyticalSolverType,
      });
      const rk4Model = new ResonanceModel({
        solverTypeProperty: rk4SolverType,
      });

      // Same initial conditions
      analyticalModel.positionProperty.value = 0.1;
      analyticalModel.velocityProperty.value = 0;
      analyticalModel.dampingProperty.value = 0.5;
      analyticalModel.drivingEnabledProperty.value = false;

      rk4Model.positionProperty.value = 0.1;
      rk4Model.velocityProperty.value = 0;
      rk4Model.dampingProperty.value = 0.5;
      rk4Model.drivingEnabledProperty.value = false;

      const analyticalSolver = new AnalyticalSolver();
      const rk4Solver = new RungeKuttaSolver(0.0001); // Very small timestep for accuracy

      // Run both for 1 second
      const dt = 0.01;
      for (let i = 0; i < 100; i++) {
        analyticalSolver.step(dt, analyticalModel);
        rk4Solver.step(dt, rk4Model);
      }

      // Results should agree closely
      expect(analyticalModel.positionProperty.value).toBeCloseTo(rk4Model.positionProperty.value, 3);
      expect(analyticalModel.velocityProperty.value).toBeCloseTo(rk4Model.velocityProperty.value, 3);
    });
  });
});
