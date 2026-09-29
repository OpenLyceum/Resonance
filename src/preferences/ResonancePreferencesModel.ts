/**
 * ResonancePreferencesModel.ts
 *
 * Model for the simulation-specific preferences shown in Preferences →
 * Simulation. Each preference Property takes its initial value from the
 * corresponding query parameter in resonanceQueryParameters.
 *
 * Choices are also written to localStorage so they survive a reload. A saved
 * value overrides the query-parameter initial value when one is present.
 */

import { BooleanProperty, StringUnionProperty } from "scenerystack/axon";
import type { Tandem } from "scenerystack/tandem";
import { SolverType } from "../common/model/SolverType.js";
import ResonanceNamespace from "../ResonanceNamespace.js";
import { RendererType } from "./RendererType.js";
import resonanceQueryParameters from "./resonanceQueryParameters.js";

/** Shape of preferences as stored in localStorage (may be partial). */
export interface StoredPreferences {
  showModalControls?: boolean;
  solverType?: SolverType;
  rendererType?: RendererType;
}

const STORAGE_KEY = "resonance-preferences";

export class ResonancePreferencesModel {
  public readonly solverTypeProperty: StringUnionProperty<SolverType>;
  public readonly showModalControlsProperty: BooleanProperty;
  public readonly rendererTypeProperty: StringUnionProperty<RendererType>;

  public constructor(tandem?: Tandem) {
    this.solverTypeProperty = new StringUnionProperty<SolverType>(resonanceQueryParameters.solverType as SolverType, {
      validValues: Object.values(SolverType),
      ...(tandem ? { tandem: tandem.createTandem("solverTypeProperty") } : {}),
    });
    this.showModalControlsProperty = new BooleanProperty(
      resonanceQueryParameters.showModalControls,
      tandem ? { tandem: tandem.createTandem("showModalControlsProperty") } : undefined,
    );
    this.rendererTypeProperty = new StringUnionProperty<RendererType>(
      resonanceQueryParameters.rendererType as RendererType,
      {
        validValues: Object.values(RendererType),
        ...(tandem ? { tandem: tandem.createTandem("rendererTypeProperty") } : {}),
      },
    );

    this.loadPreferences();
    this.solverTypeProperty.link(() => this.savePreferences());
    this.showModalControlsProperty.link(() => this.savePreferences());
    this.rendererTypeProperty.link(() => this.savePreferences());
  }

  private loadPreferences(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const preferences = JSON.parse(saved) as StoredPreferences;

        if (preferences.solverType) {
          this.solverTypeProperty.value = preferences.solverType;
        }
        if (preferences.showModalControls !== undefined) {
          this.showModalControlsProperty.value = preferences.showModalControls;
        }
        if (preferences.rendererType) {
          this.rendererTypeProperty.value = preferences.rendererType;
        }
      }
    } catch {
      // Preferences are best-effort; ignore load errors.
    }
  }

  private savePreferences(): void {
    try {
      const preferences: StoredPreferences = {
        solverType: this.solverTypeProperty.value,
        showModalControls: this.showModalControlsProperty.value,
        rendererType: this.rendererTypeProperty.value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Preferences are best-effort; ignore save errors.
    }
  }

  public reset(): void {
    this.solverTypeProperty.reset();
    this.showModalControlsProperty.reset();
    this.rendererTypeProperty.reset();
  }
}

ResonanceNamespace.register("ResonancePreferencesModel", ResonancePreferencesModel);
