/**
 * ChladniScreenSummaryContent.ts
 *
 * Accessible screen summary (SceneryStack Interactive Description) for the
 * Chladni Patterns screen. Describes the play area and controls, gives an
 * interaction hint, and exposes a LIVE "current details" paragraph derived from
 * the model (driving frequency and the number of grains on the nodal lines).
 *
 * Follows the OpenLyceum accessibility convention; see the canonical
 * SceneryStackTemplate/SimScreenSummaryContent.ts.
 */
import { DerivedProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { ChladniModel } from "../model/ChladniModel.js";

export class ChladniScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: ChladniModel) {
    const chladni = StringManager.getInstance().getA11yStrings().chladni;

    const currentDetailsProperty = new DerivedProperty(
      [chladni.currentDetailsStringProperty, model.frequencyProperty, model.actualParticleCountProperty],
      (template, frequency, particles) =>
        StringUtils.fillIn(template, {
          frequency: Math.round(frequency),
          particles: particles,
        }),
    );

    super({
      playAreaContent: chladni.screenSummary.playAreaStringProperty,
      controlAreaContent: chladni.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetailsProperty,
      interactionHintContent: chladni.screenSummary.interactionHintStringProperty,
    });
  }
}
