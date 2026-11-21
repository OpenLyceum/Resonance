/**
 * Fleet-standard memory-leak regression suite.
 */

import { BooleanProperty, NumberProperty, Property } from "scenerystack/axon";
import { Bounds2 } from "scenerystack/dot";
import { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Node } from "scenerystack/scenery";
import { describe, expect, it } from "vitest";
import { ChladniModel } from "../src/chladni-patterns/model/ChladniModel.js";
import { ChladniVisualizationNode } from "../src/chladni-patterns/view/ChladniVisualizationNode.js";
import { CanvasParticleRenderer } from "../src/chladni-patterns/view/renderers/CanvasParticleRenderer.js";
import { ResonanceModel } from "../src/common/model/ResonanceModel.js";
import { SolverType } from "../src/common/model/SolverType.js";
import { ListenerTracker } from "../src/common/util/ListenerTracker.js";
import { ConfigurableGraph } from "../src/common/view/graph/ConfigurableGraph.js";
import type { PlottableProperty } from "../src/common/view/graph/PlottableProperty.js";
import { OscillatorControlPanel } from "../src/common/view/OscillatorControlPanel.js";
import { ResonanceStrings } from "../src/i18n/ResonanceStrings.js";
import { MultipleOscillatorsModel } from "../src/multiple-oscillators/model/MultipleOscillatorsModel.js";
import { RendererType } from "../src/preferences/RendererType.js";
import { ResonancePreferencesModel } from "../src/preferences/ResonancePreferencesModel.js";
import ResonanceColors from "../src/ResonanceColors.js";
import { SingleOscillatorModel } from "../src/single-oscillator/model/SingleOscillatorModel.js";
import { OscillatorVectorNode } from "../src/single-oscillator/view/OscillatorVectorNode.js";
import { describeDisposalLeaks, expectNoListenerGrowth, forceGC } from "./helpers/memoryLeak.js";

function createAndDispose(): WeakRef<object> {
  const property = new NumberProperty(0);
  const tracker = new ListenerTracker();
  tracker.link(property, () => undefined);
  const ref = new WeakRef<object>(tracker);
  tracker.dispose();
  property.dispose();
  return ref;
}

describe("Memory leak regression", () => {
  it("ListenerTracker is collected after dispose", async () => {
    const ref = createAndDispose();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("double dispose() does not throw", () => {
    const property = new NumberProperty(0);
    const tracker = new ListenerTracker();
    tracker.link(property, () => undefined);
    tracker.dispose();
    expect(() => tracker.dispose()).not.toThrow();
    property.dispose();
  });

  it("repeated create/dispose cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDispose());
    }
    await forceGC(refs);
    const survivors = refs.filter((r) => r.deref() !== undefined).length;
    expect(survivors).toBe(0);
  });
});

const transform = ModelViewTransform2.createIdentity();
const chladniModel = new ChladniModel();
const canvasRendererTypeProperty = new Property<RendererType>(RendererType.CANVAS);
const resonanceModel = new ResonanceModel({
  solverTypeProperty: new Property<SolverType>(SolverType.RUNGE_KUTTA_4),
});
const velocityVisibleProperty = new BooleanProperty(true);
const accelerationVisibleProperty = new BooleanProperty(true);
const appliedForceVisibleProperty = new BooleanProperty(true);

// OscillatorControlPanel is built against screen models and view Properties that outlive it,
// as in BaseOscillatorScreenView. Both modes, since each builds controls the other omits.
const panelPreferences = new ResonancePreferencesModel();
const multipleModel = new MultipleOscillatorsModel(panelPreferences);
const singleModel = new SingleOscillatorModel(panelPreferences);
const panelLayoutBounds = new Bounds2(0, 0, 1024, 618);
const rulerVisibleProperty = new BooleanProperty(false);
const gridVisibleProperty = new BooleanProperty(true);
const traceEnabledProperty = new BooleanProperty(false);
const panelStrings = ResonanceStrings.controls;
const panelA11y = ResonanceStrings.a11y.resonatorPanel;

