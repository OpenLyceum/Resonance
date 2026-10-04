/**
 * OscillatorMeasurementLinesNode - View for two horizontal dashed lines that span the driver width.
 * Each line is vertically draggable for measuring heights above the driver plate.
 * Uses MeasurementLinesModel for the underlying model state.
 *
 * This is a shared view component used by all oscillator-based screens:
 * - Single Oscillator
 * - Multiple Oscillators
 * - Phase Analysis
 */

import { PatternStringProperty } from "scenerystack/axon";
import type { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Line, Node, Rectangle, RichDragListener } from "scenerystack/scenery";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceColors from "../../ResonanceColors.js";
import { type MeasurementLineModel, MeasurementLinesModel } from "../model/MeasurementLineModel.js";

// --- Named constants (hoisted magic numbers) ---

/** Dash pattern for the horizontal measurement line [dash length, gap length] in view coordinates. */
const LINE_DASH_PATTERN = [10, 6];

/**
 * View for a single draggable measurement line with a handle.
 */
class MeasurementLineNode extends Node {
  public constructor(
    model: MeasurementLineModel,
    driverWidth: number,
    driverCenterX: number,
    modelViewTransform: ModelViewTransform2,
    lineNumber: number,
  ) {
    super();

    // Create the dashed horizontal line
    const lineLength = driverWidth;
    const line = new Line(0, 0, lineLength, 0, {
      stroke: ResonanceColors.textProperty,
      lineWidth: 2,
      lineDash: LINE_DASH_PATTERN,
    });
    line.centerX = 0;
    this.addChild(line);

    // Create a small handle on the left side for dragging
    const handleWidth = 12;
    const handleHeight = 20;
    const handle = new Rectangle(-handleWidth / 2, -handleHeight / 2, handleWidth, handleHeight, {
      fill: ResonanceColors.driverFillProperty,
      stroke: ResonanceColors.textProperty,
      lineWidth: 1,
      cornerRadius: 3,
      cursor: "ns-resize",
    });
    handle.left = line.left - handleWidth / 2 - 5;
    this.addChild(handle);

    this.cursor = "ns-resize";

    // Make focusable for keyboard navigation
    this.tagName = "div";
    this.focusable = true;
    this.accessibleName = new PatternStringProperty(ResonanceStrings.a11y.measurementLinePatternStringProperty, {
      number: lineNumber,
    });

    // Position the node based on model position
    // With isometric transform, model Y=0 is equilibrium, use modelToViewY directly
    model.positionProperty.link((position) => {
      this.x = driverCenterX;
      this.y = modelViewTransform.modelToViewY(position.y);
    });

    // RichDragListener: model positionProperty + transform + bounds (pointer + keyboard).
    this.addInputListener(
      new RichDragListener({
        positionProperty: model.positionProperty,
        transform: modelViewTransform,
        dragBoundsProperty: model.dragBoundsProperty,
        dragListenerOptions: {
          targetNode: this,
        },
        keyboardDragListenerOptions: {
          dragSpeed: 100,
          shiftDragSpeed: 50,
        },
      }),
    );
  }
}

/**
 * Container view for the two measurement lines.
 */
export class OscillatorMeasurementLinesNode extends Node {
  private readonly line1Node: MeasurementLineNode;
  private readonly line2Node: MeasurementLineNode;
  public readonly model: MeasurementLinesModel;

  public constructor(driverCenterX: number, driverWidth: number, modelViewTransform: ModelViewTransform2) {
    super();

    // Calculate displacement range in model coordinates (meters)
    // Using same coordinate system as mass position: 0 = equilibrium
    const minDisplacement = -0.4; // Can go 40cm below equilibrium
    const maxDisplacement = 0.3; // Can go 30cm above equilibrium

    // Create the model with displacement bounds (0 cm and 14 cm from equilibrium)
    this.model = new MeasurementLinesModel(minDisplacement, maxDisplacement, 0.0, 0.14);

    // Create view nodes for each line
    // With isometric transform, equilibrium is handled by modelViewTransform directly
    this.line1Node = new MeasurementLineNode(this.model.line1, driverWidth, driverCenterX, modelViewTransform, 1);
    this.line2Node = new MeasurementLineNode(this.model.line2, driverWidth, driverCenterX, modelViewTransform, 2);

    this.addChild(this.line1Node);
    this.addChild(this.line2Node);
  }

  public reset(): void {
    this.model.reset();
  }
}
