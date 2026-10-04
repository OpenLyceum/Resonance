/**
 * ChladniGridNode.ts
 *
 * A grid overlay for the Chladni plate visualization.
 * Shows major and minor grid lines.
 * Extends ChladniOverlayNode for common overlay functionality.
 */

import { Line } from "scenerystack/scenery";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceColors from "../../ResonanceColors.js";
import { ChladniOverlayNode } from "./ChladniOverlayNode.js";

// Grid configuration
const MAJOR_GRID_SPACING_CM = 5; // Major grid line every 5 cm
const MINOR_GRID_SPACING_CM = 1; // Minor grid line every 1 cm
const MAJOR_LINE_WIDTH = 1.5;
const MINOR_LINE_WIDTH = 0.5;
const MAJOR_LINE_OPACITY = 0.4;
const MINOR_LINE_OPACITY = 0.2;

export class ChladniGridNode extends ChladniOverlayNode {
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
    this.accessibleName = ResonanceStrings.chladni.a11y.gridLabelStringProperty;

    // Describe the plate dimensions (tracks locale and plate resizes)
    this.setPlateDescription(ResonanceStrings.chladni.a11y.gridDescriptionStringProperty);
  }

  /**
   * Create the grid lines.
   */
  protected create(): void {
    const { widthCm, heightCm } = this.getPlateDimensionsCm();
    const { x: pxPerCmX, y: pxPerCmY } = this.getPixelsPerCm();

    // Create minor grid lines first (so major lines render on top)
    this.createGridLines(widthCm, heightCm, pxPerCmX, pxPerCmY, false);

    // Create major grid lines
    this.createGridLines(widthCm, heightCm, pxPerCmX, pxPerCmY, true);
  }

  /**
   * Create grid lines (major or minor).
   */
  private createGridLines(widthCm: number, heightCm: number, pxPerCmX: number, pxPerCmY: number, major: boolean): void {
    const spacing = major ? MAJOR_GRID_SPACING_CM : MINOR_GRID_SPACING_CM;
    const lineWidth = major ? MAJOR_LINE_WIDTH : MINOR_LINE_WIDTH;
    const opacity = major ? MAJOR_LINE_OPACITY : MINOR_LINE_OPACITY;

    // Vertical lines
    for (let cm = 0; cm <= widthCm; cm += spacing) {
      // Skip minor lines where major lines exist
      if (!major && cm % MAJOR_GRID_SPACING_CM === 0) {
        continue;
      }

      const x = cm * pxPerCmX;
      const line = new Line(x, 0, x, this.visualizationHeight, {
        stroke: ResonanceColors.textProperty,
        lineWidth: lineWidth,
        opacity: opacity,
      });
      this.addChild(line);
    }

    // Horizontal lines
    for (let cm = 0; cm <= heightCm; cm += spacing) {
      // Skip minor lines where major lines exist
      if (!major && cm % MAJOR_GRID_SPACING_CM === 0) {
        continue;
      }

      const y = this.visualizationHeight - cm * pxPerCmY;
      const line = new Line(0, y, this.visualizationWidth, y, {
        stroke: ResonanceColors.textProperty,
        lineWidth: lineWidth,
        opacity: opacity,
      });
      this.addChild(line);
    }
  }
}