/** Sim-lifetime string, accessible-name, view and model Properties the panel links to. */
const panelLinkedProperties = (model: MultipleOscillatorsModel | SingleOscillatorModel): readonly object[] => [
  panelStrings.massSimpleStringProperty,
  panelStrings.springConstantSimpleStringProperty,
  panelStrings.dampingStringProperty,
  panelStrings.resonatorConfigStringProperty,
  panelStrings.resonatorStringProperty,
  panelStrings.gravityStringProperty,
  panelStrings.rulerStringProperty,
  panelStrings.traceStringProperty,
  panelStrings.frequencyEqualsStringProperty,
  ResonanceStrings.units.hertzPatternStringProperty,
  panelA11y.labelStringProperty,
  panelA11y.resonatorSelectorLabelStringProperty,
  panelA11y.gravityToggleLabelStringProperty,
  panelA11y.rulerCheckboxLabelStringProperty,
  panelA11y.gridCheckboxLabelStringProperty,
  panelA11y.traceCheckboxLabelStringProperty,
  rulerVisibleProperty,
  gridVisibleProperty,
  traceEnabledProperty,
  model.resonatorCountProperty,
  model.selectedResonatorIndexProperty,
  model.resonatorConfigProperty,
  model.resonanceModel.massProperty,
  model.resonanceModel.springConstantProperty,
  model.resonanceModel.dampingProperty,
];

function createControlPanel(model: MultipleOscillatorsModel | SingleOscillatorModel): OscillatorControlPanel {
  return new OscillatorControlPanel(
    model,
    panelLayoutBounds,
    rulerVisibleProperty,
    gridVisibleProperty,
    traceEnabledProperty,
    // As the screens configure it: MultipleOscillatorsScreenView hides the trace checkbox.
    { singleOscillatorMode: model.singleOscillatorMode, showTrace: model.singleOscillatorMode },
  );
}

describeDisposalLeaks([
  { name: "ListenerTracker", create: () => new ListenerTracker() },
  {
    name: "CanvasParticleRenderer",
    create: () => new CanvasParticleRenderer(200, 200, transform),
    keepAlive: () => [transform],
  },
  {
    name: "ChladniVisualizationNode",
    create: () => new ChladniVisualizationNode(chladniModel, canvasRendererTypeProperty, { visualizationSize: 200 }),
    keepAlive: () => [chladniModel, canvasRendererTypeProperty],
  },
  {
    name: "OscillatorVectorNode",
    create: () =>
      new OscillatorVectorNode(resonanceModel, transform, {
        velocityVisibleProperty,
        accelerationVisibleProperty,
        appliedForceVisibleProperty,
      }),
    keepAlive: () => [
      resonanceModel,
      transform,
      velocityVisibleProperty,
      accelerationVisibleProperty,
      appliedForceVisibleProperty,
    ],
  },
  {
    name: "OscillatorControlPanel (multiple oscillators)",
    create: () => createControlPanel(multipleModel),
    keepAlive: () => [multipleModel, ...panelLinkedProperties(multipleModel)],
  },
  {
    name: "OscillatorControlPanel (single oscillator)",
    create: () => createControlPanel(singleModel),
    keepAlive: () => [singleModel, ...panelLinkedProperties(singleModel)],
  },
]);

describe("OscillatorControlPanel", () => {
  it.each([
    ["multiple oscillators", multipleModel],
    ["single oscillator", singleModel],
  ] as const)("%s: leaves no listeners on string, accessible-name, view or model Properties", async (_mode, model) => {
    await expectNoListenerGrowth(panelLinkedProperties(model), () => {
      const panel = createControlPanel(model);
      gridVisibleProperty.value = !gridVisibleProperty.value;
      rulerVisibleProperty.value = !rulerVisibleProperty.value;
      panel.dispose();
    });
  });
});

// ConfigurableGraph.dispose() tears down these owned helpers; they are never constructed alone.
// memory-leak-covers: GraphControlsPanel (owned by ConfigurableGraph), GraphInteractionHandler
describe("ConfigurableGraph", () => {
  it("dispose() releases every sim-lifetime Property it listened to, and never links its data", async () => {
    const timeProperty = new Property(0);
    const displacementProperty = new Property(1);
    const plottables: PlottableProperty[] = [
      { name: "Time", property: timeProperty, unit: "s" },
      { name: "Displacement", property: displacementProperty, unit: "m" },
    ];
    const [first, second] = plottables;
    if (!(first && second)) {
      throw new Error("expected two plottable properties");
    }
    // A screen's combo-box list parent outlives the graph, as in BaseOscillatorScreenView.
    const listParent = new Node();

    await expectNoListenerGrowth(
      [
        ResonanceColors.controlPanelFillProperty,
        ResonanceStrings.controls.graphTitleOpenStringProperty,
        ResonanceStrings.controls.graphVsStringProperty,
        ResonanceStrings.controls.graphTitleCloseStringProperty,
      ],
      () => {
        const graph = new ConfigurableGraph(plottables, first, second, 300, 200, listParent);
        // The axis Properties are sampled on demand, never linked.
        expect(timeProperty.hasListeners()).toBe(false);
        expect(displacementProperty.hasListeners()).toBe(false);
        graph.dispose();
      },
    );
    expect(listParent.children.length).toBe(0);
  });
});
