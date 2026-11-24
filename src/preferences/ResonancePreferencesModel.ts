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

/**
 * Shape of preferences as stored in localStorage (may be partial).
 * @internal Exported for unit tests; not part of the application API.
 */
export interface StoredPreferences {
  showModalControls?: boolean;
  solverType?: SolverType;
  rendererType?: RendererType;
}

const STORAGE_KEY = "resonance-preferences";
const SOLVER_TYPES = Object.values(SolverType);
const RENDERER_TYPES = Object.values(RendererType);

export class ResonancePreferencesModel {
  public readonly solverTypeProperty: StringUnionProperty<SolverType>;
  public readonly showModalControlsProperty: BooleanProperty;
  public readonly rendererTypeProperty: StringUnionProperty<RendererType>;

  public constructor(tandem?: Tandem) {
    this.solverTypeProperty = new StringUnionProperty<SolverType>(
      SOLVER_TYPES.find((type) => type === resonanceQueryParameters.solverType) ?? SolverType.RUNGE_KUTTA_4,
      {
        validValues: SOLVER_TYPES,
        ...(tandem ? { tandem: tandem.createTandem("solverTypeProperty") } : {}),
      },
    );
    this.showModalControlsProperty = new BooleanProperty(
      resonanceQueryParameters.showModalControls,
      tandem ? { tandem: tandem.createTandem("showModalControlsProperty") } : undefined,
    );
    this.rendererTypeProperty = new StringUnionProperty<RendererType>(
      RENDERER_TYPES.find((type) => type === resonanceQueryParameters.rendererType) ?? RendererType.CANVAS,
      {
        validValues: RENDERER_TYPES,
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
      const preferences: unknown = saved === null ? null : JSON.parse(saved);
      if (preferences === null || typeof preferences !== "object") {
        return;
      }

      if ("solverType" in preferences) {
        const solver = SOLVER_TYPES.find((type) => type === preferences.solverType);
        if (solver !== undefined) {
          this.solverTypeProperty.value = solver;
        }
      }
      if ("showModalControls" in preferences && typeof preferences.showModalControls === "boolean") {
        this.showModalControlsProperty.value = preferences.showModalControls;
      }
      if ("rendererType" in preferences) {
        const renderer = RENDERER_TYPES.find((type) => type === preferences.rendererType);
        if (renderer !== undefined) {
          this.rendererTypeProperty.value = renderer;
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
