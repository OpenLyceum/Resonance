/**
 * ChladniKeyboardHelpContent.ts
 *
 * Keyboard shortcuts help content for the Chladni Patterns screen. The screen
 * shortcuts come from ChladniHotkeyData, the same bindings ChladniScreenView's
 * KeyboardListener uses.
 */

import {
  BasicActionsKeyboardHelpSection,
  KeyboardHelpIconFactory,
  KeyboardHelpSection,
  KeyboardHelpSectionRow,
  SliderControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";
import {
  COLUMN_SPACING,
  DragObjectsKeyboardHelpSection,
  SECTION_SPACING,
} from "../../common/view/ResonanceKeyboardHelpContent.js";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceNamespace from "../../ResonanceNamespace.js";
import { ChladniHotkeyData } from "./ChladniHotkeyData.js";

/**
 * Screen-level shortcuts: play/pause, frequency stepping, reset, stop sweep.
 */
class ChladniShortcutsKeyboardHelpSection extends KeyboardHelpSection {
  public constructor() {
    super(ResonanceStrings.keyboardHelp.simulationControlsStringProperty, [
      KeyboardHelpSectionRow.fromHotkeyData(ChladniHotkeyData.PLAY_PAUSE),

      // The arrow bindings list eight strokes; summarize them with compact icons.
      KeyboardHelpSectionRow.fromHotkeyData(ChladniHotkeyData.ADJUST_FREQUENCY, {
        icon: KeyboardHelpIconFactory.arrowKeysRowIcon(),
      }),
      KeyboardHelpSectionRow.fromHotkeyData(ChladniHotkeyData.ADJUST_FREQUENCY_LARGE, {
        icon: KeyboardHelpIconFactory.shiftPlusIcon(KeyboardHelpIconFactory.arrowKeysRowIcon()),
      }),
      KeyboardHelpSectionRow.fromHotkeyData(ChladniHotkeyData.RESET),
      KeyboardHelpSectionRow.fromHotkeyData(ChladniHotkeyData.STOP_SWEEP),
    ]);
  }
}

export class ChladniKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    // Left column: screen shortcuts + dragging (excitation marker, resize handle)
    // Right column: sliders + basic actions
    super(
      [new ChladniShortcutsKeyboardHelpSection(), new DragObjectsKeyboardHelpSection()],
      [new SliderControlsKeyboardHelpSection(), new BasicActionsKeyboardHelpSection()],
      {
        columnSpacing: COLUMN_SPACING,
        sectionSpacing: SECTION_SPACING,
      },
    );
  }
}

ResonanceNamespace.register("ChladniKeyboardHelpContent", ChladniKeyboardHelpContent);
