/**
 * ResonanceModel - Spring-mass system with damping and displacement-driven base
 *
 * This model simulates a mass attached to a vertical spring with a moving base:
 * - Driver base position: y_driver = A*sin(ω*t)
 * - Spring restoring force (Hooke's Law): F_spring = -k*(x - y_driver)
 * - Damping force (linear): F_damping = -b*v
 * - Gravitational force: F_gravity = m*g
 *
 * Equation of motion:
 * m*a = -k*x - b*v + m*g + k*A*sin(ω*t)
 *
 * The effective driving force is k*A*sin(ω*t) where A is the driver amplitude.
 * This model is designed to explore resonance phenomena by varying
 * the driving frequency relative to the natural frequency.
 */

import {
  BooleanProperty,
  DerivedProperty,
  NumberProperty,
  Property,
  type ReadOnlyProperty,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import { BaseModel, type SubStepDataPoint } from "./BaseModel.js";
import type { SolverType } from "./SolverType.js";

export class ResonanceModel extends BaseModel {
  // State variables
  public readonly positionProperty: NumberProperty; // displacement from equilibrium (m, positive = upward)
  public readonly velocityProperty: NumberProperty; // velocity (m/s, positive = upward)

  // Drag state - when true, this resonator is being dragged by the user
  // and should not be updated by the physics simulation
  public readonly isDraggingProperty: BooleanProperty;

  // Physical parameters
  public readonly massProperty: NumberProperty; // mass (kg)
  public readonly springConstantProperty: NumberProperty; // spring constant (N/m)
  public readonly dampingProperty: NumberProperty; // damping coefficient (N·s/m)
  public readonly gravityProperty: NumberProperty; // gravitational acceleration (m/s²)
  public readonly naturalLengthProperty: NumberProperty; // natural length of spring (m)

  // Driving force parameters
  public readonly drivingAmplitudeProperty: NumberProperty; // driving displacement amplitude (m)
  public readonly drivingFrequencyProperty: NumberProperty; // driving frequency (Hz)
  public readonly drivingEnabledProperty: Property<boolean>; // whether driving force is enabled
  public readonly drivingPhaseProperty: NumberProperty; // accumulated phase (radians) for phase-continuous frequency changes

  // Derived properties
  public readonly naturalFrequencyProperty: TReadOnlyProperty<number>; // ω₀ = √(k/m) (rad/s)
  /** @unused Not referenced outside this class (internal dependency only). */
  public readonly dampingRatioProperty: TReadOnlyProperty<number>; // ζ = b/(2√(mk))
  public readonly naturalFrequencyHzProperty: TReadOnlyProperty<number>; // f₀ = ω₀/(2π) (Hz)

  // Energy properties
  public readonly kineticEnergyProperty: TReadOnlyProperty<number>; // KE = ½mv²
  public readonly potentialEnergyProperty: TReadOnlyProperty<number>; // PE = ½kx² - mgx
  public readonly totalEnergyProperty: TReadOnlyProperty<number>; // E = KE + PE

  // Phase relationship (angle between displacement and driving force)
  public readonly phaseAngleProperty: TReadOnlyProperty<number>; // radians

  // Steady-state amplitudes
  public readonly displacementAmplitudeProperty: TReadOnlyProperty<number>; // meters — internal dependency for amplitudeRatioProperty
  /** @unused Not referenced outside this class (internal dependency only). */
  public readonly velocityAmplitudeProperty: TReadOnlyProperty<number>; // m/s
  /** @unused Not referenced outside this class (internal dependency only). */
  public readonly accelerationAmplitudeProperty: TReadOnlyProperty<number>; // m/s²
  /** @unused Not referenced outside this class (internal dependency only). */
  public readonly forceAmplitudeProperty: TReadOnlyProperty<number>; // N (driving force amplitude)

  // Instantaneous dynamic quantities
  public readonly accelerationProperty: TReadOnlyProperty<number>; // m/s² (instantaneous)
  public readonly appliedForceProperty: TReadOnlyProperty<number>; // N (instantaneous driving force)
  public readonly springPotentialEnergyProperty: TReadOnlyProperty<number>; // J (½kx², without gravity)

  // Instantaneous individual forces
  public readonly springForceProperty: TReadOnlyProperty<number>; // N (-k*x)
  public readonly dampingForceProperty: TReadOnlyProperty<number>; // N (-b*v)
  public readonly netForceProperty: TReadOnlyProperty<number>; // N (m*a)

  // Additional energy
  public readonly gravitationalPotentialEnergyProperty: TReadOnlyProperty<number>; // J (m*g*x)
  /** @unused Not referenced outside this class; not in any plottable properties list. */
  public readonly dampingPowerProperty: TReadOnlyProperty<number>; // W (-b*v², power dissipated)
  /** @unused Not referenced outside this class; not in any plottable properties list. */
  public readonly drivingPowerProperty: TReadOnlyProperty<number>; // W (F_drive*v, power input from driver)
  /** @unused Not referenced outside this class; not in any plottable properties list. */
  public readonly springPowerProperty: TReadOnlyProperty<number>; // W (-kxv, spring energy exchange rate)
  /** @unused Not referenced outside this class; not in any plottable properties list. */
  public readonly gravitationalPowerProperty: TReadOnlyProperty<number>; // W (-mgv, gravitational energy exchange rate)

  // Cumulative energy quantities (integrated via ODE solver)
  public readonly driverEnergyProperty: NumberProperty; // J (∫ F_drive · v dt, total work done by driver)
  public readonly thermalEnergyProperty: NumberProperty; // J (∫ b·v² dt, total energy dissipated as heat)

  // Cumulative squared integrals for RMS calculations (integrated via ODE solver)
  public readonly sumSquaredDisplacementProperty: NumberProperty; // m²·s (∫ x² dt)
  public readonly sumSquaredVelocityProperty: NumberProperty; // m²/s (∫ v² dt)

  // RMS quantities (derived from cumulative integrals and time)
  public readonly rmsDisplacementProperty: TReadOnlyProperty<number>; // m, √(∫x²dt / t)
  public readonly rmsVelocityProperty: TReadOnlyProperty<number>; // m/s, √(∫v²dt / t)

  // Driver and dimensionless ratios
  public readonly driverPositionProperty: TReadOnlyProperty<number>; // m (A*sin(phase))
  public readonly frequencyRatioProperty: TReadOnlyProperty<number>; // ω/ω₀ (dimensionless)
  public readonly amplitudeRatioProperty: TReadOnlyProperty<number>; // X₀/(F₀/k) magnification factor

  // Phase relationships (radians, relative to driving force)
  public readonly displacementPhaseProperty: TReadOnlyProperty<number>; // same as phaseAngleProperty
  /** @unused Not referenced outside this class (internal dependency only). */
  public readonly velocityPhaseProperty: TReadOnlyProperty<number>; // displacement phase - π/2
  /** @unused Not referenced outside this class. */
  public readonly accelerationPhaseProperty: TReadOnlyProperty<number>; // displacement phase - π
  /** @unused Not referenced outside this class. */
  public readonly appliedForcePhaseProperty: TReadOnlyProperty<number>; // always 0 (reference)
  /** @unused Not referenced outside this class. */
  public readonly springForcePhaseProperty: TReadOnlyProperty<number>; // displacement phase ± π (anti-phase to x)
  /** @unused Not referenced outside this class. */
  public readonly dampingForcePhaseProperty: TReadOnlyProperty<number>; // velocity phase ± π (anti-phase to v)

  // Mechanical impedance (force/velocity analogy to electrical circuits)
  /** @unused Not referenced outside this class. */
  public readonly impedanceMagnitudeProperty: TReadOnlyProperty<number>; // |Z| = √(b² + (mω - k/ω)²) (N·s/m)
  /** @unused Not referenced outside this class. */
  public readonly impedancePhaseProperty: TReadOnlyProperty<number>; // ∠Z = φ - π/2 (radians)
  /** @unused Not referenced outside this class (internal dependency only). */
  public readonly mechanicalReactanceProperty: TReadOnlyProperty<number>; // X = mω - k/ω (N·s/m)
  /** @unused Not referenced outside this class. */
  public readonly powerFactorProperty: TReadOnlyProperty<number>; // sin(φ) = b/|Z| (dimensionless, [0,1])

  // Advanced analytical properties
  /** @unused Not referenced outside this class (internal dependency only). */
  public readonly qualityFactorProperty: TReadOnlyProperty<number>; // Q = √(mk)/b (dimensionless)
  /** @unused Not referenced outside this class (internal dependency only). */
  public readonly dampedAngularFrequencyProperty: TReadOnlyProperty<number>; // ω_d = ω₀√(1-ζ²) (rad/s)
  /** @unused Not referenced outside this class. */
  public readonly dampedFrequencyHzProperty: TReadOnlyProperty<number>; // f_d = ω_d/(2π) (Hz)
  /** @unused Not referenced outside this class. */
  public readonly logarithmicDecrementProperty: TReadOnlyProperty<number>; // δ = 2πζ/√(1-ζ²)
  /** @unused Not referenced outside this class. */
  public readonly decayTimeConstantProperty: TReadOnlyProperty<number>; // τ = 2m/b (s)
  /** @unused Not referenced outside this class. */
  public readonly bandwidthProperty: TReadOnlyProperty<number>; // Δf = f₀/Q (Hz)
  /** @unused Not referenced outside this class. */
  public readonly steadyStateAveragePowerProperty: TReadOnlyProperty<number>; // P_avg = ½bω²X₀² (W)
  /** @unused Not referenced outside this class. */
  public readonly steadyStateAverageEnergyProperty: TReadOnlyProperty<number>; // E_avg = ½kX₀² (J)
  /** @unused Not referenced outside this class. */
  public readonly peakResponseFrequencyProperty: TReadOnlyProperty<number>; // f_peak = f₀√(1-2ζ²) (Hz)
  /** @unused Not referenced outside this class. */
  public readonly peakDisplacementAmplitudeProperty: TReadOnlyProperty<number>; // X₀ at f_peak (m)
  /** @unused Not referenced outside this class. */
  public readonly steadyStateRmsDisplacementProperty: TReadOnlyProperty<number>; // X₀/√2 (m)
  /** @unused Not referenced outside this class. */
  public readonly steadyStateRmsVelocityProperty: TReadOnlyProperty<number>; // ωX₀/√2 (m/s)
  /** @unused Not referenced outside this class. */
  public readonly steadyStateRmsAccelerationProperty: TReadOnlyProperty<number>; // ω²X₀/√2 (m/s²)

  // Steady-state time-averaged energy counterparts (analytical parallels to instantaneous properties)
  /** @unused Not referenced outside this class. */
  public readonly steadyStateKineticEnergyProperty: TReadOnlyProperty<number>; // <KE> = ¼mω²X₀² (J)
  /** @unused Not referenced outside this class. */
  public readonly steadyStatePotentialEnergyProperty: TReadOnlyProperty<number>; // <PE_spring> = ¼kX₀² (J)

  // Steady-state time-averaged power counterparts (analytical parallels to instantaneous properties)
  /** @unused Not referenced outside this class. */
  public readonly steadyStateDrivingPowerProperty: TReadOnlyProperty<number>; // <P_drive> = ½F₀ωX₀sin(φ) (W)
  /** @unused Not referenced outside this class. */
  public readonly steadyStateDampingPowerProperty: TReadOnlyProperty<number>; // <P_damp> = -½bω²X₀² (W, non-positive)

  // Sub-step data collection for high-resolution graph plotting
  private subStepDataBuffer: SubStepDataPoint[] = [];
  public subStepCollectionEnabled: boolean = false;

  public constructor(preferencesModel: {
    solverTypeProperty: Property<SolverType>;
  }) {
    super(preferencesModel.solverTypeProperty);

    // Initialize state variables
    this.positionProperty = new NumberProperty(0.0); // Start at equilibrium (natural length)
    this.velocityProperty = new NumberProperty(0.0); // Start at rest
    this.isDraggingProperty = new BooleanProperty(false); // Not being dragged initially

    // Initialize physical parameters with reasonable defaults
    this.massProperty = new NumberProperty(2.53); // 2.53 kg
    this.springConstantProperty = new NumberProperty(100.0); // 100 N/m
    this.dampingProperty = new NumberProperty(1.0); // 1.0 N/(m/s)
    this.gravityProperty = new NumberProperty(0); // Start with no gravity
    this.naturalLengthProperty = new NumberProperty(0.2); // 20 cm natural length

    // Initialize driving force parameters
    this.drivingAmplitudeProperty = new NumberProperty(0.005); // 0.5 cm (in meters)
    this.drivingFrequencyProperty = new NumberProperty(1.0); // Start at 1.0 Hz
    this.drivingEnabledProperty = new Property<boolean>(false); // Disabled by default
    this.drivingPhaseProperty = new NumberProperty(0.0); // Start at zero phase

    // Initialize cumulative energy accumulators (integrated by the ODE solver)
    this.driverEnergyProperty = new NumberProperty(0.0); // Cumulative work done by driver
    this.thermalEnergyProperty = new NumberProperty(0.0); // Cumulative energy dissipated as heat

    // Initialize cumulative squared integrals for RMS (integrated by the ODE solver)
    this.sumSquaredDisplacementProperty = new NumberProperty(0.0); // ∫ x² dt
    this.sumSquaredVelocityProperty = new NumberProperty(0.0); // ∫ v² dt

    // RMS displacement = √(∫x²dt / t)
    this.rmsDisplacementProperty = new DerivedProperty(
      [this.sumSquaredDisplacementProperty, this.timeProperty],
      (sumX2: number, t: number) => (t > 1e-10 ? Math.sqrt(sumX2 / t) : 0),
    );

    // RMS velocity = √(∫v²dt / t)
    this.rmsVelocityProperty = new DerivedProperty(
      [this.sumSquaredVelocityProperty, this.timeProperty],
      (sumV2: number, t: number) => (t > 1e-10 ? Math.sqrt(sumV2 / t) : 0),
    );

    // Compute natural frequency: ω₀ = √(k/m)
    this.naturalFrequencyProperty = new DerivedProperty(
      [this.springConstantProperty, this.massProperty],
      (k: number, m: number) => Math.sqrt(k / m),
    );

    // Compute natural frequency in Hz: f₀ = ω₀/(2π)
    this.naturalFrequencyHzProperty = new DerivedProperty(
      [this.naturalFrequencyProperty],
      (omega0: number) => omega0 / (2 * Math.PI),
    );

    // Compute damping ratio: ζ = b/(2√(mk))
    this.dampingRatioProperty = new DerivedProperty(
      [this.dampingProperty, this.massProperty, this.springConstantProperty],
      (b: number, m: number, k: number) => b / (2 * Math.sqrt(m * k)),
    );

    // Compute kinetic energy: KE = ½mv²
    this.kineticEnergyProperty = new DerivedProperty(
      [this.massProperty, this.velocityProperty],
      (m: number, v: number) => 0.5 * m * v * v,
    );

    // Compute potential energy: PE = ½kx² + mgx
    // (Spring potential + gravitational potential with reference at equilibrium)
    // With positive x = upward, gravitational PE increases with height: U_g = mgx
    this.potentialEnergyProperty = new DerivedProperty(
      [this.springConstantProperty, this.positionProperty, this.massProperty, this.gravityProperty],
      (k: number, x: number, m: number, g: number) => 0.5 * k * x * x + m * g * x,
    );

    // Compute total energy: E = KE + PE
    this.totalEnergyProperty = new DerivedProperty(
      [this.kineticEnergyProperty, this.potentialEnergyProperty],
      (ke: number, pe: number) => ke + pe,
    );

    // Compute instantaneous acceleration: a = (-k*x - b*v - m*g + F_drive) / m
    this.accelerationProperty = new DerivedProperty(
      [
        this.springConstantProperty,
        this.positionProperty,
        this.dampingProperty,
        this.velocityProperty,
        this.massProperty,
        this.gravityProperty,
        this.drivingAmplitudeProperty,
        this.drivingPhaseProperty,
        this.drivingEnabledProperty,
      ],
      (
        k: number,
        x: number,
        b: number,
        v: number,
        m: number,
        g: number,
        A: number,
        phase: number,
        enabled: boolean,
      ) => {
        const FDrive = enabled ? k * A * Math.sin(phase) : 0;
        return (-k * x - b * v - m * g + FDrive) / m;
      },
    );

    // Compute instantaneous applied (driving) force: F = k * A * sin(phase)
    this.appliedForceProperty = new DerivedProperty(
      [
        this.springConstantProperty,
        this.drivingAmplitudeProperty,
        this.drivingPhaseProperty,
        this.drivingEnabledProperty,
      ],
      (k: number, A: number, phase: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        return k * A * Math.sin(phase);
      },
    );

    // Compute spring potential energy only (without gravity): PE_spring = ½kx²
    this.springPotentialEnergyProperty = new DerivedProperty(
      [this.springConstantProperty, this.positionProperty],
      (k: number, x: number) => 0.5 * k * x * x,
    );

    // Compute instantaneous spring force: F_spring = -k * x
    this.springForceProperty = new DerivedProperty(
      [this.springConstantProperty, this.positionProperty],
      (k: number, x: number) => -k * x,
    );

    // Compute instantaneous damping force: F_damping = -b * v
    this.dampingForceProperty = new DerivedProperty(
      [this.dampingProperty, this.velocityProperty],
      (b: number, v: number) => -b * v,
    );

    // Compute instantaneous net force: F_net = m * a
    this.netForceProperty = new DerivedProperty(
      [this.massProperty, this.accelerationProperty],
      (m: number, a: number) => m * a,
    );

    // Compute gravitational potential energy: U_grav = m * g * x
    this.gravitationalPotentialEnergyProperty = new DerivedProperty(
      [this.massProperty, this.gravityProperty, this.positionProperty],
      (m: number, g: number, x: number) => m * g * x,
    );

    // Compute power dissipated by damping: P = -b * v² (always non-positive)
    this.dampingPowerProperty = new DerivedProperty(
      [this.dampingProperty, this.velocityProperty],
      (b: number, v: number) => -b * v * v,
    );

    // Compute power injected by the driving force: P_drive = F_drive * v
    this.drivingPowerProperty = new DerivedProperty(
      [this.appliedForceProperty, this.velocityProperty],
      (F: number, v: number) => F * v,
    );

    // Compute spring power: P_spring = F_spring * v = -k * x * v
    // Positive when spring releases energy (restoring toward equilibrium), negative when storing
    this.springPowerProperty = new DerivedProperty(
      [this.springForceProperty, this.velocityProperty],
      (F: number, v: number) => F * v,
    );

    // Compute gravitational power: P_grav = F_grav * v = -m * g * v
    // Rate of energy exchange with gravitational field (zero when gravity is off)
    this.gravitationalPowerProperty = new DerivedProperty(
      [this.massProperty, this.gravityProperty, this.velocityProperty],
      (m: number, g: number, v: number) => -m * g * v,
    );

    // Compute driver plate position: x_driver = A * sin(phase)
    this.driverPositionProperty = new DerivedProperty(
      [this.drivingAmplitudeProperty, this.drivingPhaseProperty, this.drivingEnabledProperty],
      (A: number, phase: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        return A * Math.sin(phase);
      },
    );

    // Compute frequency ratio: ω / ω₀ (driving frequency / natural frequency)
    this.frequencyRatioProperty = new DerivedProperty(
      [this.drivingFrequencyProperty, this.naturalFrequencyHzProperty],
      (fDrive: number, fNatural: number) => {
        if (fNatural < 1e-10) {
          return 0;
        }
        return fDrive / fNatural;
      },
    );

    // Compute phase angle between displacement and driving force
    // Phase lag formula: φ = arctan(bω / (k - mω²))
    // When ω < ω₀: φ is small (displacement nearly in phase with force)
    // When ω = ω₀: φ = π/2 (displacement lags by 90°)
    // When ω > ω₀: φ approaches π (displacement nearly opposite to force)
    this.phaseAngleProperty = new DerivedProperty(
      [
        this.drivingFrequencyProperty,
        this.springConstantProperty,
        this.massProperty,
        this.dampingProperty,
        this.drivingEnabledProperty,
      ],
      (freqHz: number, k: number, m: number, b: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }

        const omega = freqHz * 2 * Math.PI; // Convert Hz to rad/s
        const numerator = b * omega;
        const denominator = k - m * omega * omega;

        // Handle resonance case (denominator near zero)
        if (Math.abs(denominator) < 1e-10) {
          return Math.PI / 2;
        }

        // atan2 gives us the correct quadrant
        // For ω < ω₀: denominator > 0, phase is small positive
        // For ω > ω₀: denominator < 0, we need phase to approach π
        let phase = Math.atan(numerator / denominator);

        // When denominator is negative (ω > ω₀), we need to add π to get phase in (π/2, π)
        if (denominator < 0) {
          phase += Math.PI;
        }

        return phase;
      },
    );

    // Displacement phase is the same as phase angle (for compatibility)
    this.displacementPhaseProperty = this.phaseAngleProperty;

    // Steady-state displacement amplitude: X₀ = kA / √[(k - mω²)² + (bω)²]
    // where A is the driver amplitude and k*A is the driving force amplitude
    this.displacementAmplitudeProperty = new DerivedProperty(
      [
        this.drivingAmplitudeProperty,
        this.drivingFrequencyProperty,
        this.springConstantProperty,
        this.massProperty,
        this.dampingProperty,
        this.drivingEnabledProperty,
      ],
      (A: number, freqHz: number, k: number, m: number, b: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }

        const omega = freqHz * 2 * Math.PI;
        const F0 = k * A; // Driving force amplitude
        const term1 = k - m * omega * omega;
        const term2 = b * omega;
        const denominator = Math.sqrt(term1 * term1 + term2 * term2);

        if (denominator < 1e-10) {
          // At exact resonance with zero damping, amplitude would be infinite
          // Return a large but finite value
          return F0 / 1e-10;
        }

        return F0 / denominator;
      },
    );

    // Velocity amplitude: A_v = ω × X₀
    this.velocityAmplitudeProperty = new DerivedProperty(
      [this.displacementAmplitudeProperty, this.drivingFrequencyProperty],
      (X0: number, freqHz: number) => {
        const omega = freqHz * 2 * Math.PI;
        return omega * X0;
      },
    );

    // Acceleration amplitude: A_a = ω² × X₀
    this.accelerationAmplitudeProperty = new DerivedProperty(
      [this.displacementAmplitudeProperty, this.drivingFrequencyProperty],
      (X0: number, freqHz: number) => {
        const omega = freqHz * 2 * Math.PI;
        return omega * omega * X0;
      },
    );

    // Driving force amplitude: F₀ = k × A (spring constant × driver amplitude)
    this.forceAmplitudeProperty = new DerivedProperty(
      [this.springConstantProperty, this.drivingAmplitudeProperty, this.drivingEnabledProperty],
      (k: number, A: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        return k * A;
      },
    );

    // Compute amplitude ratio (magnification factor): X₀ / A_static
    // where A_static = F₀ / k = A (the static deflection under driving force amplitude)
    this.amplitudeRatioProperty = new DerivedProperty(
      [this.displacementAmplitudeProperty, this.drivingAmplitudeProperty, this.drivingEnabledProperty],
      (X0: number, A: number, enabled: boolean) => {
        if (!enabled || A < 1e-15) {
          return 0;
        }
        return X0 / A;
      },
    );

    // Velocity phase: leads displacement by 90° (π/2)
    // Since x(t) = X₀ cos(ωt - φ), v(t) = -ωX₀ sin(ωt - φ) = ωX₀ cos(ωt - φ + π/2)
    // So velocity phase relative to driving force = φ - π/2
    this.velocityPhaseProperty = new DerivedProperty([this.displacementPhaseProperty], (displacementPhase: number) => {
      // Normalize to [-π, π]
      let phase = displacementPhase - Math.PI / 2;
      while (phase < -Math.PI) {
        phase += 2 * Math.PI;
      }
      while (phase > Math.PI) {
        phase -= 2 * Math.PI;
      }
      return phase;
    });

    // Acceleration phase: leads displacement by 180° (π)
    // Since a(t) = -ω²X₀ cos(ωt - φ) = ω²X₀ cos(ωt - φ + π)
    // So acceleration phase relative to driving force = φ - π
    this.accelerationPhaseProperty = new DerivedProperty(
      [this.displacementPhaseProperty],
      (displacementPhase: number) => {
        // Normalize to [-π, π]
        let phase = displacementPhase - Math.PI;
        while (phase < -Math.PI) {
          phase += 2 * Math.PI;
        }
        while (phase > Math.PI) {
          phase -= 2 * Math.PI;
        }
        return phase;
      },
    );

    // Applied force phase: always 0 (this is our reference)
    // The driving force is F(t) = F₀ sin(ωt) or F₀ cos(ωt)
    this.appliedForcePhaseProperty = new DerivedProperty([this.drivingEnabledProperty], (_enabled: boolean) => 0);

    // Spring force phase: F_spring = -kx is anti-phase to displacement
    // Phase relative to driving force = displacement phase ± π
    this.springForcePhaseProperty = new DerivedProperty(
      [this.displacementPhaseProperty],
      (displacementPhase: number) => {
        // Add π and normalize to [-π, π]
        let phase = displacementPhase + Math.PI;
        while (phase > Math.PI) {
          phase -= 2 * Math.PI;
        }
        return phase;
      },
    );

    // Damping force phase: F_damp = -bv is anti-phase to velocity
    // Phase relative to driving force = velocity phase ± π
    this.dampingForcePhaseProperty = new DerivedProperty([this.velocityPhaseProperty], (velocityPhase: number) => {
      // Add π and normalize to [-π, π]
      let phase = velocityPhase + Math.PI;
      while (phase > Math.PI) {
        phase -= 2 * Math.PI;
      }
      return phase;
    });

    // ============================================
    // Mechanical impedance analysis
    // Z = F/v (complex), connecting phase relationships to power transfer
    // Analogy: force↔voltage, velocity↔current, damping↔resistance,
    //          mass↔inductance, 1/k↔capacitance
    // ============================================

    // Mechanical reactance: X = mω - k/ω (N·s/m)
    // Positive above resonance (inertia-dominated, "inductive")
    // Negative below resonance (stiffness-dominated, "capacitive")
    // Zero at resonance (purely resistive)
    this.mechanicalReactanceProperty = new DerivedProperty(
      [this.massProperty, this.springConstantProperty, this.drivingFrequencyProperty, this.drivingEnabledProperty],
      (m: number, k: number, freqHz: number, enabled: boolean) => {
        if (!enabled || freqHz < 1e-15) {
          return 0;
        }
        const omega = freqHz * 2 * Math.PI;
        return m * omega - k / omega;
      },
    );

    // Impedance magnitude: |Z| = √(b² + (mω - k/ω)²) = √(R² + X²) (N·s/m)
    // Minimum at resonance where |Z| = b (purely resistive)
    this.impedanceMagnitudeProperty = new DerivedProperty(
      [this.dampingProperty, this.mechanicalReactanceProperty, this.drivingEnabledProperty],
      (b: number, X: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        return Math.sqrt(b * b + X * X);
      },
    );

    // Impedance phase: ∠Z = φ - π/2 (radians)
    // ∠Z = 0 at resonance (force and velocity in phase, maximum power transfer)
    // ∠Z < 0 below resonance (stiffness-dominated, velocity leads force)
    // ∠Z > 0 above resonance (inertia-dominated, force leads velocity)
    this.impedancePhaseProperty = new DerivedProperty(
      [this.displacementPhaseProperty, this.drivingEnabledProperty],
      (phi: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        let phase = phi - Math.PI / 2;
        while (phase < -Math.PI) {
          phase += 2 * Math.PI;
        }
        while (phase > Math.PI) {
          phase -= 2 * Math.PI;
        }
        return phase;
      },
    );

    // Power factor: sin(φ) = cos(∠Z) = b/|Z| (dimensionless, [0, 1])
    // Fraction of apparent power that does real work (absorbed by damping).
    // 1 at resonance (maximum power absorption), 0 far from resonance.
    this.powerFactorProperty = new DerivedProperty(
      [this.phaseAngleProperty, this.drivingEnabledProperty],
      (phi: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        return Math.sin(phi);
      },
    );

    // ============================================
    // Advanced analytical properties
    // ============================================

    // Quality factor: Q = √(mk)/b
    // Measures how underdamped the oscillator is. Higher Q means sharper resonance.
    // Q > 0.5 → underdamped, Q = 0.5 → critically damped, Q < 0.5 → overdamped
    this.qualityFactorProperty = new DerivedProperty(
      [this.massProperty, this.springConstantProperty, this.dampingProperty],
      (m: number, k: number, b: number) => {
        if (b < 1e-15) {
          return Infinity;
        }
        return Math.sqrt(m * k) / b;
      },
    );

    // Damped angular frequency: ω_d = ω₀√(1 - ζ²)
    // Only meaningful for underdamped systems (ζ < 1). Returns 0 for critically/overdamped.
    this.dampedAngularFrequencyProperty = new DerivedProperty(
      [this.naturalFrequencyProperty, this.dampingRatioProperty],
      (omega0: number, zeta: number) => {
        const zetaSq = zeta * zeta;
        if (zetaSq >= 1) {
          return 0;
        }
        return omega0 * Math.sqrt(1 - zetaSq);
      },
    );

    // Damped frequency in Hz: f_d = ω_d / (2π)
    this.dampedFrequencyHzProperty = new DerivedProperty(
      [this.dampedAngularFrequencyProperty],
      (omegaD: number) => omegaD / (2 * Math.PI),
    );

    // Logarithmic decrement: δ = 2πζ/√(1-ζ²)
    // Ratio of successive peak amplitudes in free decay: A_n/A_{n+1} = e^δ
    // Only meaningful for underdamped systems (ζ < 1). Returns Infinity for critically/overdamped.
    this.logarithmicDecrementProperty = new DerivedProperty([this.dampingRatioProperty], (zeta: number) => {
      const zetaSq = zeta * zeta;
      if (zetaSq >= 1) {
        return Infinity;
      }
      return (2 * Math.PI * zeta) / Math.sqrt(1 - zetaSq);
    });

    // Decay time constant: τ = 2m/b
    // The envelope of free oscillations decays as e^{-t/τ}
    this.decayTimeConstantProperty = new DerivedProperty(
      [this.massProperty, this.dampingProperty],
      (m: number, b: number) => {
        if (b < 1e-15) {
          return Infinity;
        }
        return (2 * m) / b;
      },
    );

    // Bandwidth (half-power): Δf = f₀/Q
    // Width of the resonance peak at 1/√2 of maximum amplitude (≈ -3 dB points)
    this.bandwidthProperty = new DerivedProperty(
      [this.naturalFrequencyHzProperty, this.qualityFactorProperty],
      (f0: number, Q: number) => {
        if (!Number.isFinite(Q) || Q < 1e-15) {
          return f0 > 0 ? Infinity : 0;
        }
        return f0 / Q;
      },
    );

    // Steady-state average power dissipated: P_avg = ½bω²X₀²
    // Time-averaged power absorbed from driver (equals power dissipated by damping)
    this.steadyStateAveragePowerProperty = new DerivedProperty(
      [
        this.dampingProperty,
        this.drivingFrequencyProperty,
        this.displacementAmplitudeProperty,
        this.drivingEnabledProperty,
      ],
      (b: number, freqHz: number, X0: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        const omega = freqHz * 2 * Math.PI;
        return 0.5 * b * omega * omega * X0 * X0;
      },
    );

    // Steady-state average total energy: E_avg = ¼(mω² + k)X₀²
    // Time-averaged energy stored in the oscillator (kinetic + potential)
    // <KE> = ¼mω²X₀², <PE_spring> = ¼kX₀², total = ¼(mω² + k)X₀²
    // Note: <KE> = <PE> only at resonance (ω = ω₀). Off-resonance they differ.
    this.steadyStateAverageEnergyProperty = new DerivedProperty(
      [
        this.massProperty,
        this.springConstantProperty,
        this.drivingFrequencyProperty,
        this.displacementAmplitudeProperty,
        this.drivingEnabledProperty,
      ],
      (m: number, k: number, freqHz: number, X0: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        const omega = freqHz * 2 * Math.PI;
        return 0.25 * (m * omega * omega + k) * X0 * X0;
      },
    );

    // Peak response frequency: f_peak = f₀√(1 - 2ζ²)
    // The driving frequency that produces maximum displacement amplitude.
    // Only exists for ζ < 1/√2. For higher damping, amplitude is maximized at f=0.
    this.peakResponseFrequencyProperty = new DerivedProperty(
      [this.naturalFrequencyHzProperty, this.dampingRatioProperty, this.drivingEnabledProperty],
      (f0: number, zeta: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        const term = 1 - 2 * zeta * zeta;
        if (term <= 0) {
          return 0; // No resonance peak for ζ ≥ 1/√2
        }
        return f0 * Math.sqrt(term);
      },
    );

    // Peak displacement amplitude: X₀ evaluated at f_peak
    // X_peak = F₀ / (2kζ√(1-ζ²)) = A / (2ζ√(1-ζ²))  (for ζ < 1/√2)
    this.peakDisplacementAmplitudeProperty = new DerivedProperty(
      [
        this.drivingAmplitudeProperty,
        this.springConstantProperty,
        this.dampingRatioProperty,
        this.drivingEnabledProperty,
      ],
      (A: number, k: number, zeta: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        const term = 1 - zeta * zeta;
        if (zeta * zeta >= 0.5 || term <= 0) {
          // No resonance peak; maximum is at DC. Return static deflection F₀/k = A
          return A;
        }
        const F0 = k * A;
        return F0 / (2 * k * zeta * Math.sqrt(term));
      },
    );

    // Steady-state RMS displacement: X₀/√2
    // Analytical RMS of sinusoidal steady-state displacement (no transient contribution)
    this.steadyStateRmsDisplacementProperty = new DerivedProperty(
      [this.displacementAmplitudeProperty],
      (X0: number) => X0 / Math.SQRT2,
    );

    // Steady-state RMS velocity: ωX₀/√2
    // Analytical RMS of sinusoidal steady-state velocity
    this.steadyStateRmsVelocityProperty = new DerivedProperty(
      [this.velocityAmplitudeProperty],
      (V0: number) => V0 / Math.SQRT2,
    );

    // Steady-state RMS acceleration: ω²X₀/√2
    // Analytical RMS of sinusoidal steady-state acceleration
    this.steadyStateRmsAccelerationProperty = new DerivedProperty(
      [this.accelerationAmplitudeProperty],
      (A0: number) => A0 / Math.SQRT2,
    );

    // ============================================
    // Steady-state time-averaged energy and power
    // (analytical counterparts to instantaneous numerical properties)
    // ============================================

    // Steady-state average kinetic energy: <KE> = ¼mω²X₀²
    // For x(t) = X₀sin(ωt - φ), v(t) = ωX₀cos(ωt - φ), so <v²> = ω²X₀²/2
    // Counterpart to instantaneous kineticEnergyProperty (½mv²)
    this.steadyStateKineticEnergyProperty = new DerivedProperty(
      [
        this.massProperty,
        this.drivingFrequencyProperty,
        this.displacementAmplitudeProperty,
        this.drivingEnabledProperty,
      ],
      (m: number, freqHz: number, X0: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        const omega = freqHz * 2 * Math.PI;
        return 0.25 * m * omega * omega * X0 * X0;
      },
    );

    // Steady-state average spring potential energy: <PE_spring> = ¼kX₀²
    // For x(t) = X₀sin(ωt - φ), <x²> = X₀²/2
    // Counterpart to instantaneous springPotentialEnergyProperty (½kx²)
    this.steadyStatePotentialEnergyProperty = new DerivedProperty(
      [this.springConstantProperty, this.displacementAmplitudeProperty, this.drivingEnabledProperty],
      (k: number, X0: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        return 0.25 * k * X0 * X0;
      },
    );

    // Steady-state average driving power: <P_drive> = ½F₀ωX₀sin(φ)
    // Time-averaged power input from the driver.
    // In steady state this equals the time-averaged dissipation ½bω²X₀²
    // (energy balance: all input power is dissipated by damping).
    // Counterpart to instantaneous drivingPowerProperty (F_drive·v)
    this.steadyStateDrivingPowerProperty = new DerivedProperty(
      [
        this.forceAmplitudeProperty,
        this.drivingFrequencyProperty,
        this.displacementAmplitudeProperty,
        this.phaseAngleProperty,
        this.drivingEnabledProperty,
      ],
      (F0: number, freqHz: number, X0: number, phi: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        const omega = freqHz * 2 * Math.PI;
        return 0.5 * F0 * omega * X0 * Math.sin(phi);
      },
    );

    // Steady-state average damping power: <P_damp> = -½bω²X₀²
    // Time-averaged power removed by damping (always non-positive).
    // Counterpart to instantaneous dampingPowerProperty (-bv²)
    this.steadyStateDampingPowerProperty = new DerivedProperty(
      [
        this.dampingProperty,
        this.drivingFrequencyProperty,
        this.displacementAmplitudeProperty,
        this.drivingEnabledProperty,
      ],
      (b: number, freqHz: number, X0: number, enabled: boolean) => {
        if (!enabled) {
          return 0;
        }
        const omega = freqHz * 2 * Math.PI;
        return -0.5 * b * omega * omega * X0 * X0;
      },
    );
  }

  /** Keep the driver clock running while the user holds the mass. */
  protected override advanceState(dt: number): void {
    if (this.isDraggingProperty.value) {
      if (this.drivingEnabledProperty.value) {
        this.drivingPhaseProperty.value += dt * this.drivingFrequencyProperty.value * 2 * Math.PI;
      }
    } else {
      super.advanceState(dt);
    }
  }

  /**
   * Get the current state vector [position, velocity, drivingPhase, driverEnergy, thermalEnergy, sumX², sumV²]
   */
  public override getState(): number[] {
    return [
      this.positionProperty.value,
      this.velocityProperty.value,
      this.drivingPhaseProperty.value,
      this.driverEnergyProperty.value,
      this.thermalEnergyProperty.value,
      this.sumSquaredDisplacementProperty.value,
      this.sumSquaredVelocityProperty.value,
    ];
  }

  /**
   * Set the state vector [position, velocity, drivingPhase, driverEnergy, thermalEnergy, sumX², sumV²]
   */
  public override setState(state: number[]): void {
    this.positionProperty.value = state[0]!;
    this.velocityProperty.value = state[1]!;
    this.drivingPhaseProperty.value = state[2]!;
    this.driverEnergyProperty.value = state[3]!;
    this.thermalEnergyProperty.value = state[4]!;
    this.sumSquaredDisplacementProperty.value = state[5]!;
    this.sumSquaredVelocityProperty.value = state[6]!;
  }

  /**
   * Get the derivatives for the ODE solver.
   * State vector: [x, v, phase, driverEnergy, thermalEnergy, sumX², sumV²]
   *
   * For a displacement-driven oscillator where the driver base moves sinusoidally:
   * - Driver position: y_driver = A * sin(phase)
   * - Spring extension: (x - y_driver)
   * - Spring force: F_spring = -k * (x - y_driver) = -k*x + k*A*sin(phase)
   *
   * Derivatives:
   * dx/dt = v
   * dv/dt = (-k*x - b*v + m*g + k*A*sin(phase)) / m
   * dphase/dt = ω
   * dDriverEnergy/dt = F_drive * v
   * dThermalEnergy/dt = b * v²
   * d(sumX²)/dt = x²
   * d(sumV²)/dt = v²
   *
   * Using phase instead of time ensures smooth frequency changes
   */
  public override getDerivatives(_t: number, state: number[]): number[] {
    const x = state[0]!; // position (displacement from equilibrium)
    const v = state[1]!; // velocity
    const phase = state[2]!; // driving phase

    const m = this.massProperty.value;
    const k = this.springConstantProperty.value;
    const b = this.dampingProperty.value;
    const g = this.gravityProperty.value;

    // Calculate driving force using phase for smooth frequency changes
    // For displacement-driven oscillator: F_drive = k * A * sin(phase)
    // where A is the driver amplitude (displacement in meters)
    let FDrive = 0;
    let phaseDerivative = 0;
    if (this.drivingEnabledProperty.value) {
      const A = this.drivingAmplitudeProperty.value; // Driver amplitude in meters
      const omega = this.drivingFrequencyProperty.value * 2 * Math.PI; // Convert Hz to rad/s
      FDrive = k * A * Math.sin(phase); // Effective force from moving base
      phaseDerivative = omega; // dphase/dt = ω
    }

    // Calculate acceleration: a = F_total / m
    // F_total = -k*x (spring) - b*v (damping) - m*g (gravity, downward in upward-positive coords) + F_drive
    const acceleration = (-k * x - b * v - m * g + FDrive) / m;

    // Cumulative energy derivatives
    const dDriverEnergy = FDrive * v; // Power input from driver (can be negative)
    const dThermalEnergy = b * v * v; // Power dissipated as heat (always non-negative)

    return [
      v, // dx/dt = v
      acceleration, // dv/dt = a
      phaseDerivative, // dphase/dt = ω
      dDriverEnergy, // dDriverEnergy/dt = F_drive * v
      dThermalEnergy, // dThermalEnergy/dt = b * v²
      x * x, // d(sumX²)/dt = x²
      v * v, // d(sumV²)/dt = v²
    ];
  }

  /**
   * Reset the model to initial conditions
   */
  public override reset(): void {
    // Reset state
    this.positionProperty.reset();
    this.velocityProperty.reset();
    this.isDraggingProperty.reset();

    // Reset physical parameters
    this.massProperty.reset();
    this.springConstantProperty.reset();
    this.dampingProperty.reset();
    this.gravityProperty.reset();
    this.naturalLengthProperty.reset();

    // Reset driving force parameters
    this.drivingAmplitudeProperty.reset();
    this.drivingFrequencyProperty.reset();
    this.drivingEnabledProperty.reset();
    this.drivingPhaseProperty.reset();

    // Reset cumulative accumulators
    this.driverEnergyProperty.reset();
    this.thermalEnergyProperty.reset();
    this.sumSquaredDisplacementProperty.reset();
    this.sumSquaredVelocityProperty.reset();

    // Reset time and playback state
    this.resetCommon();

    // Clear sub-step buffer
    this.subStepDataBuffer = [];
  }

  /**
   * Override of BaseModel.onSubStep to collect sub-step data.
   * Called at each sub-step during ODE integration.
   */
  protected override onSubStep(state: number[]): void {
    this.collectSubStepData(state);
  }

  /**
   * Collect a sub-step data point from the solver callback.
   * Called by BaseModel when sub-step collection is enabled.
   * @param state - The state vector [position, velocity, phase, ...]
   */
  public collectSubStepData(state: number[]): void {
    if (!this.subStepCollectionEnabled) {
      return;
    }

    const position = state[0]!;
    const velocity = state[1]!;
    const phase = state[2]!;

    // Compute derived quantities from state
    const m = this.massProperty.value;
    const k = this.springConstantProperty.value;
    const A = this.drivingAmplitudeProperty.value;

    // Compute acceleration and applied force at this state
    const appliedForce = this.drivingEnabledProperty.value ? k * A * Math.sin(phase) : 0;
    const acceleration =
      (-k * position - this.dampingProperty.value * velocity - m * this.gravityProperty.value + appliedForce) / m;

    this.subStepDataBuffer.push({
      time: this.timeProperty.value,
      position,
      velocity,
      acceleration,
      appliedForce,
    });
  }

  /**
   * Get and clear the sub-step data buffer.
   * @returns Array of sub-step data points collected since last flush
   */
  public flushSubStepData(): SubStepDataPoint[] {
    const data = this.subStepDataBuffer;
    this.subStepDataBuffer = [];
    return data;
  }

  /**
   * Check if there is sub-step data available.
   */
  public hasSubStepData(): boolean {
    return this.subStepDataBuffer.length > 0;
  }

  /**
   * Set to a preset configuration
   */
  public setPreset(preset: ResonancePreset): void {
    this.massProperty.value = preset.mass;
    this.springConstantProperty.value = preset.springConstant;
    this.dampingProperty.value = preset.damping;
    this.positionProperty.value = preset.initialPosition;
    this.velocityProperty.value = preset.initialVelocity ?? 0;
    this.drivingAmplitudeProperty.value = preset.drivingAmplitude ?? 0.01; // Default 1 cm
    this.drivingFrequencyProperty.value = preset.drivingFrequency ?? 0.5;
  }
}

