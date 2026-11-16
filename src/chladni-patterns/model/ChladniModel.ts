/**
 * ChladniModel.ts
 *
 * Model for the Chladni plate pattern visualization.
 *
 * Physics:
 * - Chladni patterns form when particles on a vibrating plate migrate to nodal lines
 * - The displacement psi(x, y) is calculated using modal superposition
 * - Particles perform a biased random walk, moving faster in high-displacement regions
 *
 * The wave equation solution uses:
 * - Wave number k = sqrt(frequency / C) where C is the material dispersion constant
 * - Modal superposition over (m, n) modes with m, n = 0, 1, 2, ..., MAX_MODE
 * - For rectangular plate with dimensions a (width) × b (height):
 *   k_{m,n} = π√((m/a)² + (n/b)²)
 * - Damping term gamma = 0.02 / √(a*b) (geometric mean of dimensions)
 *
 * This model coordinates between specialized submodules:
 * - PlateGeometry: Plate dimensions and bounds
 * - ModalCalculator: Physics calculations
 * - ParticleManager: Particle simulation
 * - ResonanceCurveCalculator: Curve precomputation
 * - FrequencySweepController: Sweep functionality
 * - PlaybackStateMachine: Animation state management
 */

import { Multilink, NumberProperty, Property, StringUnionProperty } from "scenerystack/axon";
import { Range, Vector2 } from "scenerystack/dot";
import { FrequencySweepController } from "../../common/model/FrequencySweepController.js";
import type { BoundaryMode, GrainCountOption } from "./ChladniConstants.js";
import {
  DEFAULT_BOUNDARY_MODE,
  DEFAULT_EXCITATION_X,
  DEFAULT_EXCITATION_Y,
  DEFAULT_GRAIN_COUNT,
  FREQUENCY_DEFAULT,
  FREQUENCY_MAX,
  FREQUENCY_MIN,
  SWEEP_RATE,
} from "./ChladniConstants.js";
import { Material, type MaterialType } from "./Material.js";
import { ModalCalculator } from "./ModalCalculator.js";
import { ParticleManager } from "./ParticleManager.js";
import { PlateGeometry } from "./PlateGeometry.js";
import { type PlaybackState, PlaybackStateMachine } from "./PlaybackStateMachine.js";
import { ResonanceCurveCalculator } from "./ResonanceCurveCalculator.js";

// Re-export types for backward compatibility
export type { BoundaryMode, GrainCountOption } from "./ChladniConstants.js";
export { GRAIN_COUNT_OPTIONS } from "./ChladniConstants.js";

/**
 * Valid time speed values for the Chladni simulation.
 */
const ChladniTimeSpeedValues = ["slow", "normal"] as const;
export type ChladniTimeSpeed = (typeof ChladniTimeSpeedValues)[number];

/**
 * Time speed multipliers matching the oscillator screens.
 */
const TIME_SPEED_MULTIPLIERS: Record<ChladniTimeSpeed, number> = {
  slow: 0.1,
  normal: 1.0,
};

export class ChladniModel {
  // Material selection
  public readonly materialProperty: Property<MaterialType>;

  // Frequency control - single slider covering full range
  public readonly frequencyProperty: NumberProperty;

  // Full frequency range
  public readonly frequencyRange: Range;

  // Time speed control (slow = 0.1x, normal = 1.0x)
  public readonly timeSpeedProperty: StringUnionProperty<ChladniTimeSpeed>;

  // Excitation position (centered model coordinates)
  // This is where the plate is driven (e.g., by a speaker or vibrator)
  public readonly excitationPositionProperty: Property<Vector2>;

  // Grain count selection (number of particles)
  public readonly grainCountProperty: Property<GrainCountOption>;

  // Boundary handling mode: clamp particles to edges or remove them
  public readonly boundaryModeProperty: Property<BoundaryMode>;

  // --- Extracted Modules ---

  // Plate geometry manager
  private readonly plateGeometry: PlateGeometry;

  // Modal calculator for physics
  private readonly modalCalculator: ModalCalculator;

  // Particle manager
  private readonly particleManager: ParticleManager;

  // Resonance curve calculator
  private readonly resonanceCurveCalculator: ResonanceCurveCalculator;

  // Frequency sweep controller
  private readonly sweepController: FrequencySweepController;

  // Playback state machine
  private readonly playbackStateMachine: PlaybackStateMachine;

  // Cached wave number for current frequency
  private cachedWaveNumber: number;

  // --- Public Properties (delegated to modules) ---

  // Animation state (from playback state machine)
  public get isPlayingProperty() {
    return this.playbackStateMachine.isPlayingProperty;
  }

  // Frequency sweep state (from sweep controller)
  public get isSweepingProperty() {
    return this.sweepController.isSweepingProperty;
  }

  // Frequency sweep completion emitter (from sweep controller)
  public get sweepCompletedEmitter() {
    return this.sweepController.sweepCompletedEmitter;
  }

  // Whether a sweep is active, including paused sweep (from playback state machine)
  public get isSweepActiveProperty() {
    return this.playbackStateMachine.isSweepActiveProperty;
  }

