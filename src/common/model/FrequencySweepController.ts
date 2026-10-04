/**
 * FrequencySweepController.ts
 *
 * Controls the frequency sweep functionality for simulation screens.
 *
 * A frequency sweep automatically increases the frequency from minimum to maximum
 * over time, allowing users to observe how patterns change across the frequency range.
 *
 * Uses scenerystack's Animation class for built-in timing, completion detection,
 * and integration with the global animation timer.
 */

import { BooleanProperty, Emitter, type NumberProperty } from "scenerystack/axon";
import type { Range } from "scenerystack/dot";
import { Animation, Easing } from "scenerystack/twixt";

/**
 * Options for creating a FrequencySweepController
 */
export interface FrequencySweepControllerOptions {
  frequencyProperty: NumberProperty;
  frequencyRange: Range;
  /**
   * Sweep rate in Hz per second.
   */
  sweepRate: number;
}

/**
 * FrequencySweepController manages the frequency sweep using scenerystack's Animation.
 * It handles starting, stopping, and automatically stepping through frequency sweeps.
 */
export class FrequencySweepController {
  private readonly frequencyProperty: NumberProperty;
  private readonly frequencyRange: Range;

  /**
   * Whether a frequency sweep is currently active (animation running or paused).
   */
  public readonly isSweepingProperty: BooleanProperty;

  /**
   * The base rate at which frequency increases during a sweep (Hz per second).
   */
  private readonly baseSweepRate: number;

  /**
   * Speed factor applied to the sweep rate (e.g., 0.1 for slow mode).
   * The effective sweep rate is baseSweepRate * speedFactor.
   */
  private speedFactor: number = 1;

  /**
   * Emitter that fires when a sweep completes naturally (reaches max frequency).
   */
  public readonly sweepCompletedEmitter: Emitter;

  /**
   * The current animation instance, or null if no sweep is active.
   */
  private sweepAnimation: Animation | null = null;

  /**
   * Stores the frequency when sweep is paused for resume capability.
   */
  private pausedFrequency: number | null = null;

  public constructor(options: FrequencySweepControllerOptions) {
    this.frequencyProperty = options.frequencyProperty;
    this.frequencyRange = options.frequencyRange;

    // Initialize sweep state
    this.isSweepingProperty = new BooleanProperty(false);

    // Base sweep rate from options
    this.baseSweepRate = options.sweepRate;

    // Create emitter for sweep completion
    this.sweepCompletedEmitter = new Emitter();
  }

  /**
   * Get the effective sweep rate, accounting for the speed factor.
   */
  private getEffectiveSweepRate(): number {
    return this.baseSweepRate * this.speedFactor;
  }

  /**
   * Calculate the duration for a sweep from a given start frequency to max.
   */
  private calculateDuration(fromFrequency: number): number {
    return (this.frequencyRange.max - fromFrequency) / this.getEffectiveSweepRate();
  }

  /**
   * Create and start a new animation from the current frequency to max.
   */
  private createAndStartAnimation(fromFrequency: number): void {
    // Clean up any existing animation
    this.disposeAnimation();

    const duration = this.calculateDuration(fromFrequency);

    // Create the sweep animation using twixt
    this.sweepAnimation = new Animation({
      property: this.frequencyProperty,
      to: this.frequencyRange.max,
      from: fromFrequency,
      duration: duration,
      easing: Easing.LINEAR,
    });

    // Listen for sweep completion
    this.sweepAnimation.finishEmitter.addListener(() => {
      this.isSweepingProperty.value = false;
      this.pausedFrequency = null;
      this.sweepCompletedEmitter.emit();
    });

    // Start the animation
    this.sweepAnimation.start();
    this.isSweepingProperty.value = true;
  }

  /**
   * Dispose the current animation if it exists.
   */
  private disposeAnimation(): void {
    if (this.sweepAnimation) {
      this.sweepAnimation.stop();
      this.sweepAnimation = null;
    }
  }

  /**
   * Start a frequency sweep from minimum to maximum frequency.
   * The frequency will be reset to minimum and sweeping state activated.
   */
  public startSweep(): void {
    this.pausedFrequency = null;
    this.frequencyProperty.value = this.frequencyRange.min;
    this.createAndStartAnimation(this.frequencyRange.min);
  }

  /**
   * Stop an active frequency sweep.
   * The current frequency is preserved.
   */
  public stopSweep(): void {
    this.disposeAnimation();
    this.isSweepingProperty.value = false;
    this.pausedFrequency = null;
  }

  /**
   * Pause the sweep, preserving the current position for later resume.
   */
  public pauseSweep(): void {
    if (this.sweepAnimation && this.isSweepingProperty.value) {
      this.pausedFrequency = this.frequencyProperty.value;
      this.disposeAnimation();
      // Keep isSweepingProperty true to indicate sweep can be resumed
    }
  }

  /**
   * Resume a paused sweep from where it left off.
   */
  public resumeSweep(): void {
    if (this.pausedFrequency !== null && this.isSweepingProperty.value) {
      this.createAndStartAnimation(this.pausedFrequency);
      this.pausedFrequency = null;
    }
  }

  /**
   * Toggle the sweep state.
   * If sweeping, stops the sweep. If not sweeping, starts a new sweep.
   */
  public toggleSweep(): void {
    if (this.isSweepingProperty.value) {
      this.stopSweep();
    } else {
      this.startSweep();
    }
  }

  /**
   * Update the speed factor for the sweep animation.
   * If a sweep is currently running (not paused), the animation is restarted
   * from the current frequency with the new speed.
   *
   * @param factor - Speed multiplier (e.g., 0.1 for slow, 1.0 for normal)
   */
  public setSpeedFactor(factor: number): void {
    if (this.speedFactor === factor) {
      return;
    }
    this.speedFactor = factor;

    // If actively animating (not paused), restart animation with new speed
    if (this.sweepAnimation && this.isSweepingProperty.value && this.pausedFrequency === null) {
      const currentFreq = this.frequencyProperty.value;
      this.createAndStartAnimation(currentFreq);
    }
  }

  /**
   * Check if a sweep is currently active.
   */
  public get isSweeping(): boolean {
    return this.isSweepingProperty.value;
  }

  /**
   * Reset the sweep controller to initial state.
   */
  public reset(): void {
    this.disposeAnimation();
    this.pausedFrequency = null;
    this.isSweepingProperty.reset();
  }
}
