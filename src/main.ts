/**
 * main.ts
 *
 * Entry point for the simulation. Initializes SceneryStack, creates the
 * screens, and starts the main event loop.
 *
 * !! CRITICAL IMPORT ORDER !!
 * brand.js MUST be the first import. Each module imports the next, so the import nesting is
 *
 *   main → brand → splash → assert → init
 *
 * and therefore the actual EXECUTION order (deepest import runs first) is the reverse:
 *
 *   init → assert → splash → brand → main
 *
 * SceneryStack requires this exact load order. Never reorder these imports.
 */

// brand.js MUST be first; importing it runs the whole chain (init→assert→splash→brand) before main.
import "./brand.js";

import { onReadyToLaunch, PreferencesModel, Sim } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import { ChladniScreen } from "./chladni-patterns/ChladniScreen.js";
import { StringManager } from "./i18n/StringManager.js";
import { MultipleOscillatorsScreen } from "./multiple-oscillators/MultipleOscillatorsScreen.js";
import { PhaseAnalysisScreen } from "./phase-analysis/PhaseAnalysisScreen.js";
import { ResonancePreferencesModel } from "./preferences/ResonancePreferencesModel.js";
import { ResonancePreferencesNode } from "./preferences/ResonancePreferencesNode.js";
import { SingleOscillatorScreen } from "./single-oscillator/SingleOscillatorScreen.js";

onReadyToLaunch(() => {
  const stringManager = StringManager.getInstance();
  const resonancePreferences = new ResonancePreferencesModel();

  const simOptions = {
    webgl: true,
    hasKeyboardHelpContent: true,
    preferencesModel: new PreferencesModel({
      visualOptions: {
        supportsProjectorMode: true,
        supportsInteractiveHighlights: true,
      },
      audioOptions: {
        supportsVoicing: true,
        // Initializes tambo and the Audio preferences. Pair with supportsSound in src/init.ts.
        supportsSound: true,
      },
      inputOptions: {
        supportsGestureControl: false,
      },
      localizationOptions: {
        supportsDynamicLocale: true,
        includeLocalePanel: true,
      },
      simulationOptions: {
        customPreferences: [
          {
            createContent: (_tandem: Tandem) => new ResonancePreferencesNode(resonancePreferences),
          },
        ],
      },
    }),
  };

  const screens = [
    new SingleOscillatorScreen(resonancePreferences, {
      tandem: Tandem.ROOT.createTandem("singleOscillatorScreen"),
    }),
    new MultipleOscillatorsScreen(resonancePreferences, {
      tandem: Tandem.ROOT.createTandem("multipleOscillatorsScreen"),
    }),
    new PhaseAnalysisScreen(resonancePreferences, {
      tandem: Tandem.ROOT.createTandem("phaseAnalysisScreen"),
    }),
    new ChladniScreen(resonancePreferences, {
      tandem: Tandem.ROOT.createTandem("chladniPatternsScreen"),
    }),
  ];

  const sim = new Sim(stringManager.getTitleStringProperty(), screens, simOptions);

  sim.start();
});
