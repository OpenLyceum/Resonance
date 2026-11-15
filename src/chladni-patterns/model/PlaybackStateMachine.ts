/**
 * PlaybackStateMachine.ts
 *
 * Manages the playback state for the Chladni plate simulation.
 * Provides a clear state machine for animation control with well-defined
 * state transitions.
 *
 * States:
 * - idle: Animation is paused, no sweep active
 * - playing: Animation is running, particles moving
 * - sweeping: Animation is running with frequency sweep active
 * - paused_sweeping: Animation paused but sweep will resume when playing
 */

import { BooleanProperty, DerivedProperty, StringUnionProperty, type TReadOnlyProperty } from "scenerystack/axon";

/**
 * Valid playback state values.
 */
const PlaybackStateValues = ["idle", "playing", "sweeping", "paused_sweeping"] as const;

/**
 * Possible playback states for the simulation.
 */
export type PlaybackState = (typeof PlaybackStateValues)[number];

/**
 * PlaybackStateMachine manages the animation and sweep states with clear
 * state transitions and derived properties for UI binding.
 */
export class PlaybackStateMachine {
  /**
   * The current playback state using StringUnionProperty for type-safe validation.
   */
  public readonly stateProperty: StringUnionProperty<PlaybackState>;

  /**
   * Whether animation is currently playing (derived from state).
   * This is the primary property for play/pause button binding.
   */
  public readonly isPlayingProperty: BooleanProperty;

  /**
   * Whether a frequency sweep is active (derived from state).
   * True in both sweeping and paused_sweeping states.
   */
  public readonly isSweepActiveProperty: TReadOnlyProperty<boolean>;

  /**
   * Whether the simulation is actively animating (playing or sweeping).
   */
  public readonly isAnimatingProperty: TReadOnlyProperty<boolean>;

  public constructor() {
    // Initialize state to idle using StringUnionProperty with validation
    this.stateProperty = new StringUnionProperty<PlaybackState>("idle", {
      validValues: PlaybackStateValues,
    });

    // Create isPlayingProperty that stays in sync with state
    this.isPlayingProperty = new BooleanProperty(false);

    // Derive sweep active from state
    this.isSweepActiveProperty = new DerivedProperty(
      [this.stateProperty],
      (state) => state === "sweeping" || state === "paused_sweeping",
    );

    // Derive animating from state
    this.isAnimatingProperty = new DerivedProperty(
      [this.stateProperty],
      (state) => state === "playing" || state === "sweeping",
    );

    // Keep isPlayingProperty in sync with state changes
    this.stateProperty.link((state) => {
      const shouldBePlaying = state === "playing" || state === "sweeping";
      if (this.isPlayingProperty.value !== shouldBePlaying) {
        this.isPlayingProperty.value = shouldBePlaying;
      }
    });

    // Handle external changes to isPlayingProperty (from play/pause button)
    this.isPlayingProperty.lazyLink((isPlaying) => {
      this.handlePlayingChange(isPlaying);
    });
  }

  /**
   * Handle changes to isPlayingProperty from external sources (UI).
   */
  private handlePlayingChange(isPlaying: boolean): void {
    const currentState = this.stateProperty.value;

    if (isPlaying) {
      // Transitioning to playing
      if (currentState === "idle") {
        this.stateProperty.value = "playing";
      } else if (currentState === "paused_sweeping") {
        this.stateProperty.value = "sweeping";
      }
    } else if (currentState === "playing") {
      // Transitioning to paused from playing
      this.stateProperty.value = "idle";
    } else if (currentState === "sweeping") {
      // Transitioning to paused from sweeping
      this.stateProperty.value = "paused_sweeping";
    }
  }

  /**
   * Get the current playback state.
   */
  public get state(): PlaybackState {
    return this.stateProperty.value;
  }

  /**
   * Check if animation is currently playing.
   */
  public get isPlaying(): boolean {
    return this.isPlayingProperty.value;
  }

  /**
   * Check if a sweep is active (including when paused).
   */
  public get isSweepActive(): boolean {
    return this.isSweepActiveProperty.value;
  }

  /**
   * Check if currently in sweeping state (actively sweeping).
   */
  public get isSweeping(): boolean {
    return this.stateProperty.value === "sweeping";
  }

  /**
   * Start playing the animation.
   * If a sweep was paused, it resumes.
   */
  public play(): void {
    const currentState = this.stateProperty.value;

    if (currentState === "idle") {
      this.stateProperty.value = "playing";
    } else if (currentState === "paused_sweeping") {
      this.stateProperty.value = "sweeping";
    }
  }

  /**
   * Pause the animation.
   * If sweeping, the sweep is paused but remembered.
   */
  public pause(): void {
    const currentState = this.stateProperty.value;

    if (currentState === "playing") {
      this.stateProperty.value = "idle";
    } else if (currentState === "sweeping") {
      this.stateProperty.value = "paused_sweeping";
    }
  }

  /**
   * Toggle between playing and paused states.
   */
  public togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Start a frequency sweep.
   * Automatically starts playing if paused.
   */
  public startSweep(): void {
    this.stateProperty.value = "sweeping";
  }

  /**
   * Stop the frequency sweep.
   * Continues playing normally if was sweeping.
   */
  public stopSweep(): void {
    const currentState = this.stateProperty.value;

    if (currentState === "sweeping") {
      this.stateProperty.value = "playing";
    } else if (currentState === "paused_sweeping") {
      this.stateProperty.value = "idle";
    }
  }

  /**
   * Called when a sweep completes naturally (reaches max frequency).
   * Transitions to idle to stop the simulation (disable power).
   */
  public onSweepComplete(): void {
    this.stateProperty.value = "idle";
  }

  /**
   * Reset the state machine to initial state (idle).
   */
  public reset(): void {
    this.stateProperty.value = "idle";
    // isPlayingProperty will be updated via the link
  }

  /**
   * Check if a given state transition is valid.
   *
   * @param from - Current state
   * @param to - Target state
   * @returns true if the transition is valid
   * @unused - Currently not used in the codebase but kept for future validation needs
   */
  public isValidTransition(from: PlaybackState, to: PlaybackState): boolean {
    const pausedSweeping: PlaybackState = "paused_sweeping";
    const validTransitions: Record<PlaybackState, PlaybackState[]> = {
      idle: ["playing", "sweeping"],
      playing: ["idle", "sweeping"],
      sweeping: ["playing", pausedSweeping],
      [pausedSweeping]: ["idle", "sweeping"],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Get a human-readable description of the current state.
   * @unused - Currently not used in the codebase but kept for debugging purposes
   */
  public getStateDescription(): string {
    switch (this.stateProperty.value) {
      case "idle":
        return "Paused";
      case "playing":
        return "Playing";
      case "sweeping":
        return "Sweeping";
      case "paused_sweeping":
        return "Sweep Paused";
      default:
        return "Unknown";
    }
  }
}
