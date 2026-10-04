/**
 * ChladniRulerNode.ts
 *
 * A ruler overlay for the Chladni plate visualization.
 * Shows measurement ticks along the edges of the plate in centimeters.
 * Extends ChladniOverlayNode for common overlay functionality.
 */

import { Line, Text } from "scenerystack/scenery";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceColors from "../../ResonanceColors.js";
import ResonanceConstants from "../../ResonanceConstants.js";
import { ChladniOverlayNode } from "./ChladniOverlayNode.js";

// Ruler configuration
const MAJOR_TICK_LENGTH = 10;
const MINOR_TICK_LENGTH = 5;
const TICK_LINE_WIDTH = 1.5;
const MAJOR_TICK_SPACING_CM = 5; // Major tick every 5 cm
const MINOR_TICK_SPACING_CM = 1; // Minor tick every 1 cm

export class ChladniRulerNode extends ChladniOverlayNode {
  public constructor(
    visualizationWidth: number,
    visualizationHeight: number,
    plateWidthMeters: number,
    plateHeightMeters: number,
  ) {
    super(visualizationWidth, visualizationHeight, plateWidthMeters, plateHeightMeters);

    // PDOM accessibility
    this.tagName = "div";
    this.ariaRole = "img";
    this.accessibleName = ResonanceStrings.chladni.a11y.rulerLabelStringProperty;

    // Describe the plate dimensions (tracks locale and plate resizes)
    this.setPlateDescription(ResonanceStrings.chladni.a11y.rulerDescriptionStringProperty);
  }

  /**
   * Create the ruler tick marks and labels.
   */
  protected create(): void {
    const { widthCm, heightCm } = this.getPlateDimensionsCm();
    const { x: pxPerCmX, y: pxPerCmY } = this.getPixelsPerCm();

    // Create horizontal ruler (bottom edge)
    this.createHorizontalRuler(widthCm, pxPerCmX);

    // Create vertical ruler (left edge)
    this.createVerticalRuler(heightCm, pxPerCmY);

    // Add "cm" label
    const cmLabel = new Text(ResonanceStrings.units.cmStringProperty, {
      font: ResonanceConstants.TICK_LABEL_FONT,
      fill: ResonanceColors.textProperty,
      left: this.visualizationWidth + 5,
      top: this.visualizationHeight + 5,
    });
    this.addChild(cmLabel);
  }

  /**
   * Create horizontal ruler along the bottom edge.
   */
  private createHorizontalRuler(widthCm: number, pxPerCm: number): void {
    for (let cm = 0; cm <= widthCm; cm += MINOR_TICK_SPACING_CM) {
      const x = cm * pxPerCm;
      const isMajor = cm % MAJOR_TICK_SPACING_CM === 0;
      const tickLength = isMajor ? MAJOR_TICK_LENGTH : MINOR_TICK_LENGTH;

      // Tick mark extending downward from bottom edge
      const tick = new Line(x, this.visualizationHeight, x, this.visualizationHeight + tickLength, {
        stroke: ResonanceColors.textProperty,
        lineWidth: TICK_LINE_WIDTH,
      });
      this.addChild(tick);

      // Label for major ticks
      if (isMajor && cm > 0) {
        const label = new Text(cm.toString(), {
          font: ResonanceConstants.TICK_LABEL_FONT,
          fill: ResonanceColors.textProperty,
          centerX: x,
          top: this.visualizationHeight + MAJOR_TICK_LENGTH + 2,
        });
        this.addChild(label);
      }
    }
  }

  /**
   * Create vertical ruler along the left edge.
   */
  private createVerticalRuler(heightCm: number, pxPerCm: number): void {
    for (let cm = 0; cm <= heightCm; cm += MINOR_TICK_SPACING_CM) {
      // Y is inverted: 0 cm at bottom of visualization
      const y = this.visualizationHeight - cm * pxPerCm;
      const isMajor = cm % MAJOR_TICK_SPACING_CM === 0;
      const tickLength = isMajor ? MAJOR_TICK_LENGTH : MINOR_TICK_LENGTH;

      // Tick mark extending leftward from left edge
      const tick = new Line(-tickLength, y, 0, y, {
        stroke: ResonanceColors.textProperty,
        lineWidth: TICK_LINE_WIDTH,
      });
      this.addChild(tick);

      // Label for major ticks
      if (isMajor && cm > 0) {
        const label = new Text(cm.toString(), {
          font: ResonanceConstants.TICK_LABEL_FONT,
          fill: ResonanceColors.textProperty,
          right: -MAJOR_TICK_LENGTH - 3,
          centerY: y,
        });
        this.addChild(label);
      }
    }
  }
}
