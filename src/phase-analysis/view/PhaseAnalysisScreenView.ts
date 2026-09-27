/**
 * PhaseAnalysisScreenView is the view for the Phase Analysis screen.
 * It extends BaseOscillatorScreenView and adds a configurable graph
 * that lets users plot various physical quantities against each other.
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import {
  BaseOscillatorScreenView,
  type BaseOscillatorScreenViewOptions,
} from "../../common/view/BaseOscillatorScreenView.js";
import type { ConfigurableGraph } from "../../common/view/graph/ConfigurableGraph.js";
import type { PlottableProperty } from "../../common/view/graph/PlottableProperty.js";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import type { PhaseAnalysisModel } from "../model/PhaseAnalysisModel.js";

export type PhaseAnalysisScreenViewOptions = BaseOscillatorScreenViewOptions;

export class PhaseAnalysisScreenView extends BaseOscillatorScreenView {
  private readonly configurableGraph: ConfigurableGraph;

  public constructor(model: PhaseAnalysisModel, providedOptions?: PhaseAnalysisScreenViewOptions) {
    const options = optionize<PhaseAnalysisScreenViewOptions, EmptySelfOptions, BaseOscillatorScreenViewOptions>()(
      {},
      providedOptions,
    );
    super(model, options);

    const resonanceModel = model.resonanceModel;

    // Define the plottable properties available in the combo box.
    // Organized by category: kinematics, forces, energy, driver/ratios.
    const plottableProperties: PlottableProperty[] = [
      // Time
      {
        name: ResonanceStrings.controls.timeStringProperty,
        property: resonanceModel.timeProperty,
        unit: "s",
        subStepAccessor: (point) => point.time,
      },
      // Kinematics
      {
        name: ResonanceStrings.controls.positionStringProperty,
        property: resonanceModel.positionProperty,
        unit: "m",
        subStepAccessor: (point) => point.position,
      },
      {
        name: ResonanceStrings.controls.velocityStringProperty,
        property: resonanceModel.velocityProperty,
        unit: "m/s",
        subStepAccessor: (point) => point.velocity,
      },
      {
        name: ResonanceStrings.controls.accelerationStringProperty,
        property: resonanceModel.accelerationProperty,
        unit: "m/s\u00B2",
        subStepAccessor: (point) => point.acceleration,
      },
      {
        name: ResonanceStrings.controls.rmsDisplacementStringProperty,
        property: resonanceModel.rmsDisplacementProperty,
        unit: "m",
      },
      {
        name: ResonanceStrings.controls.rmsVelocityStringProperty,
        property: resonanceModel.rmsVelocityProperty,
        unit: "m/s",
      },
      // Forces
      {
        name: ResonanceStrings.controls.appliedForceStringProperty,
        property: resonanceModel.appliedForceProperty,
        unit: "N",
        subStepAccessor: (point) => point.appliedForce,
      },
      {
        name: ResonanceStrings.controls.springForceStringProperty,
        property: resonanceModel.springForceProperty,
        unit: "N",
      },
      {
        name: ResonanceStrings.controls.dampingForceStringProperty,
        property: resonanceModel.dampingForceProperty,
        unit: "N",
      },
      {
        name: ResonanceStrings.controls.netForceStringProperty,
        property: resonanceModel.netForceProperty,
        unit: "N",
      },
      // Energy
      {
        name: ResonanceStrings.controls.kineticEnergyStringProperty,
        property: resonanceModel.kineticEnergyProperty,
        unit: "J",
      },
      {
        name: ResonanceStrings.controls.springPotentialEnergyStringProperty,
        property: resonanceModel.springPotentialEnergyProperty,
        unit: "J",
      },
      {
        name: ResonanceStrings.controls.gravitationalPotentialEnergyStringProperty,
        property: resonanceModel.gravitationalPotentialEnergyProperty,
        unit: "J",
      },
      {
        name: ResonanceStrings.controls.totalPotentialEnergyStringProperty,
        property: resonanceModel.potentialEnergyProperty,
        unit: "J",
      },
      {
        name: ResonanceStrings.controls.totalEnergyStringProperty,
        property: resonanceModel.totalEnergyProperty,
        unit: "J",
      },
      {
        name: ResonanceStrings.controls.driverEnergyStringProperty,
        property: resonanceModel.driverEnergyProperty,
        unit: "J",
      },
      {
        name: ResonanceStrings.controls.thermalEnergyStringProperty,
        property: resonanceModel.thermalEnergyProperty,
        unit: "J",
      },
      // Driver and dimensionless ratios
      {
        name: ResonanceStrings.controls.driverPositionStringProperty,
        property: resonanceModel.driverPositionProperty,
        unit: "m",
      },
      {
        name: ResonanceStrings.controls.frequencyRatioStringProperty,
        property: resonanceModel.frequencyRatioProperty,
      },
      {
        name: ResonanceStrings.controls.amplitudeRatioStringProperty,
        property: resonanceModel.amplitudeRatioProperty,
      },
      {
        name: ResonanceStrings.controls.frequencyStringProperty,
        property: resonanceModel.drivingFrequencyProperty,
        unit: "Hz",
      },
      {
        name: ResonanceStrings.controls.phaseStringProperty,
        property: resonanceModel.displacementPhaseProperty,
        unit: "rad",
      },
    ];

    // Create graph, checkbox, and combo box parent via shared helper
    const { graph, checkbox } = this.createConfigurableGraphSetup({
      plottableProperties,
      initialXIndex: 0, // Time
      initialYIndex: 2, // Velocity
      graphWidth: 350,
      graphHeight: 250,
      initiallyVisible: true,
    });

    this.configurableGraph = graph;

    // Position the graph in the upper-left area of the screen
    this.configurableGraph.x = this.layoutBounds.left + 20;
    this.configurableGraph.y = this.layoutBounds.top + 60;

    // Position the checkbox above the graph
    checkbox.left = this.layoutBounds.left + 20;
    checkbox.top = this.layoutBounds.top + 10;
  }

  public override step(dt: number): void {
    super.step(dt);
    this.stepConfigurableGraph(this.configurableGraph);
  }

  public override reset(): void {
    super.reset();
    this.configurableGraph.reset();
  }
}
