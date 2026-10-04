/**
 * Analytical (exact) ODE solver for the driven, damped harmonic oscillator.
 *
 * Uses the same ODESolver API as RungeKuttaSolver and AdaptiveRK45Solver.
 * Overrides step(dt, model) to compute the closed-form solution instead of
 * numerically integrating derivatives. Treats parameter changes as new
 * initial value problems to maintain displacement/velocity continuity.
 *
 * Mathematical foundation:
 * - Equation of motion: m·a = -k·x - b·v - m·g + k·A·sin(ω·t)
 * - General solution: x(t) = x_h(t) + x_p(t) + x_eq
 *   where x_h is the homogeneous (transient) solution and x_p is the particular (steady-state) solution
 *
 * Three damping regimes are handled:
 * - Underdamped (ζ < 1): Oscillatory decay
 * - Critically damped (ζ = 1): Fastest non-oscillatory decay
 * - Overdamped (ζ > 1): Slow exponential decay
 */

import { type ODEModel, ODESolver, type SubStepCallback } from "./ODESolver.js";

/**
 * Extended model interface for direct parameter access.
 * ResonanceModel already satisfies this — no changes needed there.
 */
export interface AnalyticalODEModel extends ODEModel {
  readonly massProperty: { readonly value: number };
  readonly springConstantProperty: { readonly value: number };
  readonly dampingProperty: { readonly value: number };
  readonly gravityProperty: { readonly value: number };
  readonly drivingEnabledProperty: { readonly value: boolean };
  readonly drivingAmplitudeProperty: { readonly value: number };
  readonly drivingFrequencyProperty: { readonly value: number };
}

/**
 * Internal snapshot for change detection
 */
interface OscillatorParams {
  mass: number;
  springConstant: number;
  damping: number;
  gravity: number;
  drivingEnabled: boolean;
  drivingAmplitude: number;
  drivingFrequency: number;
}

/**
 * Damping regime identifiers
 */
const DampingRegime = {
  UNDERDAMPED: 0,
  CRITICALLY_DAMPED: 1,
  OVERDAMPED: 2,
} as const;

type DampingRegime = (typeof DampingRegime)[keyof typeof DampingRegime];

/**
 * Analytical (exact) ODE solver for the driven, damped harmonic oscillator.
 *
 * Uses the same ODESolver API as RungeKuttaSolver and AdaptiveRK45Solver.
 */
export class AnalyticalSolver extends ODESolver {
  // Sub-step interval for synthetic sub-stepping (matches RK4's 1ms default)
  private static readonly SUB_STEP_INTERVAL = 0.001;

  // --- Cached state from last resync ---
  private cachedParams: OscillatorParams | null = null;
  private localTime: number = 0;
  private x0: number = 0;
  private v0: number = 0;
  private phase0: number = 0;
  private cumDriverEnergy: number = 0;
  private cumThermalEnergy: number = 0;
  private cumSumX2: number = 0;
  private cumSumV2: number = 0;

  // --- Last state written by the solver (for detecting external modifications) ---
  // Any external source (mouse drag, keyboard input, accessibility, presets, etc.)
  // can modify position, velocity, or driver phase. Compare these to resync.
  private lastWrittenPosition: number = NaN;
  private lastWrittenVelocity: number = NaN;
  private lastWrittenPhase: number = NaN;

  // --- Precomputed analytical constants ---
  private regime: DampingRegime = DampingRegime.UNDERDAMPED;
  private omega0: number = 0;
  private zeta: number = 0;
  private omegaD: number = 0;
  private alphaExp: number = 0; // overdamped decay rate 1
  private betaExp: number = 0; // overdamped decay rate 2
  private c1: number = 0;
  private c2: number = 0;
  private xEq: number = 0;
  private x0ss: number = 0;
  private phiSS: number = 0;
  private omegaDrive: number = 0;
  private drivingEnabled: boolean = false;
  private springConstant: number = 0;
  private drivingAmplitude: number = 0;
  private dampingCoeff: number = 0;
  private resonantDriveCoefficient: number = 0;
  private isUndampedResonance: boolean = false;

  private static readonly CRITICAL_DAMPING_EPSILON = 1e-6;

