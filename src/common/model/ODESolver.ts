/**
 * Abstract base class for ODE (Ordinary Differential Equation) solvers
 * Solvers integrate equations of the form dy/dt = f(t, y)
 */

/**
 * Callback invoked at each sub-step during ODE integration.
 * This allows high-resolution data collection for smooth graph plotting.
 * @param elapsedTime - Time elapsed since the start of the step() call
 * @param state - The state vector at this sub-step
 */
export type SubStepCallback = (elapsedTime: number, state: number[]) => void;

export type ODEModel = {
  /**
   * Get the current state vector
   */
  getState(): number[];

  /**
   * Set the state vector
   */
  setState(state: number[]): void;

  /**
   * Get the derivatives dy/dt for the current state
   * @param t - current time
   * @param state - current state vector
   * @returns derivatives vector
   */
  getDerivatives(t: number, state: number[]): number[];
};

export abstract class ODESolver {
  /**
   * Integrate the ODE system forward by dt
   * @param dt - time step in seconds
   * @param model - the model to integrate
   * @param onSubStep - optional callback invoked at each internal sub-step
   */
  public abstract step(dt: number, model: ODEModel, onSubStep?: SubStepCallback): void;

  /**
   * Set the fixed timestep for the solver (if applicable)
   * @param fixedTimestep - the fixed timestep in seconds
   */
  public setFixedTimestep(_fixedTimestep: number): void {
    // Default implementation does nothing
    // Override in subclasses that use fixed timesteps
  }
}
