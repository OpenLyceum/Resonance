/**
 * Base model for oscillator-based screens (Single Oscillator, Multiple Oscillators, Phase Analysis).
 *
 * Manages multiple independent ResonanceModel instances (one per resonator).
 * The resonator configuration mode determines how masses and spring constants
 * are distributed across resonators.
 *
 * Frequencies are evenly distributed from 1.0 Hz (resonator 1) to 5.5 Hz (resonator 10):
 * f_i = 1.0 + (i-1) / (count-1) × (5.5 - 1.0) Hz
 *
 * - SAME_MASS: All resonators have mass = 1 kg; spring constants calculated to match target frequencies
 * - SAME_SPRING_CONSTANT: All resonators have k = 200 N/m; masses calculated to match target frequencies
 * - MIXED: Both mass and spring constant scale proportionally (m_i = i×m₁, k_i = i×k₁)
 *   → All frequencies equal (resonance at same frequency)
 * - SAME_FREQUENCY: Same as MIXED (both scale proportionally to maintain constant f)
 * - CUSTOM: User sets all parameters manually
 */

import { NumberProperty, Property } from "scenerystack/axon";
import type { ResonancePreferencesModel } from "../../preferences/ResonancePreferencesModel.js";
import ResonanceConstants from "../../ResonanceConstants.js";
import { CircularUpdateGuard } from "../util/index.js";
import type { TimeSpeed } from "./BaseModel.js";
import { FrequencySweepController } from "./FrequencySweepController.js";
import { ResonanceModel } from "./ResonanceModel.js";
import { ResonatorConfigMode, type ResonatorConfigModeType } from "./ResonatorConfigMode.js";

export type BaseOscillatorScreenModelOptions = {
  /**
   * When true, the model only supports a single oscillator.
   * This affects the UI to hide multi-oscillator controls.
   */
  singleOscillatorMode?: boolean;
};

export class BaseOscillatorScreenModel {
  // The first resonance model acts as the "reference" model that controls
  // drive parameters, damping, gravity, etc. shared across all resonators.
  public readonly resonanceModel: ResonanceModel;

  // All resonator models (index 0 is the same as resonanceModel)
  public readonly resonatorModels: ResonanceModel[];

  // The resonator configuration mode
  public readonly resonatorConfigProperty: Property<ResonatorConfigModeType>;

  // Number of active resonators
  public readonly resonatorCountProperty: NumberProperty;

  // Index of the currently selected resonator for editing (0-indexed)
  public readonly selectedResonatorIndexProperty: NumberProperty;

  // Frequency sweep controller for automatic frequency sweeping
  public readonly sweepController: FrequencySweepController;

  protected readonly preferencesModel: ResonancePreferencesModel;

  // Guard to prevent circular updates when parameters change
  private readonly parameterGuard = new CircularUpdateGuard();

  // Maximum number of resonators supported
  public static readonly MAX_RESONATORS = 10;

  /**
   * When true, the model only supports a single oscillator.
   * This is used by the view to hide multi-oscillator controls.
   */
  public readonly singleOscillatorMode: boolean;

  /**
   * Property controlling whether the simulation is playing.
   * Delegates to the reference resonance model.
   */
  public get isPlayingProperty() {
    return this.resonanceModel.isPlayingProperty;
  }

