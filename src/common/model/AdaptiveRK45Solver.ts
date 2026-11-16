/**
 * Adaptive Runge-Kutta 4th/5th Order solver (Dormand-Prince method)
 * Uses embedded RK formulas to estimate error and adapt timestep
 *
 * This is one of the most efficient and accurate adaptive ODE solvers.
 * It computes both 4th and 5th order approximations and uses their
 * difference to estimate the local truncation error.
 */

import { type ODEModel, ODESolver, type SubStepCallback } from "./ODESolver.js";

export class AdaptiveRK45Solver extends ODESolver {
  private readonly maxTimestep: number = 0.01;
  private readonly minTimestep: number = 0.00001;
  private readonly errorTolerance: number = 0.0001;
  private readonly safetyFactor: number = 0.9;

  // Dormand-Prince coefficients
  private readonly a = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];

  private readonly b = [
    [],
    [1 / 5],
    [3 / 40, 9 / 40],
    [44 / 45, -56 / 15, 32 / 9],
    [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
    [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
  ];

  // 5th order solution coefficients
  private readonly c5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];

  // 4th order solution coefficients (for error estimation)
  private readonly c4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];

  /**
   * Integrate the system forward by dt using adaptive RK45
   * @param onSubStep - optional callback invoked after each accepted sub-step
   */
  public override step(dt: number, model: ODEModel, onSubStep?: SubStepCallback): void {
    // Handle negative dt for stepping backward in time
    const sign = dt >= 0 ? 1 : -1;
    const absDt = Math.abs(dt);

    let remainingTime = absDt;
    let elapsedTime = 0;
    let currentTimestep = Math.min(this.maxTimestep, absDt);

    while (remainingTime > 0) {
      const absActualDt = Math.min(currentTimestep, remainingTime);
      const signedActualDt = sign * absActualDt;
      const result = this.tryStep(signedActualDt, model);

      if (result.success) {
        remainingTime -= absActualDt;
        elapsedTime += signedActualDt;
        currentTimestep = result.nextTimestep;
        onSubStep?.(elapsedTime, model.getState());
      } else {
        currentTimestep = result.nextTimestep;
      }

      // Safety check
      if (currentTimestep < this.minTimestep) {
        // Timestep became too small; force a single step over the remaining time
        this.forceStep(sign * remainingTime, model);
        elapsedTime = dt; // We've consumed all time
        onSubStep?.(elapsedTime, model.getState());
        break;
      }
    }
  }

  /**
   * Try to take a step, return success and suggested next timestep
   */
  private tryStep(dt: number, model: ODEModel): { success: boolean; nextTimestep: number } {
    const state = model.getState();
    const n = state.length;

    // Allocate k arrays
    const k: number[][] = [];
    for (let i = 0; i < 7; i++) {
      k[i] = Array.from({ length: n }, () => 0);
    }

    const tempState: number[] = Array.from({ length: n }, () => 0);

    // Calculate k1 through k7
    for (let stage = 0; stage < 7; stage++) {
      // Compute tempState for this stage
      if (stage === 0) {
        // k1 uses the current state
        for (let i = 0; i < n; i++) {
          tempState[i] = state[i]!;
        }
      } else {
        // Other stages use weighted sums
        for (let i = 0; i < n; i++) {
          tempState[i] = state[i]!;
          for (let j = 0; j < stage; j++) {
            tempState[i]! += this.b[stage]![j]! * k[j]![i]! * dt;
          }
        }
      }

      // Evaluate derivatives
      const derivatives: number[] = model.getDerivatives(this.a[stage]! * dt, tempState);
      for (let i = 0; i < n; i++) {
        k[stage]![i] = derivatives[i]!;
      }
    }

    // Compute 5th order solution
    const y5: number[] = Array.from({ length: n }, (_, i) => {
      let sum = state[i]!;
      for (let j = 0; j < 7; j++) {
        sum += this.c5[j]! * k[j]![i]! * dt;
      }
      return sum;
    });

    // Compute 4th order solution
    const y4: number[] = Array.from({ length: n }, (_, i) => {
      let sum = state[i]!;
      for (let j = 0; j < 7; j++) {
        sum += this.c4[j]! * k[j]![i]! * dt;
      }
      return sum;
    });

    // Calculate error
    let maxError = 0;
    for (let i = 0; i < n; i++) {
      const error = Math.abs(y5[i]! - y4[i]!);
      maxError = Math.max(maxError, error);
    }

    // Calculate next timestep
    let nextTimestep: number;
    if (maxError < 1e-10) {
      // Very small error, increase timestep significantly
      nextTimestep = Math.min(dt * 2, this.maxTimestep);
    } else {
      // Standard timestep adjustment formula
      const ratio = this.errorTolerance / maxError;
      const factor = this.safetyFactor * ratio ** 0.2;
      nextTimestep = Math.min(Math.max(dt * factor, this.minTimestep), this.maxTimestep);
    }

    // Accept or reject the step
    if (maxError <= this.errorTolerance) {
      model.setState(y5); // Use the 5th order solution
      return { success: true, nextTimestep };
    } else {
      return { success: false, nextTimestep };
    }
  }

  /**
   * Force a step using simple RK4 (used when adaptive method fails)
   */
  private forceStep(dt: number, model: ODEModel): void {
    const state = model.getState();
    const n = state.length;

    // Simple RK4 step
    const k1: number[] = model.getDerivatives(0, state);

    const temp2: number[] = Array.from({ length: n }, (_, i) => state[i]! + k1[i]! * dt * 0.5);
    const k2: number[] = model.getDerivatives(dt * 0.5, temp2);

    const temp3: number[] = Array.from({ length: n }, (_, i) => state[i]! + k2[i]! * dt * 0.5);
    const k3: number[] = model.getDerivatives(dt * 0.5, temp3);

    const temp4: number[] = Array.from({ length: n }, (_, i) => state[i]! + k3[i]! * dt);
    const k4: number[] = model.getDerivatives(dt, temp4);

    const newState: number[] = Array.from(
      { length: n },
      (_, i) => state[i]! + ((k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!) * dt) / 6,
    );

    model.setState(newState);
  }
}
