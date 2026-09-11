/**
 * OscillatorScreenSummaryContent.ts
 *
 * Accessible screen summary (SceneryStack Interactive Description) shared by the
 * oscillator-based screens (Single Oscillator, Multiple Oscillators, Phase
 * Analysis). It describes the play area and controls, gives an interaction hint,
 * and exposes a LIVE "current details" paragraph derived from the model (driving
 * frequency, resonator count, playback state).
 *
 * Follows the OpenLyceum accessibility convention; see the canonical
 * SceneryStackTemplate/SimScreenSummaryContent.ts.
 */

import { DerivedProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { BaseOscillatorScreenModel } from "../model/BaseOscillatorScreenModel.js";

export class OscillatorScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: BaseOscillatorScreenModel) {
    const a11y = StringManager.getInstance().getA11yStrings();

    const currentDetailsProperty = new DerivedProperty(
      [
        a11y.currentDetailsStringProperty,
        a11y.playingLabelStringProperty,
        a11y.pausedLabelStringProperty,
        model.resonanceModel.drivingFrequencyProperty,
        model.resonatorCountProperty,
        model.isPlayingProperty,
      ],
      (template, playingLabel, pausedLabel, frequency, count, isPlaying) =>
        StringUtils.fillIn(template, {
          frequency: toFixed(frequency, 2),
          count: count,
          state: isPlaying ? playingLabel : pausedLabel,
        }),
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetailsProperty,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
