/**
 * Keyboard shortcuts help content for the three oscillator screens (Single
 * Oscillator, Multiple Oscillators, Phase Analysis). These screens have no
 * screen-level hotkeys: draggables (ruler, masses, measurement lines) and
 * sliders cover their keyboard input. The Chladni screen adds its own
 * shortcuts in ChladniKeyboardHelpContent.
 */

import {
  BasicActionsKeyboardHelpSection,
  KeyboardHelpIconFactory,
  KeyboardHelpSection,
  KeyboardHelpSectionRow,
  SliderControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceNamespace from "../../ResonanceNamespace.js";

// Layout constants
export const COLUMN_SPACING = 20;
export const SECTION_SPACING = 15;

/**
 * Custom keyboard help section for dragging objects.
 */
export class DragObjectsKeyboardHelpSection extends KeyboardHelpSection {
  public constructor() {
    // Move with arrow keys
    const moveRow = KeyboardHelpSectionRow.labelWithIcon(
      ResonanceStrings.keyboardHelp.moveObjectsStringProperty,
      KeyboardHelpIconFactory.arrowOrWasdKeysRowIcon(),
    );

    // Fine control with Shift
    const fineRow = KeyboardHelpSectionRow.labelWithIcon(
      ResonanceStrings.keyboardHelp.fineMovementStringProperty,
      KeyboardHelpIconFactory.shiftPlusIcon(KeyboardHelpIconFactory.arrowOrWasdKeysRowIcon()),
    );

    super(ResonanceStrings.keyboardHelp.dragControlsStringProperty, [moveRow, fineRow]);
  }
}

export class ResonanceKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    // Create slider controls section (for frequency, amplitude, mass, etc.)
    const sliderControlsSection = new SliderControlsKeyboardHelpSection();

    // Create drag controls section
    const dragSection = new DragObjectsKeyboardHelpSection();

    // Create basic actions section (tab navigation, escape, etc.)
    const basicActionsSection = new BasicActionsKeyboardHelpSection();

    // Left column: drag controls
    // Right column: slider + basic actions
    super([dragSection], [sliderControlsSection, basicActionsSection], {
      columnSpacing: COLUMN_SPACING,
      sectionSpacing: SECTION_SPACING,
    });
  }
}

// Register with namespace for debugging accessibility
ResonanceNamespace.register("ResonanceKeyboardHelpContent", ResonanceKeyboardHelpContent);
