/**
 * ResonanceCurveCalculator.ts
 *
 * Handles the calculation and caching of resonance curve data for the Chladni plate.
 * Extracted from ChladniModel for separation of concerns.
 *
 * The resonance curve shows the amplitude response vs frequency, with peaks at
 * resonant frequencies where modes are strongly excited.
 *
 * Performance: Supports progressive computation that spreads work across multiple
 * frames to avoid blocking the UI thread. Falls back to synchronous computation
 * when needed for immediate results.
 */

import { Range, roundSymmetric, Vector2 } from "scenerystack/dot";
import {
  CURVE_SAMPLES_PER_HZ,
  FREQUENCY_MAX,
  FREQUENCY_MIN,
  GRAPH_WINDOW_WIDTH,
  TOTAL_CURVE_SAMPLES,
} from "./ChladniConstants.js";
import type { ModalCalculator } from "./ModalCalculator.js";

/**
 * Options for creating a ResonanceCurveCalculator
 */
export interface ResonanceCurveCalculatorOptions {
  modalCalculator: ModalCalculator;
}

/**
 * Number of samples to compute per chunk in progressive mode.
 * Tuned to complete in ~2-3ms per chunk (16ms frame budget allows for other work).
 */
const PROGRESSIVE_CHUNK_SIZE = 500;

/**
 * Callback type for progressive computation completion
 */
export type ProgressCallback = (progress: number) => void;

/**
 * ResonanceCurveCalculator handles precomputation and retrieval of resonance curve data.
 * It maintains a cache of strength values across the full frequency range for efficient
 * graph rendering.
 *
 * Supports two computation modes:
 * - Synchronous: Blocks until complete (use for initial load or when immediate results needed)
 * - Progressive: Spreads work across frames (use for real-time updates)
 */
export class ResonanceCurveCalculator {
  private readonly modalCalculator: ModalCalculator;

  // Precomputed resonance curve data
  private readonly precomputedStrengths: Float32Array;
  private precomputedMaxStrength: number;

  // Progressive computation state
  private progressiveIndex: number = 0;
  private progressiveMaxStrength: number = 0;
  private progressiveAnimationId: number | null = null;
  private isComputationValid: boolean = false;
  private computationVersion: number = 0;

  // Cached data points for getData() to avoid allocations
  private cachedDataPoints: Vector2[] = [];
  private cachedDataSampleCount: number = 0;

  public constructor(options: ResonanceCurveCalculatorOptions) {
    this.modalCalculator = options.modalCalculator;

    // Initialize precomputed resonance curve storage
    this.precomputedStrengths = new Float32Array(TOTAL_CURVE_SAMPLES);
    this.precomputedMaxStrength = 0;
  }

  /**
   * Recompute the full resonance curve synchronously.
   * Blocks until complete. Use for initial load or when immediate results needed.
   */
  public recompute(): void {
    // Cancel any in-progress progressive computation
    this.cancelProgressiveComputation();

    let maxStrength = 0;

    for (let i = 0; i < TOTAL_CURVE_SAMPLES; i++) {
      const freq = FREQUENCY_MIN + i / CURVE_SAMPLES_PER_HZ;
      const s = this.modalCalculator.strength(freq);
      this.precomputedStrengths[i] = s;
      if (s > maxStrength) {
        maxStrength = s;
      }
    }

    this.precomputedMaxStrength = maxStrength;
    this.isComputationValid = true;
    this.computationVersion++;
  }

  /**
   * Start progressive recomputation that spreads work across multiple frames.
   * Returns a promise that resolves when computation is complete.
   *
   * @param onProgress - Optional callback called with progress (0-1) after each chunk
   * @returns Promise that resolves when computation is complete
   */
  public recomputeProgressive(onProgress?: ProgressCallback): Promise<void> {
    // Cancel any in-progress computation
    this.cancelProgressiveComputation();

    // Increment version to invalidate any stale callbacks
    const version = ++this.computationVersion;
    this.isComputationValid = false;

    // Initialize progressive state
    this.progressiveIndex = 0;
    this.progressiveMaxStrength = 0;

    return new Promise<void>((resolve) => {
      const processChunk = () => {
        // Check if this computation was superseded
        if (version !== this.computationVersion) {
          resolve();
          return;
        }

        const endIndex = Math.min(this.progressiveIndex + PROGRESSIVE_CHUNK_SIZE, TOTAL_CURVE_SAMPLES);

        // Process this chunk
        for (let i = this.progressiveIndex; i < endIndex; i++) {
          const freq = FREQUENCY_MIN + i / CURVE_SAMPLES_PER_HZ;
          const s = this.modalCalculator.strength(freq);
          this.precomputedStrengths[i] = s;
          if (s > this.progressiveMaxStrength) {
            this.progressiveMaxStrength = s;
          }
        }

        this.progressiveIndex = endIndex;

        // Report progress
        if (onProgress) {
          onProgress(this.progressiveIndex / TOTAL_CURVE_SAMPLES);
        }

        // Check if complete
        if (this.progressiveIndex >= TOTAL_CURVE_SAMPLES) {
          this.precomputedMaxStrength = this.progressiveMaxStrength;
          this.isComputationValid = true;
          this.progressiveAnimationId = null;
          resolve();
        } else {
          // Schedule next chunk
          this.progressiveAnimationId = requestAnimationFrame(processChunk);
        }
      };

      // Start processing
      this.progressiveAnimationId = requestAnimationFrame(processChunk);
    });
  }

