/**
 * ResonanceSonification.ts
 *
 * Provides audio feedback for resonance detection in the Chladni plate simulation.
 * A tambo SoundGenerator plays a sine tone whose pitch follows the driving
 * frequency and whose level rises as the plate approaches a resonance peak.
 * soundManager owns the audio graph and the master sound toggle.
 */

import { DerivedProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { SoundGenerator, soundManager } from "scenerystack/tambo";
import type { ChladniModel } from "../model/ChladniModel.js";

/**
 * Threshold for considering the simulation to be "at resonance".
 * Normalized strength above this value triggers the resonance indicator.
 */
const RESONANCE_THRESHOLD = 0.7;

/** Minimum strength to produce any sound (below this is silent). */
const MIN_STRENGTH_FOR_SOUND = 0.1;

/** Audio frequency range for sonification (Hz). Maps simulation frequency to audible pitch. */
const MIN_AUDIO_FREQUENCY = 220;
const MAX_AUDIO_FREQUENCY = 880;

/** Volume range passed to SoundGenerator.setOutputLevel. */
const MIN_VOLUME = 0.0;
const MAX_VOLUME = 0.3;

/**
 * ResonanceSonification provides audio feedback for the Chladni plate simulation.
 * It generates a tone whose volume indicates proximity to resonance peaks.
 */
export class ResonanceSonification extends SoundGenerator {
  private readonly model: ChladniModel;
  private oscillator: OscillatorNode | null = null;

  public readonly isAtResonanceProperty: Property<boolean>;
  public readonly normalizedStrengthProperty: Property<number>;

  private maxStrength = 1;
  private strengthSampleCount = 0;

  public constructor(model: ChladniModel, audioEnabledProperty: TReadOnlyProperty<boolean>) {
    super({ initialOutputLevel: 0 });
    this.model = model;
    soundManager.addSoundGenerator(this);

    this.normalizedStrengthProperty = new Property<number>(0);
    this.isAtResonanceProperty = new Property<boolean>(false);

    audioEnabledProperty.link((enabled) => {
      this.enabledProperty.value = enabled;
    });

    model.frequencyProperty.link(() => {
      this.updateResonanceState();
    });

    model.materialProperty.link(() => {
      this.resetMaxStrength();
      this.updateResonanceState();
    });

    model.excitationPositionProperty.link(() => {
      this.resetMaxStrength();
      this.updateResonanceState();
    });

    const shouldPlayProperty = new DerivedProperty(
      [model.isPlayingProperty, this.fullyEnabledProperty],
      (isPlaying, fullyEnabled) => isPlaying && fullyEnabled,
    );

    shouldPlayProperty.link((shouldPlay) => {
      if (shouldPlay) {
        this.startTone();
      } else {
        this.stopTone();
      }
    });

    this.disposeEmitter.addListener(() => {
      this.stopTone();
      soundManager.removeSoundGenerator(this);
      shouldPlayProperty.dispose();
    });
  }

  private resetMaxStrength(): void {
    this.maxStrength = 1;
    this.strengthSampleCount = 0;
  }

  private updateResonanceState(): void {
    const frequency = this.model.frequencyProperty.value;
    const strength = this.model.strength(frequency);

    this.strengthSampleCount++;
    if (strength > this.maxStrength || this.strengthSampleCount < 10) {
      this.maxStrength = Math.max(this.maxStrength, strength);
    }

    const normalizedStrength = this.maxStrength > 0 ? Math.min(strength / this.maxStrength, 1) : 0;
    this.normalizedStrengthProperty.value = normalizedStrength;
    this.isAtResonanceProperty.value = normalizedStrength > RESONANCE_THRESHOLD;

    if (this.oscillator) {
      this.applyTone(frequency, normalizedStrength);
    }
  }

  private startTone(): void {
    if (this.oscillator) {
      return;
    }
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = "sine";
    this.oscillator.connect(this.soundSourceDestination);
    this.oscillator.start();
    this.updateResonanceState();
  }

  private stopTone(): void {
    if (!this.oscillator) {
      return;
    }
    this.oscillator.stop();
    this.oscillator.disconnect();
    this.oscillator = null;
    this.setOutputLevel(0);
  }

  private applyTone(frequency: number, normalizedStrength: number): void {
    if (!this.oscillator) {
      return;
    }
    const freqRange = this.model.frequencyRange;
    const freqT = (frequency - freqRange.min) / (freqRange.max - freqRange.min);
    const audioFreq = MIN_AUDIO_FREQUENCY + freqT * (MAX_AUDIO_FREQUENCY - MIN_AUDIO_FREQUENCY);
    this.oscillator.frequency.setValueAtTime(audioFreq, this.audioContext.currentTime);

    let targetVolume = MIN_VOLUME;
    if (normalizedStrength > MIN_STRENGTH_FOR_SOUND) {
      const strengthT = (normalizedStrength - MIN_STRENGTH_FOR_SOUND) / (1 - MIN_STRENGTH_FOR_SOUND);
      targetVolume = MIN_VOLUME + strengthT * strengthT * (MAX_VOLUME - MIN_VOLUME);
    }
    this.setOutputLevel(targetVolume);
  }
}
