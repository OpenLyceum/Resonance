/**
 * OscillatorPlaybackControlNode contains the simulation speed radio buttons (slow/normal)
 * and the play/pause/step button group.
 *
 * This is a shared control node used by all oscillator-based screens:
 * - Single Oscillator
 * - Multiple Oscillators
 * - Phase Analysis
 */

import type { Bounds2 } from "scenerystack/dot";
import { HBox, Text } from "scenerystack/scenery";
import { PlayPauseStepButtonGroup } from "scenerystack/scenery-phet";
import { AquaRadioButtonGroup } from "scenerystack/sun";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceColors from "../../ResonanceColors.js";
import ResonanceConstants from "../../ResonanceConstants.js";
import type { BaseOscillatorScreenModel } from "../model/BaseOscillatorScreenModel.js";

export class OscillatorPlaybackControlNode extends HBox {
  public constructor(model: BaseOscillatorScreenModel, layoutBounds: Bounds2) {
    // Speed radio buttons
    const speedButtons = [
      {
        value: "slow",
        createNode: () =>
          new Text(ResonanceStrings.controls.slowStringProperty, {
            font: ResonanceConstants.CONTROL_FONT,
            fill: ResonanceColors.textProperty,
          }),
      },
      {
        value: "normal",
        createNode: () =>
          new Text(ResonanceStrings.controls.normalStringProperty, {
            font: ResonanceConstants.CONTROL_FONT,
            fill: ResonanceColors.textProperty,
          }),
      },
    ];

    const speedControl = new AquaRadioButtonGroup(model.resonanceModel.timeSpeedProperty, speedButtons, {
      orientation: "horizontal",
      spacing: ResonanceConstants.SPEED_CONTROL_SPACING,
      radioButtonOptions: {
        radius: ResonanceConstants.SPEED_RADIO_BUTTON_RADIUS,
      },
      // Accessibility
      accessibleName: ResonanceStrings.a11y.playbackControl.speedControlLabelStringProperty,
    });

    // Play/Pause/Step buttons
    const playPauseStepButtonGroup = new PlayPauseStepButtonGroup(model.resonanceModel.isPlayingProperty, {
      includeStepBackwardButton: true,
      stepForwardButtonOptions: {
        listener: () => {
          model.step(ResonanceConstants.STEP_DT, true);
        },
      },
      stepBackwardButtonOptions: {
        listener: () => {
          model.step(-ResonanceConstants.STEP_DT, true);
        },
      },
    });

    super({
      children: [speedControl, playPauseStepButtonGroup],
      spacing: ResonanceConstants.PLAYBACK_CONTROLS_SPACING,
      centerX: layoutBounds.centerX + ResonanceConstants.DRIVER_CENTER_X_OFFSET,
      bottom: layoutBounds.bottom - ResonanceConstants.PLAYBACK_BOTTOM_MARGIN,
      // Accessibility
      tagName: "div",
      labelTagName: "h3",
      labelContent: ResonanceStrings.a11y.playbackControl.labelStringProperty,
      descriptionContent: ResonanceStrings.a11y.playbackControl.descriptionStringProperty,
    });
  }
}
