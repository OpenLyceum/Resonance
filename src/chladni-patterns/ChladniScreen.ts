import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Screen, type ScreenOptions } from "scenerystack/sim";
import { createChladniIcon } from "../common/ResonanceScreenIcons.js";

import { ResonanceStrings } from "../i18n/ResonanceStrings.js";
import type { ResonancePreferencesModel } from "../preferences/ResonancePreferencesModel.js";
import ResonanceColors from "../ResonanceColors.js";
import { ChladniModel } from "./model/ChladniModel.js";
import { ChladniKeyboardHelpContent } from "./view/ChladniKeyboardHelpContent.js";
import { ChladniScreenView } from "./view/ChladniScreenView.js";

export class ChladniScreen extends Screen<ChladniModel, ChladniScreenView> {
  public constructor(preferencesModel: ResonancePreferencesModel, options: ScreenOptions) {
    super(
      () => new ChladniModel(),
      (model: ChladniModel) => new ChladniScreenView(model, preferencesModel),
      optionize<ScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          name: ResonanceStrings.screens.chladniPatternsStringProperty,
          backgroundColorProperty: ResonanceColors.backgroundProperty,
          createKeyboardHelpNode: () => new ChladniKeyboardHelpContent(),
          homeScreenIcon: createChladniIcon(),
          navigationBarIcon: createChladniIcon(),
        },
        options,
      ),
    );
  }
}