/**
 * Configuration preset for the resonance model
 */
export type ResonancePreset = {
  nameKey: "lightAndBouncy" | "heavyAndSlow" | "underdamped" | "criticallyDamped" | "overdamped" | "resonanceDemo"; // Key for localized name
  mass: number; // kg
  springConstant: number; // N/m
  damping: number; // N·s/m
  initialPosition: number; // m
  initialVelocity?: number; // m/s
  drivingAmplitude?: number; // m (displacement amplitude)
  drivingFrequency?: number; // Hz
};

/**
 * Get the localized name for a preset
 */
export function getPresetName(preset: ResonancePreset): ReadOnlyProperty<string> {
  const propertyName = `${preset.nameKey}StringProperty`;
  const presetsMap = ResonanceStrings.presets as Record<string, ReadOnlyProperty<string>>;
  return presetsMap[propertyName]!;
}

/**
 * Predefined presets demonstrating different damping regimes and resonance
 */
export const ResonancePresets: ResonancePreset[] = [
  {
    nameKey: "lightAndBouncy",
    mass: 0.5,
    springConstant: 50,
    damping: 0.1,
    initialPosition: 1.0,
    drivingAmplitude: 0.01, // 1 cm displacement
    drivingFrequency: 1.6, // Near natural frequency ~1.59 Hz
  },
  {
    nameKey: "heavyAndSlow",
    mass: 5.0,
    springConstant: 10, // Minimum k for slow natural frequency
    damping: 0.5,
    initialPosition: 1.0,
    drivingAmplitude: 0.015, // 1.5 cm displacement
    drivingFrequency: 0.2, // Near natural frequency √(10/5)/(2π) ≈ 0.225 Hz
  },
  {
    // All three damping presets share the same natural frequency (2 Hz)
    // m = 0.1 kg, k = 16 N/m → f₀ = √(16/0.1)/(2π) ≈ 2.01 Hz
    // Critical damping: b_crit = 2√(mk) = 2√1.6 ≈ 2.53 N·s/m
    nameKey: "underdamped",
    mass: 0.1,
    springConstant: 16,
    damping: 0.5, // ζ = 0.5/2.53 ≈ 0.2 (underdamped)
    initialPosition: 1.0,
    drivingAmplitude: 0.01, // 1 cm displacement
    drivingFrequency: 2.0, // At natural frequency
  },
  {
    nameKey: "criticallyDamped",
    mass: 0.1,
    springConstant: 16,
    damping: 2.5, // ζ = 2.5/2.53 ≈ 1.0 (critical damping)
    initialPosition: 1.0,
    drivingAmplitude: 0.01, // 1 cm displacement
    drivingFrequency: 2.0, // At natural frequency
  },
  {
    nameKey: "overdamped",
    mass: 0.1,
    springConstant: 16,
    damping: 4.0, // ζ = 4.0/2.53 ≈ 1.6 (overdamped)
    initialPosition: 1.0,
    drivingAmplitude: 0.01, // 1 cm displacement
    drivingFrequency: 2.0, // At natural frequency
  },
  {
    nameKey: "resonanceDemo",
    mass: 1.0,
    springConstant: 10.0,
    damping: 0.3, // Light damping for clear resonance
    initialPosition: 0.5,
    drivingAmplitude: 0.01, // 1 cm displacement
    drivingFrequency: 0.503, // Exactly at natural frequency √(10/1)/(2π) ≈ 0.503 Hz
  },
];