  public constructor(preferencesModel: ResonancePreferencesModel, options?: BaseOscillatorScreenModelOptions) {
    this.preferencesModel = preferencesModel;
    this.singleOscillatorMode = options?.singleOscillatorMode ?? false;
    this.resonanceModel = new ResonanceModel(preferencesModel);
    this.resonatorModels = [this.resonanceModel];

    this.resonatorConfigProperty = new Property<ResonatorConfigModeType>(ResonatorConfigMode.SAME_MASS);

    this.resonatorCountProperty = new NumberProperty(1);
    this.selectedResonatorIndexProperty = new NumberProperty(0); // Start with first resonator selected

    // Initialize frequency sweep controller
    this.sweepController = new FrequencySweepController({
      frequencyProperty: this.resonanceModel.drivingFrequencyProperty,
      frequencyRange: ResonanceConstants.FREQUENCY_RANGE,
      sweepRate: ResonanceConstants.OSCILLATOR_SWEEP_RATE,
    });

    // When sweep completes, turn off driving (power off) and stop playback
    this.sweepController.sweepCompletedEmitter.addListener(() => {
      this.resonanceModel.drivingEnabledProperty.value = false;
      this.resonanceModel.isPlayingProperty.value = false;
    });

    // Pause/resume sweep animation based on playback state
    this.resonanceModel.isPlayingProperty.lazyLink((isPlaying: boolean) => {
      if (this.sweepController.isSweeping) {
        if (isPlaying) {
          this.sweepController.resumeSweep();
        } else {
          this.sweepController.pauseSweep();
        }
      }
    });

    // Update sweep speed factor when time speed changes
    const timeSpeedMultipliers: Record<string, number> = {
      slow: 0.1,
      normal: 1.0,
      fast: 2.0,
    };
    this.resonanceModel.timeSpeedProperty.lazyLink((speed: string) => {
      const factor = timeSpeedMultipliers[speed] ?? 1.0;
      this.sweepController.setSpeedFactor(factor);
    });

    // Pre-create all resonator models
    for (let i = 1; i < BaseOscillatorScreenModel.MAX_RESONATORS; i++) {
      const model = new ResonanceModel(preferencesModel);
      this.resonatorModels.push(model);
    }

    // Sync shared parameters from the reference model to all others
    this.syncSharedParameters();

    // When config mode changes, recalculate per-resonator parameters
    // Reset base resonator to default values for the mode
    this.resonatorConfigProperty.link(() => {
      this.updateResonatorParameters(true);
    });

    // When resonator count changes, recalculate parameters and clamp selected index
    this.resonatorCountProperty.link((count: number) => {
      this.updateResonatorParameters(false);
      // Clamp selected resonator index to valid range [0, count-1]
      if (this.selectedResonatorIndexProperty.value >= count) {
        this.selectedResonatorIndexProperty.value = count - 1;
      }
    });

    // When base mass or spring constant changes, recalculate other resonators
    // But only if we're in a preset mode (not CUSTOM)
    this.resonanceModel.massProperty.link(() => {
      if (!this.parameterGuard.isUpdating) {
        const mode = this.resonatorConfigProperty.value;
        // In SAME_MASS or SAME_FREQUENCY/MIXED modes, update when mass changes
        if (
          mode === ResonatorConfigMode.SAME_MASS ||
          mode === ResonatorConfigMode.MIXED ||
          mode === ResonatorConfigMode.SAME_FREQUENCY
        ) {
          this.updateResonatorParameters(false);
        }
      }
    });

    this.resonanceModel.springConstantProperty.link(() => {
      if (!this.parameterGuard.isUpdating) {
        const mode = this.resonatorConfigProperty.value;
        // In SAME_SPRING_CONSTANT or SAME_FREQUENCY/MIXED modes, update when k changes
        if (
          mode === ResonatorConfigMode.SAME_SPRING_CONSTANT ||
          mode === ResonatorConfigMode.MIXED ||
          mode === ResonatorConfigMode.SAME_FREQUENCY
        ) {
          this.updateResonatorParameters(false);
        }
      }
    });
  }

  /**
   * Keep shared parameters (driving force, damping, gravity) in sync
   * across all resonator models.
   */
  private syncSharedParameters(): void {
    const ref = this.resonanceModel;

    for (let i = 1; i < this.resonatorModels.length; i++) {
      const model = this.getResonatorModel(i);

      // Sync driving parameters
      ref.drivingEnabledProperty.link((enabled: boolean) => {
        model.drivingEnabledProperty.value = enabled;
      });
      ref.drivingFrequencyProperty.link((freq: number) => {
        model.drivingFrequencyProperty.value = freq;
      });
      ref.drivingAmplitudeProperty.link((amp: number) => {
        model.drivingAmplitudeProperty.value = amp;
      });

      // Sync damping
      ref.dampingProperty.link((damping: number) => {
        model.dampingProperty.value = damping;
      });

      // Sync gravity
      ref.gravityProperty.link((gravity: number) => {
        model.gravityProperty.value = gravity;
      });

      // Sync time management
      ref.isPlayingProperty.link((playing: boolean) => {
        model.isPlayingProperty.value = playing;
      });
      ref.timeSpeedProperty.link((speed: TimeSpeed) => {
        model.timeSpeedProperty.value = speed;
      });
    }
  }

