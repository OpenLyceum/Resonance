/**
 * Abstract base class for physics models with time management and ODE integration
 * Provides infrastructure for:
 * - Time management (play/pause, speed control)
 * - ODE solver management
 * - Stepping logic with frame-rate independence
 *
 * Subclasses must implement:
 * - getState(): Return the state vector for integration
 * - setState(): Apply integrated results back to model properties
 * - getDerivatives(): Define physics equations for the ODE solver
 * - reset(): Restore initial conditions
 */

import { BooleanProperty, NumberProperty, type Property, StringUnionProperty } from "scenerystack/axon";
import { AdaptiveRK45Solver } from "./AdaptiveRK45Solver.js";
import { AnalyticalSolver } from "./AnalyticalSolver.js";
import type { ODEModel, ODESolver, SubStepCallback } from "./ODESolver.js";
import { RungeKuttaSolver } from "./RungeKuttaSolver.js";
import { SolverType } from "./SolverType.js";

export type TimeSpeed = "slow" | "normal" | "fast";

/**
 * Data point collected at each sub-step for high-resolution graph plotting.
 */
export type SubStepDataPoint = {
  time: number;
  position: number;
  velocity: number;
  acceleration: number;
  appliedForce: number;
};

export abstract class BaseModel implements ODEModel {
  // Time management
  public readonly timeProperty: NumberProperty;
  public readonly isPlayingProperty: BooleanProperty;
  public readonly timeSpeedProperty: StringUnionProperty<TimeSpeed>;

  // ODE solver
  protected solver: ODESolver;
  private readonly solverTypeProperty: Property<SolverType>;

  // Sub-step callback for data collection (bound once for performance)
  private readonly boundSubStepCallback: SubStepCallback;

  // Time speed multipliers
  private readonly timeSpeedMultipliers: Record<TimeSpeed, number> = {
    slow: 0.1,
    normal: 1.0,
    fast: 2.0,
  };

  protected constructor(solverTypeProperty: Property<SolverType>) {
    // Initialize time management properties
    this.timeProperty = new NumberProperty(0);
    this.isPlayingProperty = new BooleanProperty(true);
    this.timeSpeedProperty = new StringUnionProperty<TimeSpeed>("normal", {
      validValues: ["slow", "normal", "fast"],
    });

    // Initialize solver
    this.solverTypeProperty = solverTypeProperty;
    this.solver = this.createSolver(solverTypeProperty.value);

    // Update solver when solver type changes
    this.solverTypeProperty.link((solverType) => {
      this.solver = this.createSolver(solverType);
    });

    // Bind sub-step callback once for performance
    this.boundSubStepCallback = (_elapsedTime: number, state: number[]) => {
      this.onSubStep(state);
    };
  }

  /**
   * Create an ODE solver based on the solver type
   */
  private createSolver(solverType: SolverType): ODESolver {
    switch (solverType) {
      case SolverType.RUNGE_KUTTA_4:
        return new RungeKuttaSolver(0.001);

      case SolverType.ADAPTIVE_RK45:
        return new AdaptiveRK45Solver();

      case SolverType.ANALYTICAL:
        return new AnalyticalSolver();

      default:
        // Unknown solver type; fall back to RK4
        return new RungeKuttaSolver(0.001);
    }
  }

  /**
   * Step the physics simulation forward by dt seconds
   * @param dt - time step in seconds
   * @param forceStep - if true, step even if paused
   */
  public step(dt: number, forceStep: boolean = false): void {
    // Only step if playing or forced
    if (!(this.isPlayingProperty.value || forceStep)) {
      return;
    }

    // Cap dt to prevent large jumps when user switches tabs or browser loses focus
    const cappedDt = Math.min(dt, 0.1);

    // Apply time speed multiplier (only when playing automatically)
    let adjustedDt = cappedDt;
    if (!forceStep) {
      const speedMultiplier = this.timeSpeedMultipliers[this.timeSpeedProperty.value];
      adjustedDt = cappedDt * speedMultiplier;
    }

    // Integrate the physics with sub-step callback for data collection
    this.advanceState(adjustedDt);

    // Update time
    this.timeProperty.value += adjustedDt;
  }

  /** Advance state while allowing subclasses to constrain user-controlled motion. */
  protected advanceState(dt: number): void {
    this.solver.step(dt, this, this.boundSubStepCallback);
  }

  /**
   * Called at each sub-step during ODE integration.
   * Subclasses can override to collect high-resolution data for graph plotting.
   * @param state - The state vector at this sub-step
   */
  protected onSubStep(_state: number[]): void {
    // Default implementation does nothing
    // ResonanceModel overrides this to collect sub-step data
  }

  /**
   * Reset the model to initial conditions
   * Subclasses should override and call resetCommon()
   */
  public abstract reset(): void;

  /**
   * Common reset logic for all models
   * Should be called by subclass reset() methods
   */
  protected resetCommon(): void {
    this.timeProperty.reset();
    this.isPlayingProperty.reset();
    this.timeSpeedProperty.reset();
  }

  /**
   * Get the current state vector for ODE integration
   * Subclasses must implement this to return [position, velocity, ...]
   */
  public abstract getState(): number[];

  /**
   * Set the state vector after ODE integration
   * Subclasses must implement this to apply [position, velocity, ...]
   */
  public abstract setState(state: number[]): void;

  /**
   * Get the derivatives dy/dt for the ODE solver
   * Subclasses must implement this to define the physics equations
   * @param t - current time offset from start of step (usually ignored)
   * @param state - current state vector
   * @returns derivatives vector [dposition/dt, dvelocity/dt, ...]
   */
  public abstract getDerivatives(t: number, state: number[]): number[];
}