  /**
   * Cancel any in-progress progressive computation.
   */
  public cancelProgressiveComputation(): void {
    if (this.progressiveAnimationId !== null) {
      cancelAnimationFrame(this.progressiveAnimationId);
      this.progressiveAnimationId = null;
    }
  }

  /**
   * Check if the current computation is valid and complete.
   * @unused - Currently not used in the codebase but kept for future validation needs
   */
  public isValid(): boolean {
    return this.isComputationValid;
  }

  /**
   * Get the progress of the current progressive computation (0-1).
   * @unused - Currently not used in the codebase but kept for progress tracking features
   */
  public getProgress(): number {
    if (this.isComputationValid) {
      return 1;
    }
    return this.progressiveIndex / TOTAL_CURVE_SAMPLES;
  }

  /**
   * Get the precomputed resonance curve data for a given frequency window.
   * Returns an array of {frequency, normalizedStrength} points ready for plotting.
   *
   * Performance: Reuses a cached array of Vector2 objects to avoid allocations.
   *
   * @param currentFrequency - The current frequency to center the window on
   * @param sampleCount - The number of data points to return
   * @returns Array of Vector2 points with (frequency, normalizedStrength)
   */
  public getData(currentFrequency: number, sampleCount: number): Vector2[] {
    const range = this.getGraphWindowRange(currentFrequency);
    const freqMin = range.min;
    const freqMax = range.max;

    // Ensure cached array has correct size (only reallocate if size changes)
    if (this.cachedDataSampleCount !== sampleCount) {
      this.cachedDataPoints = new Array<Vector2>(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        this.cachedDataPoints[i] = new Vector2(0, 0);
      }
      this.cachedDataSampleCount = sampleCount;
    }

    const freqStep = sampleCount > 1 ? (freqMax - freqMin) / (sampleCount - 1) : 0;

    if (this.precomputedMaxStrength <= 0) {
      // No resonance data, return flat line
      for (let i = 0; i < sampleCount; i++) {
        const freq = freqMin + i * freqStep;
        this.cachedDataPoints[i]?.setXY(freq, 0);
      }
      return this.cachedDataPoints;
    }

    const invMaxStrength = 1 / this.precomputedMaxStrength;

    for (let i = 0; i < sampleCount; i++) {
      const freq = freqMin + i * freqStep;

      // Map frequency to precomputed array index
      const index = roundSymmetric((freq - FREQUENCY_MIN) * CURVE_SAMPLES_PER_HZ);
      const clampedIndex = Math.max(0, Math.min(TOTAL_CURVE_SAMPLES - 1, index));

      const strength = this.precomputedStrengths[clampedIndex]!;
      const normalized = Math.min(strength * invMaxStrength, 1);

      this.cachedDataPoints[i]?.setXY(freq, normalized);
    }

    return this.cachedDataPoints;
  }

  /**
   * Get the visible frequency range for the resonance curve graph.
   * Returns a window centered on the given frequency.
   *
   * @param currentFrequency - The frequency to center the window on
   * @returns Range representing the visible frequency window
   */
  public getGraphWindowRange(currentFrequency: number): Range {
    const halfWindow = GRAPH_WINDOW_WIDTH / 2;

    let min = currentFrequency - halfWindow;
    let max = currentFrequency + halfWindow;

    // Clamp to valid frequency range
    if (min < FREQUENCY_MIN) {
      min = FREQUENCY_MIN;
      max = Math.min(FREQUENCY_MIN + GRAPH_WINDOW_WIDTH, FREQUENCY_MAX);
    }
    if (max > FREQUENCY_MAX) {
      max = FREQUENCY_MAX;
      min = Math.max(FREQUENCY_MAX - GRAPH_WINDOW_WIDTH, FREQUENCY_MIN);
    }

    return new Range(min, max);
  }

  /**
   * Get the maximum precomputed strength value.
   * Useful for normalization purposes.
   * @unused - Currently not used in the codebase but kept for external analysis tools
   */
  public getMaxStrength(): number {
    return this.precomputedMaxStrength;
  }

  /**
   * Get the raw strength value at a specific index.
   * @param index - The index into the precomputed array
   * @unused - Currently not used in the codebase but kept for data inspection
   */
  public getStrengthAtIndex(index: number): number {
    const clampedIndex = Math.max(0, Math.min(TOTAL_CURVE_SAMPLES - 1, index));
    return this.precomputedStrengths[clampedIndex]!;
  }
}
