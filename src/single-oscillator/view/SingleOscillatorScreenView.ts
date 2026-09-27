/**
 * SingleOscillatorScreenView is the view for the Single Oscillator screen.
 * It extends BaseOscillatorScreenView and adds:
 * - Velocity, acceleration, and applied force vector arrows on the mass
 * - A control panel with checkboxes to toggle vector visibility
 * - A configurable graph for plotting physical quantities
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import {
  BaseOscillatorScreenView,
  type BaseOscillatorScreenViewOptions,
} from "../../common/view/BaseOscillatorScreenView.js";
import type { ConfigurableGraph } from "../../common/view/graph/ConfigurableGraph.js";
import type { PlottableProperty } from "../../common/view/graph/PlottableProperty.js";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceConstants from "../../ResonanceConstants.js";
import type { SingleOscillatorModel } from "../model/SingleOscillatorModel.js";
import { OscillatorVectorControlPanel } from "./OscillatorVectorControlPanel.js";
import { OscillatorVectorNode } from "./OscillatorVectorNode.js";

export type SingleOscillatorScreenViewOptions = BaseOscillatorScreenViewOptions;

export class SingleOscillatorScreenView extends BaseOscillatorScreenView {
  private readonly vectorNode: OscillatorVectorNode;
  private readonly vectorControlPanel: OscillatorVectorControlPanel;
  private readonly configurableGraph: ConfigurableGraph;

  public constructor(model: SingleOscillatorModel, providedOptions?: SingleOscillatorScreenViewOptions) {
    const options = optionize<SingleOscillatorScreenViewOptions, EmptySelfOptions, BaseOscillatorScreenViewOptions>()(
      {},
      providedOptions,
    );
    super(model, options);

    // Create the vector control panel (positioned in upper-left)
    this.vectorControlPanel = new OscillatorVectorControlPanel();
    this.vectorControlPanel.left = this.layoutBounds.minX + ResonanceConstants.CONTROL_PANEL_X_MARGIN;
    this.vectorControlPanel.top = this.layoutBounds.minY + ResonanceConstants.CONTROL_PANEL_TOP_MARGIN;
    this.addChild(this.vectorControlPanel);

    // Create the vector node that displays arrows on the mass
    this.vectorNode = new OscillatorVectorNode(model.resonanceModel, this.modelViewTransform, {
      velocityVisibleProperty: this.vectorControlPanel.velocityVisibleProperty,
      accelerationVisibleProperty: this.vectorControlPanel.accelerationVisibleProperty,
      appliedForceVisibleProperty: this.vectorControlPanel.appliedForceVisibleProperty,
    });

    // Add vector node to the resonators container so it appears with the mass
    this.resonatorsContainer.addChild(this.vectorNode);

    // Initial vector position update
    this.updateVectorPosition();

    // ===== CONFIGURABLE GRAPH =====
    const resonanceModel = model.resonanceModel;

    const plottableProperties: PlottableProperty[] = [
      {
        name: ResonanceStrings.controls.timeStringProperty,
        property: resonanceModel.timeProperty,
        unit: "s",
        subStepAccessor: (point) => point.time,
      },
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
        name: ResonanceStrings.controls.appliedForceStringProperty,
        property: resonanceModel.appliedForceProperty,
        unit: "N",
        subStepAccessor: (point) => point.appliedForce,
      },
      {
        name: ResonanceStrings.controls.frequencyStringProperty,
        property: resonanceModel.drivingFrequencyProperty,
        unit: "Hz",
      },
    ];

    // Calculate graph position:
    // - Right of the mass (mass is at layoutBounds.centerX + DRIVER_CENTER_X_OFFSET)
    // - Left of the control panel
    const massAreaRight =
      this.layoutBounds.centerX + ResonanceConstants.DRIVER_CENTER_X_OFFSET + ResonanceConstants.MAX_MASS_SIZE / 2 + 60; // margin after mass
    const controlPanelLeft = this.controlPanel.left - 20; // margin before control panel
    const graphWidth = Math.min(350, controlPanelLeft - massAreaRight);

    // Calculate height: from control panel top to above driver plate
    const graphHeaderOffset = 60;
    const driverPlateTopViewY = this.modelViewTransform.modelToViewY(ResonanceConstants.DRIVER_PLATE_REST_MODEL_Y);
    const graphTop = this.controlPanel.top + graphHeaderOffset;
    const graphBottom = driverPlateTopViewY - 40; // margin above driver
    const graphHeight = Math.min(300, graphBottom - graphTop);

    // Create graph, checkbox, and combo box parent via shared helper
    const { graph, checkbox } = this.createConfigurableGraphSetup({
      plottableProperties,
      initialXIndex: 0, // Time
      initialYIndex: 1, // Position
      graphWidth,
      graphHeight,
    });

    this.configurableGraph = graph;

    // Position the graph
    this.configurableGraph.x = massAreaRight;
    this.configurableGraph.y = graphTop;

    // Position the checkbox below the vector control panel
    checkbox.left = this.vectorControlPanel.left;
    checkbox.top = this.vectorControlPanel.bottom + 10;
  }

  /**
   * Update the position of the vector node to match the mass bottom.
   * The vectors originate from the bottom of the mass (the spring connection point).
   */
  private updateVectorPosition(): void {
    const massNode = this.massNodes[0];
    if (massNode) {
      // Get the bottom of the mass node in parent coordinates
      // massNode.y is already the bottom of the mass (local origin is at bottom)
      const massBottomX = massNode.x;
      const massBottomY = massNode.y;
      this.vectorNode.setMassBottom(massBottomX, massBottomY);
    }
  }

  public override reset(): void {
    super.reset();
    this.vectorControlPanel.reset();
    this.configurableGraph.reset();
  }

  public override step(dt: number): void {
    super.step(dt);

    // Update vector position to follow the mass
    this.updateVectorPosition();

    // Update the vector arrows based on current physics values
    this.vectorNode.updateVectors();

    // Feed data to graph
    this.stepConfigurableGraph(this.configurableGraph);
  }
}