  /**
   * Override of ODESolver.step().
   * This is the ONLY public method — same signature as RungeKuttaSolver.step().
   * @param onSubStep - optional callback invoked at synthetic sub-step intervals
   */
  public override step(dt: number, model: ODEModel, onSubStep?: SubStepCallback): void {
    if (dt === 0) {
      return; // No-op for zero timestep
    }

    // 1. Detect parameter changes (uses extension interface internally)
    if (this.cachedParams === null || this.parametersChanged(model)) {
      this.resync(model);
    }

    // 2. Evaluate analytical solution at three points for Simpson's rule
    const tau0 = this.localTime;
    const tauMid = this.localTime + dt / 2;
    const tau1 = this.localTime + dt;

    const xAt0 = this.computePosition(tau0);
    const vAt0 = this.computeVelocity(tau0);
    const xAtMid = this.computePosition(tauMid);
    const vAtMid = this.computeVelocity(tauMid);
    const xAt1 = this.computePosition(tau1);
    const vAt1 = this.computeVelocity(tau1);

    // 3. Advance local time
    this.localTime = tau1;

    // 4. Compute driving phase at quadrature points
    const phaseAt1 = this.computePhase(tau1);
    const phaseAtMid = this.computePhase(tauMid);
    const phaseAt0 = this.computePhase(tau0);

    // 5. Accumulate cumulative integrals via Simpson's rule
    //    ∫f(τ)dτ ≈ (Δt/6)[f(τ₀) + 4f(τ_mid) + f(τ₁)]
    const sixthDt = dt / 6;

    // Driver energy: ∫ F_drive · v dt
    if (this.drivingEnabled) {
      const k = this.springConstant;
      const A = this.drivingAmplitude;
      const Fd0 = k * A * Math.sin(phaseAt0);
      const FdMid = k * A * Math.sin(phaseAtMid);
      const Fd1 = k * A * Math.sin(phaseAt1);
      this.cumDriverEnergy += sixthDt * (Fd0 * vAt0 + 4 * FdMid * vAtMid + Fd1 * vAt1);
    }

    // Thermal energy: ∫ b·v² dt
    const b = this.dampingCoeff;
    this.cumThermalEnergy += sixthDt * (b * vAt0 * vAt0 + 4 * b * vAtMid * vAtMid + b * vAt1 * vAt1);

    // Sum squared displacement: ∫ x² dt
    this.cumSumX2 += sixthDt * (xAt0 * xAt0 + 4 * xAtMid * xAtMid + xAt1 * xAt1);

    // Sum squared velocity: ∫ v² dt
    this.cumSumV2 += sixthDt * (vAt0 * vAt0 + 4 * vAtMid * vAtMid + vAt1 * vAt1);

    // 6. Generate synthetic sub-steps for graph data collection
    if (onSubStep) {
      const numSubSteps = Math.max(1, Math.ceil(dt / AnalyticalSolver.SUB_STEP_INTERVAL));
      const subStepDt = dt / numSubSteps;

      for (let i = 1; i <= numSubSteps; i++) {
        const subTau = tau0 + i * subStepDt;
        const subX = this.computePosition(subTau);
        const subV = this.computeVelocity(subTau);
        const subPhase = this.computePhase(subTau);

        // Create state array for this sub-step
        // Note: cumulative energies are approximated at final values
        // This is acceptable since sub-steps are for visualization, not physics
        onSubStep(i * subStepDt, [
          subX,
          subV,
          subPhase,
          this.cumDriverEnergy,
          this.cumThermalEnergy,
          this.cumSumX2,
          this.cumSumV2,
        ]);
      }
    }

    // 7. Write new state back through the standard API
    model.setState([xAt1, vAt1, phaseAt1, this.cumDriverEnergy, this.cumThermalEnergy, this.cumSumX2, this.cumSumV2]);

    // 8. Track the state we wrote so we can detect external modifications
    this.lastWrittenPosition = xAt1;
    this.lastWrittenVelocity = vAt1;
    this.lastWrittenPhase = phaseAt1;
  }

  /**
   * Override of ODESolver.setFixedTimestep().
   * No-op: the analytical solver has no fixed timestep concept.
   */
  public override setFixedTimestep(_fixedTimestep: number): void {
    // Intentionally empty — analytical solver evaluates at arbitrary times
  }