  // Plate dimensions (from plate geometry)
  public get plateWidthProperty() {
    return this.plateGeometry.widthProperty;
  }

  public get plateHeightProperty() {
    return this.plateGeometry.heightProperty;
  }

  // Actual particle count (from particle manager)
  public readonly actualParticleCountProperty: NumberProperty;

  // Particle positions (from particle manager)
  public get particlePositions(): Vector2[] {
    return this.particleManager.particlePositions;
  }

  // Current wave number (for modal visualization)
  public get waveNumber(): number {
    return this.cachedWaveNumber;
  }

  public constructor() {
    // Initialize material to aluminum (good mid-range dispersion)
    this.materialProperty = new Property<MaterialType>(Material.ALUMINUM);

    // Initialize frequency with full range
    this.frequencyRange = new Range(FREQUENCY_MIN, FREQUENCY_MAX);
    this.frequencyProperty = new NumberProperty(FREQUENCY_DEFAULT, {
      range: this.frequencyRange,
    });

    // Initialize time speed
    this.timeSpeedProperty = new StringUnionProperty<ChladniTimeSpeed>("normal", {
      validValues: ChladniTimeSpeedValues,
    });

    // Initialize excitation position at center of plate
    this.excitationPositionProperty = new Property<Vector2>(new Vector2(DEFAULT_EXCITATION_X, DEFAULT_EXCITATION_Y));

    // Initialize grain count to default (10,000)
    this.grainCountProperty = new Property<GrainCountOption>(DEFAULT_GRAIN_COUNT);

    // Initialize boundary mode
    this.boundaryModeProperty = new StringUnionProperty<BoundaryMode>(DEFAULT_BOUNDARY_MODE, {
      validValues: ["clamp", "remove"],
    });

    // --- Initialize Extracted Modules ---

    // Create plate geometry manager
    this.plateGeometry = new PlateGeometry();

    // Create playback state machine
    this.playbackStateMachine = new PlaybackStateMachine();

    // Create frequency sweep controller
    this.sweepController = new FrequencySweepController({
      frequencyProperty: this.frequencyProperty,
      frequencyRange: this.frequencyRange,
      sweepRate: SWEEP_RATE,
    });

    // Listen for sweep completion from the Animation-based controller
    this.sweepController.sweepCompletedEmitter.addListener(() => {
      this.playbackStateMachine.onSweepComplete();
    });

    // Pause/resume sweep animation based on playback state
    this.playbackStateMachine.isPlayingProperty.lazyLink((isPlaying) => {
      if (this.sweepController.isSweeping) {
        if (isPlaying) {
          this.sweepController.resumeSweep();
        } else {
          this.sweepController.pauseSweep();
        }
      }
    });

    // Update sweep speed when time speed changes
    this.timeSpeedProperty.lazyLink((speed: ChladniTimeSpeed) => {
      this.sweepController.setSpeedFactor(TIME_SPEED_MULTIPLIERS[speed]);
    });

    // Create modal calculator
    this.modalCalculator = new ModalCalculator({
      materialProperty: this.materialProperty,
      plateWidthProperty: this.plateGeometry.widthProperty,
      plateHeightProperty: this.plateGeometry.heightProperty,
      excitationPositionProperty: this.excitationPositionProperty,
    });

    // Create particle manager
    this.particleManager = new ParticleManager({
      grainCountProperty: this.grainCountProperty,
      plateWidthProperty: this.plateGeometry.widthProperty,
      plateHeightProperty: this.plateGeometry.heightProperty,
      boundaryModeProperty: this.boundaryModeProperty,
      isPlayingProperty: this.playbackStateMachine.isPlayingProperty,
    });

    // Create resonance curve calculator
    this.resonanceCurveCalculator = new ResonanceCurveCalculator({
      modalCalculator: this.modalCalculator,
    });

    // Expose actual particle count from particle manager
    this.actualParticleCountProperty = this.particleManager.actualParticleCountProperty;

    // Initialize particles
    this.particleManager.initialize();

    // Cache initial wave number
    this.cachedWaveNumber = this.modalCalculator.calculateWaveNumber(this.frequencyProperty.value);

    // Initialize precomputed resonance curve
    this.resonanceCurveCalculator.recompute();

    // --- Set Up Property Links ---

    // Update cached wave number when frequency changes
    this.frequencyProperty.link(() => {
      this.cachedWaveNumber = this.modalCalculator.calculateWaveNumber(this.frequencyProperty.value);
    });

    // Recompute resonance curve when material or excitation position changes
    this.materialProperty.link(() => {
      this.cachedWaveNumber = this.modalCalculator.calculateWaveNumber(this.frequencyProperty.value);
      this.modalCalculator.invalidateModeCache();
      this.resonanceCurveCalculator.recompute();
    });

    this.excitationPositionProperty.link(() => {
      this.modalCalculator.invalidateModeCache();
      this.resonanceCurveCalculator.recompute();
    });

    // Regenerate particles when grain count changes
    this.grainCountProperty.lazyLink(() => {
      this.particleManager.initialize();
    });

    // Recompute when plate dimensions change - using Multilink for coordinated updates
    Multilink.lazyMultilink([this.plateGeometry.widthProperty, this.plateGeometry.heightProperty], () => {
      this.modalCalculator.updateCachedDamping();
      this.resonanceCurveCalculator.recompute();
      this.particleManager.clampToBounds();
      this.plateGeometry.clampExcitationPosition(this.excitationPositionProperty);
    });
  }

