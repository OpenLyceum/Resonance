/**
 * Tests for ResonancePreferencesModel - Preferences persistence
 *
 * P2 Priority: User preferences with localStorage persistence.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SolverType } from "../../src/common/model/SolverType.js";
import { ResonancePreferencesModel, type StoredPreferences } from "../../src/preferences/ResonancePreferencesModel.js";

/** Typed shape for setItem spy when reading .mock or calling .mockImplementation */
interface SetItemSpyLike {
  mock: { calls: [string, string][] };
  mockImplementation: (fn: (key: string, value: string) => void) => void;
}
/** Typed shape for getItem spy when calling .mockImplementation */
interface GetItemSpyLike {
  mockImplementation: (fn: (key: string) => string | null) => void;
}

describe("ResonancePreferencesModel", () => {
  let mockStorage: Record<string, string>;
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear real localStorage and set up mock storage
    localStorage.clear();
    mockStorage = {};

    // Spy on localStorage methods
    getItemSpy = vi.spyOn(localStorage, "getItem").mockImplementation((key: string) => {
      return mockStorage[key] ?? null;
    });

    setItemSpy = vi.spyOn(localStorage, "setItem").mockImplementation((key: string, value: string) => {
      mockStorage[key] = value;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("default values", () => {
    it("should have correct default for solverType", () => {
      const model = new ResonancePreferencesModel();
      expect(model.solverTypeProperty.value).toBe(SolverType.RUNGE_KUTTA_4);
    });

    it("should have correct default for showModalControls", () => {
      const model = new ResonancePreferencesModel();
      expect(model.showModalControlsProperty.value).toBe(false);
    });

    it("should have correct default for rendererType", () => {
      const model = new ResonancePreferencesModel();
      expect(model.rendererTypeProperty.value).toBe("canvas");
    });
  });

  describe("persistence save", () => {
    it("should save solverType changes to localStorage", () => {
      const model = new ResonancePreferencesModel();
      model.solverTypeProperty.value = SolverType.ADAPTIVE_RK45;

      const savedJson = mockStorage["resonance-preferences"];
      expect(savedJson).toBeDefined();
      const saved = JSON.parse(savedJson as string) as StoredPreferences;
      expect(saved.solverType).toBe(SolverType.ADAPTIVE_RK45);
    });

    it("should save all preferences together", () => {
      const model = new ResonancePreferencesModel();
      model.solverTypeProperty.value = SolverType.ADAPTIVE_RK45;

      const savedJson = mockStorage["resonance-preferences"];
      expect(savedJson).toBeDefined();
      const saved = JSON.parse(savedJson as string) as StoredPreferences;
      expect(saved).toEqual({
        solverType: SolverType.ADAPTIVE_RK45,
        showModalControls: false, // Default value
        rendererType: "canvas", // Default renderer type
      });
    });

    it("should call localStorage.setItem when saving", () => {
      const model = new ResonancePreferencesModel();
      const setItemMock = (setItemSpy as SetItemSpyLike).mock;
      const initialCallCount = setItemMock.calls.length;

      model.solverTypeProperty.value = SolverType.ADAPTIVE_RK45;

      expect(setItemSpy).toHaveBeenCalledWith("resonance-preferences", expect.any(String));
      expect(setItemMock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  describe("persistence load", () => {
    it("should load solverType from localStorage", () => {
      mockStorage["resonance-preferences"] = JSON.stringify({
        solverType: SolverType.ADAPTIVE_RK45,
      });

      const model = new ResonancePreferencesModel();
      expect(model.solverTypeProperty.value).toBe(SolverType.ADAPTIVE_RK45);
    });

    it("should load showModalControls from localStorage", () => {
      mockStorage["resonance-preferences"] = JSON.stringify({
        showModalControls: true,
      });

      const model = new ResonancePreferencesModel();
      expect(model.showModalControlsProperty.value).toBe(true);
    });

    it("should load all saved preferences", () => {
      mockStorage["resonance-preferences"] = JSON.stringify({
        solverType: SolverType.ADAPTIVE_RK45,
        showModalControls: true,
        rendererType: "webgl",
      });

      const model = new ResonancePreferencesModel();

      expect(model.solverTypeProperty.value).toBe(SolverType.ADAPTIVE_RK45);
      expect(model.showModalControlsProperty.value).toBe(true);
      expect(model.rendererTypeProperty.value).toBe("webgl");
    });

    it("should call localStorage.getItem when loading", () => {
      new ResonancePreferencesModel();

      expect(getItemSpy).toHaveBeenCalledWith("resonance-preferences");
    });
  });

  describe("invalid storage data", () => {
    it("should use defaults for invalid JSON", () => {
      mockStorage["resonance-preferences"] = "not valid json";

      // Should not throw, should use defaults
      const model = new ResonancePreferencesModel();

      expect(model.solverTypeProperty.value).toBe(SolverType.RUNGE_KUTTA_4);
      expect(model.showModalControlsProperty.value).toBe(false);
      expect(model.rendererTypeProperty.value).toBe("canvas");
    });

    it("should use defaults when localStorage is empty", () => {
      // mockStorage is empty by default

      const model = new ResonancePreferencesModel();

      expect(model.solverTypeProperty.value).toBe(SolverType.RUNGE_KUTTA_4);
      expect(model.showModalControlsProperty.value).toBe(false);
      expect(model.rendererTypeProperty.value).toBe("canvas");
    });

    it("should handle partial saved data gracefully", () => {
      mockStorage["resonance-preferences"] = JSON.stringify({
        showModalControls: true,
        // Missing other fields
      });

      const model = new ResonancePreferencesModel();

      expect(model.showModalControlsProperty.value).toBe(true); // Loaded
      expect(model.solverTypeProperty.value).toBe(SolverType.RUNGE_KUTTA_4); // Default
      expect(model.rendererTypeProperty.value).toBe("canvas"); // Default
    });
  });

  describe("reset functionality", () => {
    it("should reset solverType to default", () => {
      const model = new ResonancePreferencesModel();
      model.solverTypeProperty.value = SolverType.ADAPTIVE_RK45;

      model.reset();

      expect(model.solverTypeProperty.value).toBe(SolverType.RUNGE_KUTTA_4);
    });

    it("should reset showModalControls to default", () => {
      const model = new ResonancePreferencesModel();
      model.showModalControlsProperty.value = true;

      model.reset();

      expect(model.showModalControlsProperty.value).toBe(false);
    });

    it("should reset rendererType to default", () => {
      const model = new ResonancePreferencesModel();
      model.rendererTypeProperty.value = "webgl";

      model.reset();

      expect(model.rendererTypeProperty.value).toBe("canvas");
    });

    it("should reset all properties at once", () => {
      const model = new ResonancePreferencesModel();
      model.solverTypeProperty.value = SolverType.ADAPTIVE_RK45;
      model.showModalControlsProperty.value = true;
      model.rendererTypeProperty.value = "webgl";

      model.reset();

      expect(model.solverTypeProperty.value).toBe(SolverType.RUNGE_KUTTA_4);
      expect(model.showModalControlsProperty.value).toBe(false);
      expect(model.rendererTypeProperty.value).toBe("canvas");
    });

    it("should trigger save after reset", () => {
      const model = new ResonancePreferencesModel();
      model.solverTypeProperty.value = SolverType.ADAPTIVE_RK45;
      const setItemMock: { calls: [string, string][] } = (setItemSpy as SetItemSpyLike).mock;
      const countBeforeReset = setItemMock.calls.length;

      model.reset();

      // Reset triggers saves for each property that changes
      expect(setItemMock.calls.length).toBeGreaterThan(countBeforeReset);
    });
  });

  describe("localStorage error handling", () => {
    it("should handle localStorage.getItem throwing", () => {
      (getItemSpy as GetItemSpyLike).mockImplementation(() => {
        throw new Error("Storage error");
      });

      // Should not throw, should use defaults
      const model = new ResonancePreferencesModel();

      expect(model.solverTypeProperty.value).toBe(SolverType.RUNGE_KUTTA_4);
    });

    it("should handle localStorage.setItem throwing", () => {
      (setItemSpy as SetItemSpyLike).mockImplementation(() => {
        throw new Error("Storage quota exceeded");
      });

      // Should not throw when saving
      const model = new ResonancePreferencesModel();
      expect(() => {
        model.solverTypeProperty.value = SolverType.ADAPTIVE_RK45;
      }).not.toThrow();
    });
  });

  describe("property change triggers save", () => {
    it("should save on every property change", () => {
      const model = new ResonancePreferencesModel();
      const setItemMock = (setItemSpy as SetItemSpyLike).mock;
      const initialCount = setItemMock.calls.length;

      model.solverTypeProperty.value = SolverType.ADAPTIVE_RK45;
      model.showModalControlsProperty.value = true;
      model.rendererTypeProperty.value = "webgl";

      // Should have called setItem 3 more times (once for each property change)
      expect(setItemMock.calls.length).toBe(initialCount + 3);
    });

    it("should save with correct key", () => {
      const model = new ResonancePreferencesModel();
      model.solverTypeProperty.value = SolverType.ADAPTIVE_RK45;

      const setItemMock = (setItemSpy as SetItemSpyLike).mock;
      const mockCalls = setItemMock.calls;
      const lastCall = mockCalls[mockCalls.length - 1];
      expect(lastCall?.[0]).toBe("resonance-preferences");
    });
  });
});