  /**
   * Resync the solver with the current model state.
   * Called when parameters change or on first invocation.
   */
  private resync(model: ODEModel): void {
    // Read current state through the standard ODEModel API
    const state = model.getState();
    this.x0 = state[0]!;
    this.v0 = state[1]!;
    this.phase0 = state[2]!;
    this.cumDriverEnergy = state[3]!;
    this.cumThermalEnergy = state[4]!;
    this.cumSumX2 = state[5]!;
    this.cumSumV2 = state[6]!;

    // Reset local time (new IVP starts at τ = 0)
    this.localTime = 0;

    // Snapshot parameters (uses extension interface)
    this.cachedParams = this.captureParams(model);

    const m = this.cachedParams.mass;
    const k = this.cachedParams.springConstant;
    const bVal = this.cachedParams.damping;
    const g = this.cachedParams.gravity;

    this.springConstant = k;
    this.dampingCoeff = bVal;
    this.drivingEnabled = this.cachedParams.drivingEnabled;
    this.drivingAmplitude = this.cachedParams.drivingAmplitude;

    // Derived quantities
    this.omega0 = Math.sqrt(k / m);
    this.zeta = bVal / (2 * Math.sqrt(m * k));
    this.xEq = k > 1e-15 ? (-m * g) / k : 0;

    // Determine damping regime
    if (Math.abs(this.zeta - 1) < AnalyticalSolver.CRITICAL_DAMPING_EPSILON) {
      this.regime = DampingRegime.CRITICALLY_DAMPED;
      this.omegaD = 0; // Not used in critically damped case
    } else if (this.zeta < 1) {
      this.regime = DampingRegime.UNDERDAMPED;
      this.omegaD = this.omega0 * Math.sqrt(1 - this.zeta * this.zeta);
    } else {
      this.regime = DampingRegime.OVERDAMPED;
      const disc = Math.sqrt(this.zeta * this.zeta - 1);
      this.alphaExp = this.omega0 * (this.zeta + disc);
      this.betaExp = this.omega0 * (this.zeta - disc);
    }

    // Compute particular solution constants (if driving is enabled)
    this.resonantDriveCoefficient = 0;
    this.isUndampedResonance = false;
    if (this.drivingEnabled) {
      this.omegaDrive = this.cachedParams.drivingFrequency * 2 * Math.PI;
      const F0 = k * this.drivingAmplitude;
      const term1 = k - m * this.omegaDrive * this.omegaDrive;
      const term2 = bVal * this.omegaDrive;
      const denom = Math.sqrt(term1 * term1 + term2 * term2);
      // At undamped resonance the particular solution grows with time:
      // x_p(τ) = -F₀ τ cos(phase₀ + ωτ) / (2mω).
      if (bVal === 0 && Math.abs(term1) <= Number.EPSILON * Math.max(k, m * this.omegaDrive ** 2) * 8) {
        this.isUndampedResonance = true;
        this.resonantDriveCoefficient = F0 / (2 * m * this.omegaDrive);
      }
      this.x0ss = denom > 1e-10 ? F0 / denom : F0 / 1e-10;

      // Phase lag calculation using atan2 for correct quadrant
      if (Math.abs(term1) < 1e-10) {
        this.phiSS = Math.PI / 2;
      } else {
        this.phiSS = Math.atan(term2 / term1);
        if (term1 < 0) {
          this.phiSS += Math.PI;
        }
      }
    } else {
      this.omegaDrive = 0;
      this.x0ss = 0;
      this.phiSS = 0;
    }

    // Solve for C1, C2 from initial conditions
    // x0 = xEq + C1·h1(0) + C2·h2(0) + xp(0)
    // v0 = C1·h1'(0) + C2·h2'(0) + xp'(0)

    const xp0 = this.computeParticularPosition(0);
    const xpDot0 = this.computeParticularVelocity(0);

    const residualX = this.x0 - xp0 - this.xEq;
    const residualV = this.v0 - xpDot0;

    switch (this.regime) {
      case DampingRegime.UNDERDAMPED:
        // x_h(τ) = e^(-ζω₀τ) [C₁ cos(ω_d τ) + C₂ sin(ω_d τ)]
        // At τ = 0: x_h(0) = C₁
        // ẋ_h(0) = -ζω₀ C₁ + ω_d C₂
        this.c1 = residualX;
        this.c2 = (residualV + this.zeta * this.omega0 * this.c1) / this.omegaD;
        break;
      case DampingRegime.CRITICALLY_DAMPED:
        // x_h(τ) = (C₁ + C₂τ) e^(-ω₀τ)
        // At τ = 0: x_h(0) = C₁
        // ẋ_h(0) = C₂ - ω₀ C₁
        this.c1 = residualX;
        this.c2 = residualV + this.omega0 * this.c1;
        break;
      case DampingRegime.OVERDAMPED:
        // x_h(τ) = C₁ e^(-ατ) + C₂ e^(-βτ)
        // At τ = 0: x_h(0) = C₁ + C₂ = residualX
        // ẋ_h(0) = -α C₁ - β C₂ = residualV
        // Solving: C₁ = (residualX·β + residualV) / (β - α)
        this.c1 = (residualX * this.betaExp + residualV) / (this.betaExp - this.alphaExp);
        this.c2 = residualX - this.c1;
        break;
    }
  }

  /**
   * Compute position at local time τ.
   */
  private computePosition(tau: number): number {
    let xh: number;

    switch (this.regime) {
      case DampingRegime.UNDERDAMPED: {
        const decay = Math.exp(-this.zeta * this.omega0 * tau);
        xh = decay * (this.c1 * Math.cos(this.omegaD * tau) + this.c2 * Math.sin(this.omegaD * tau));
        break;
      }
      case DampingRegime.CRITICALLY_DAMPED: {
        const decay = Math.exp(-this.omega0 * tau);
        xh = (this.c1 + this.c2 * tau) * decay;
        break;
      }
      case DampingRegime.OVERDAMPED: {
        xh = this.c1 * Math.exp(-this.alphaExp * tau) + this.c2 * Math.exp(-this.betaExp * tau);
        break;
      }
    }

    // Particular solution (steady-state driven response)
    return xh + this.computeParticularPosition(tau) + this.xEq;
  }