  /**
   * Get the precomputed resonance curve data for the current visible window.
   * Returns an array of {frequency, normalizedStrength} points ready for plotting.
   */
  public getResonanceCurveData(sampleCount: number): Vector2[] {
    return this.resonanceCurveCalculator.getData(this.frequencyProperty.value, sampleCount);
  }

  /**
   * Get the visible frequency range for the resonance curve graph.
   * Returns a window centered on the current frequency.
   */
  public getGraphWindowRange(): Range {
    return this.resonanceCurveCalculator.getGraphWindowRange(this.frequencyProperty.value);
  }

  /**
   * Calculate the displacement psi at a given point (x, y).
   * Delegates to ModalCalculator using the cached wave number.
   */
  public psi(x: number, y: number): number {
    return this.modalCalculator.psi(x, y, this.cachedWaveNumber);
  }

  /**
   * Step the simulation forward by dt seconds.
   * The dt is scaled by the current time speed multiplier.
   */
  public step(dt: number, forceStep: boolean = false): void {
    // Note: Frequency sweep is now handled automatically by Animation in the sweep controller.
    // The animation runs independently and notifies completion via sweepCompletedEmitter.

    // Scale dt by time speed multiplier
    const speed: ChladniTimeSpeed = this.timeSpeedProperty.value;
    const adjustedDt = dt * TIME_SPEED_MULTIPLIERS[speed];

    // Delegate particle stepping to particle manager
    this.particleManager.step(adjustedDt, (x, y) => this.psi(x, y), forceStep);
  }

  /**
   * Start a frequency sweep from minimum to maximum frequency.
   */
  public startSweep(): void {
    this.sweepController.startSweep();
    this.playbackStateMachine.startSweep();
  }

  /**
   * Stop an active frequency sweep.
   */
  public stopSweep(): void {
    this.sweepController.stopSweep();
    this.playbackStateMachine.stopSweep();
  }

  /**
   * Toggle the frequency sweep: start if not sweeping, stop if sweeping.
   */
  public toggleSweep(): void {
    if (this.isSweepingProperty.value) {
      this.stopSweep();
    } else {
      this.startSweep();
    }
  }

  /**
   * Reset the model to initial state.
   */
  public reset(): void {
    this.materialProperty.reset();
    this.frequencyProperty.reset();
    this.excitationPositionProperty.reset();
    this.grainCountProperty.reset();
    this.boundaryModeProperty.reset();
    this.timeSpeedProperty.reset();

    // Reset extracted modules
    this.plateGeometry.reset();
    this.sweepController.reset();
    this.playbackStateMachine.reset();

    // Reinitialize particles
    this.particleManager.initialize();

    // Update cached values
    this.cachedWaveNumber = this.modalCalculator.calculateWaveNumber(this.frequencyProperty.value);
    this.modalCalculator.updateCachedDamping();
  }

  /**
   * Regenerate particles with new random positions.
   */
  public regenerateParticles(): void {
    this.particleManager.regenerate();
  }

  /**
   * Calculate the resonance strength/amplitude at a given frequency.
   * Delegates to ModalCalculator.
   */
  public strength(freq: number): number {
    return this.modalCalculator.strength(freq);
  }

  /**
   * Get the current playback state.
   */
  public get playbackState(): PlaybackState {
    return this.playbackStateMachine.state;
  }

  /**
   * Get the playback state machine for advanced state management.
   */
  public getPlaybackStateMachine(): PlaybackStateMachine {
    return this.playbackStateMachine;
  }

  /**
   * Get the plate geometry manager for bounds calculations.
   */
  public getPlateGeometry(): PlateGeometry {
    return this.plateGeometry;
  }

  // --- Convenience Getters ---

  /** @unused Not referenced outside this class. */
  public get frequency(): number {
    return this.frequencyProperty.value;
  }

  /** @unused Not referenced outside this class. */
  public get materialName(): string {
    return this.materialProperty.value.name;
  }

  /** @unused Not referenced outside this class. */
  public get particleCount(): number {
    return this.grainCountProperty.value.value;
  }

  public get plateWidth(): number {
    return this.plateGeometry.width;
  }

  public get plateHeight(): number {
    return this.plateGeometry.height;
  }

  /** @unused Not referenced outside this class. */
  public get aspectRatio(): number {
    return this.plateGeometry.aspectRatio;
  }

  /** @unused Not referenced outside this class. */
  public get defaultPlateWidth(): number {
    return this.plateGeometry.defaultWidth;
  }

  /** @unused Not referenced outside this class. */
  public get defaultPlateHeight(): number {
    return this.plateGeometry.defaultHeight;
  }
}