  /**
   * Update per-resonator mass and spring constant based on the current
   * configuration mode and the reference model's base values.
   *
   * Frequencies are distributed evenly from f_min (resonator 1) to f_max (last resonator).
   * Default: 1 Hz to 5.5 Hz for 10 resonators.
   *
   * @param resetBaseValues - If true, reset the base resonator to mode-specific defaults
   *                          (1 kg for SAME_MASS, 200 N/m for SAME_SPRING_CONSTANT)
   *                          If false, use current user-set values
   */
  private updateResonatorParameters(resetBaseValues: boolean = false): void {
    this.parameterGuard.run(() => {
      const mode = this.resonatorConfigProperty.value;
      const count = this.resonatorCountProperty.value;

      // Target frequency range
      const fMin = 1.0; // Hz
      const fMax = 5.5; // Hz

      // Set base resonator values when mode changes
      if (resetBaseValues) {
        const omegaMin = 2 * Math.PI * fMin;
        if (mode === ResonatorConfigMode.SAME_MASS) {
          // For same mass mode: m = 1 kg, calculate k for f = 1 Hz
          this.resonanceModel.massProperty.value = 1.0;
          this.resonanceModel.springConstantProperty.value = omegaMin * omegaMin * 1.0;
        } else if (mode === ResonatorConfigMode.SAME_SPRING_CONSTANT) {
          // For same spring constant mode: k = 200 N/m, calculate m for f = 1 Hz
          this.resonanceModel.springConstantProperty.value = 200.0;
          this.resonanceModel.massProperty.value = 200.0 / (omegaMin * omegaMin);
        }
      }

      // Use the base resonator's current mass and spring constant as reference
      // The user can adjust these via the control panel, and we calculate others from these values
      const baseMass = this.resonanceModel.massProperty.value;
      const baseK = this.resonanceModel.springConstantProperty.value;

      for (let i = 1; i < count; i++) {
        const model = this.getResonatorModel(i);

        // Calculate target frequency for this resonator (evenly distributed)
        // f_i = f_min + (i / (count - 1)) × (f_max - f_min)
        const targetFrequency = fMin + (i / (count - 1)) * (fMax - fMin);
        const omega = 2 * Math.PI * targetFrequency; // Angular frequency (rad/s)

        switch (mode) {
          case ResonatorConfigMode.SAME_MASS:
            // Same mass, vary spring constant to achieve target frequency
            // f = (1/2π) × √(k/m)  →  k = (2πf)² × m
            model.massProperty.value = baseMass;
            model.springConstantProperty.value = omega * omega * baseMass;
            break;

          case ResonatorConfigMode.SAME_SPRING_CONSTANT:
            // Same spring constant, vary mass to achieve target frequency
            // f = (1/2π) × √(k/m)  →  m = k / (2πf)²
            model.springConstantProperty.value = baseK;
            model.massProperty.value = baseK / (omega * omega);
            break;

          case ResonatorConfigMode.MIXED: {
            // Both vary: masses increase, spring constants increase proportionally
            // Keep natural frequency constant for all resonators
            const multiplier = i + 1;
            model.massProperty.value = baseMass * multiplier;
            model.springConstantProperty.value = baseK * multiplier;
            break;
          }

          case ResonatorConfigMode.SAME_FREQUENCY: {
            // Same natural frequency: ω₀ = √(k/m) remains constant
            // Keep k/m ratio constant by scaling both proportionally
            const multiplier2 = i + 1;
            model.massProperty.value = baseMass * multiplier2;
            model.springConstantProperty.value = baseK * multiplier2;
            break;
          }

          case ResonatorConfigMode.CUSTOM:
            // Custom mode: don't modify values, user sets them manually
            // Parameters remain as they are
            break;
        }
      }
    });
  }

  /**
   * Get the resonator model at the given index.
   * Use this instead of resonatorModels[index] for type-safe access with noUncheckedIndexedAccess.
   */
  public getResonatorModel(index: number): ResonanceModel {
    const model = this.resonatorModels[index];
    if (model === undefined) {
      throw new Error(`Resonator index ${index} out of range (0-${this.resonatorModels.length - 1})`);
    }
    return model;
  }

  /**
   * Get the mass for a given resonator index.
   */
  public getMass(index: number): number {
    return this.getResonatorModel(index).massProperty.value;
  }

  /**
   * Get the spring constant for a given resonator index.
   */
  public getSpringConstant(index: number): number {
    return this.getResonatorModel(index).springConstantProperty.value;
  }

  /**
   * Get the natural frequency (Hz) for a given resonator index.
   */
  public getNaturalFrequencyHz(index: number): number {
    return this.getResonatorModel(index).naturalFrequencyHzProperty.value;
  }

  /**
   * Start a frequency sweep from minimum to maximum frequency.
   * Enables driving and starts playback if not already playing.
   */
  public startSweep(): void {
    this.resonanceModel.drivingEnabledProperty.value = true;
    this.resonanceModel.isPlayingProperty.value = true;
    this.sweepController.startSweep();
  }

  /**
   * Stop an active frequency sweep.
   * The current frequency is preserved.
   */
  public stopSweep(): void {
    this.sweepController.stopSweep();
  }

  /**
   * Toggle the frequency sweep: start if not sweeping, stop if sweeping.
   */
  public toggleSweep(): void {
    if (this.sweepController.isSweeping) {
      this.stopSweep();
    } else {
      this.startSweep();
    }
  }

  public reset(): void {
    this.sweepController.reset();
    this.resonatorConfigProperty.reset();
    this.resonatorCountProperty.reset();
    this.selectedResonatorIndexProperty.reset();
    for (const model of this.resonatorModels) {
      model.reset();
    }
  }

  public step(dt: number, forceStep: boolean = false): void {
    const count = this.resonatorCountProperty.value;
    // Step all active resonators; dragged masses still advance the driver clock.
    // Since isPlayingProperty and timeSpeedProperty are synced,
    // they will all advance the same amount.
    for (let i = 0; i < count; i++) {
      const model = this.getResonatorModel(i);
      model.step(dt, forceStep);
    }
    // Inactive masses keep their state, but share the current driver phase.
    for (let i = count; i < this.resonatorModels.length; i++) {
      this.getResonatorModel(i).drivingPhaseProperty.value = this.resonanceModel.drivingPhaseProperty.value;
    }
  }
}