  /**
   * Compute velocity at local time τ.
   */
  private computeVelocity(tau: number): number {
    let vh: number;

    switch (this.regime) {
      case DampingRegime.UNDERDAMPED: {
        const decay = Math.exp(-this.zeta * this.omega0 * tau);
        const cosTerm = Math.cos(this.omegaD * tau);
        const sinTerm = Math.sin(this.omegaD * tau);

        // d/dt[e^(-ζω₀t)(C₁cos(ω_d t) + C₂sin(ω_d t))]
        // = e^(-ζω₀t)[(-ζω₀)(C₁cos + C₂sin) + (-C₁ω_d sin + C₂ω_d cos)]
        vh =
          decay *
          (-this.zeta * this.omega0 * (this.c1 * cosTerm + this.c2 * sinTerm) +
            this.omegaD * (-this.c1 * sinTerm + this.c2 * cosTerm));
        break;
      }
      case DampingRegime.CRITICALLY_DAMPED: {
        const decay = Math.exp(-this.omega0 * tau);
        // d/dt[(C₁ + C₂t)e^(-ω₀t)] = C₂·e^(-ω₀t) - ω₀(C₁ + C₂t)e^(-ω₀t)
        // = e^(-ω₀t)[C₂ - ω₀(C₁ + C₂t)]
        vh = decay * (this.c2 - this.omega0 * (this.c1 + this.c2 * tau));
        break;
      }
      case DampingRegime.OVERDAMPED: {
        vh =
          -this.alphaExp * this.c1 * Math.exp(-this.alphaExp * tau) -
          this.betaExp * this.c2 * Math.exp(-this.betaExp * tau);
        break;
      }
    }

    // Particular solution derivative
    return vh + this.computeParticularVelocity(tau);
  }

  private computeParticularPosition(tau: number): number {
    if (!this.drivingEnabled) {
      return 0;
    }
    const phase = this.computePhase(tau);
    if (this.isUndampedResonance) {
      return -this.resonantDriveCoefficient * tau * Math.cos(phase);
    }
    return this.x0ss * Math.sin(phase - this.phiSS);
  }

  private computeParticularVelocity(tau: number): number {
    if (!this.drivingEnabled) {
      return 0;
    }
    const phase = this.computePhase(tau);
    if (this.isUndampedResonance) {
      return this.resonantDriveCoefficient * (this.omegaDrive * tau * Math.sin(phase) - Math.cos(phase));
    }
    return this.x0ss * this.omegaDrive * Math.cos(phase - this.phiSS);
  }

  /**
   * Compute driving phase at local time τ.
   */
  private computePhase(tau: number): number {
    return this.phase0 + this.omegaDrive * tau;
  }

  /**
   * Capture current parameters from the model.
   */
  private captureParams(model: ODEModel): OscillatorParams {
    // Cast to extension interface — ResonanceModel satisfies this
    const m = model as AnalyticalODEModel;
    return {
      mass: m.massProperty.value,
      springConstant: m.springConstantProperty.value,
      damping: m.dampingProperty.value,
      gravity: m.gravityProperty.value,
      drivingEnabled: m.drivingEnabledProperty.value,
      drivingAmplitude: m.drivingAmplitudeProperty.value,
      drivingFrequency: m.drivingFrequencyProperty.value,
    };
  }

  /**
   * Check if parameters or state have changed since last resync.
   * Detects both parameter changes (mass, k, etc.) and external state
   * modifications (mouse drag, keyboard input, accessibility actions, presets, etc.).
   */
  private parametersChanged(model: ODEModel): boolean {
    if (!this.cachedParams) {
      return true;
    }

    // Check whether motion or the shared driver phase changed externally.
    const state = model.getState();
    if (
      state[0] !== this.lastWrittenPosition ||
      state[1] !== this.lastWrittenVelocity ||
      state[2] !== this.lastWrittenPhase
    ) {
      return true;
    }

    const current = this.captureParams(model);
    return (
      current.mass !== this.cachedParams.mass ||
      current.springConstant !== this.cachedParams.springConstant ||
      current.damping !== this.cachedParams.damping ||
      current.gravity !== this.cachedParams.gravity ||
      current.drivingEnabled !== this.cachedParams.drivingEnabled ||
      current.drivingAmplitude !== this.cachedParams.drivingAmplitude ||
      current.drivingFrequency !== this.cachedParams.drivingFrequency
    );
  }
}
