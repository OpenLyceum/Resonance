/**
 * ChladniHotkeyData.ts
 *
 * Key bindings for the Chladni Patterns screen. ChladniScreenView's global
 * KeyboardListener and ChladniKeyboardHelpContent both read these, so the
 * shortcuts and their documentation cannot drift apart.
 */

import { HotkeyData } from "scenerystack/scenery";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";

const REPO_NAME = "resonance";

export const ChladniHotkeyData = {
  /** Space toggles play/pause. */
  PLAY_PAUSE: new HotkeyData({
    keys: ["space"],
    repoName: REPO_NAME,
    global: true,
    keyboardHelpDialogLabelStringProperty: ResonanceStrings.keyboardHelp.playPauseStringProperty,
  }),

  /** Left/Right step the frequency by 10 Hz, Up/Down by 100 Hz. */
  ADJUST_FREQUENCY: new HotkeyData({
    keys: ["arrowLeft", "arrowRight", "arrowUp", "arrowDown"],
    repoName: REPO_NAME,
    global: true,
    keyboardHelpDialogLabelStringProperty: ResonanceStrings.keyboardHelp.adjustFrequencyStringProperty,
  }),

  /** Shift+Left/Right step the frequency by 100 Hz, Shift+Up/Down by 500 Hz. */
  ADJUST_FREQUENCY_LARGE: new HotkeyData({
    keys: ["shift+arrowLeft", "shift+arrowRight", "shift+arrowUp", "shift+arrowDown"],
    repoName: REPO_NAME,
    global: true,
    keyboardHelpDialogLabelStringProperty: ResonanceStrings.keyboardHelp.largeFrequencyStepsStringProperty,
  }),

  /** R resets the screen. */
  RESET: new HotkeyData({
    keys: ["r"],
    repoName: REPO_NAME,
    global: true,
    keyboardHelpDialogLabelStringProperty: ResonanceStrings.keyboardHelp.resetSimulationStringProperty,
  }),

  /** Escape stops a running frequency sweep. */
  STOP_SWEEP: new HotkeyData({
    keys: ["escape"],
    repoName: REPO_NAME,
    global: true,
    keyboardHelpDialogLabelStringProperty: ResonanceStrings.keyboardHelp.stopFrequencySweepStringProperty,
  }),
} as const;
