/**
 * OscillatorGridNode displays a grid overlay for the oscillator screens.
 * Features:
 * - Major and minor grid lines
 * - Bold y=0 (equilibrium) line using modelViewTransform
 * - Scale indicator with double-headed arrow between two major grid lines
 */

import { PatternStringProperty } from "scenerystack/axon";
import type { Bounds2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import type { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Line, Node, Path, Text } from "scenerystack/scenery";
import { ArrowNode, PhetFont } from "scenerystack/scenery-phet";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceColors from "../../ResonanceColors.js";

// Default grid options
const DEFAULT_MAJOR_SPACING = 0.05; // 5 cm between major grid lines (meters)
const DEFAULT_MINOR_DIVISIONS_PER_MAJOR = 5; // 1 cm minor lines
const DEFAULT_GRID_WIDTH = 500; // view coordinates
const DEFAULT_GRID_TOP_MODEL = 0.25; // 25 cm above equilibrium (meters)
const DEFAULT_GRID_BOTTOM_MODEL = -0.3; // 30 cm below equilibrium (meters)
const DEFAULT_GRID_CENTER_X_OFFSET = -100; // offset from layoutBounds centerX

// Threshold for treating a model Y value as zero (equilibrium)
const Y_ZERO_THRESHOLD = 0.0001;

// Grid line styling
const MINOR_LINE_WIDTH = 1;
const MINOR_LINE_OPACITY = 0.6;
const MAJOR_LINE_WIDTH = 1.5;
const MAJOR_LINE_OPACITY = 0.9;
const EQUILIBRIUM_LINE_WIDTH = 3;

// Scale indicator arrow dimensions
const SCALE_INDICATOR_X_OFFSET = -20; // offset from grid right edge
const ARROW_HEAD_HEIGHT = 8;
const ARROW_HEAD_WIDTH = 8;
const ARROW_TAIL_WIDTH = 2;

export interface OscillatorGridNodeOptions {
  /** Spacing between major grid lines in model coordinates (meters) */
  majorSpacing?: number;
  /** Number of minor divisions between major lines */
  minorDivisionsPerMajor?: number;
  /** Width of the grid area in view coordinates */
  gridWidth?: number;
  /** Top of grid in model coordinates (meters) */
  gridTopModel?: number;
  /** Bottom of grid in model coordinates (meters) */
  gridBottomModel?: number;
  /** X position of the grid center in view coordinates */
  gridCenterX?: number;
}

export class OscillatorGridNode extends Node {
  private readonly modelViewTransform: ModelViewTransform2;
  private readonly majorSpacing: number;
  private readonly minorDivisionsPerMajor: number;
  private readonly gridWidth: number;
  private readonly gridTopModel: number;
  private readonly gridBottomModel: number;
  private readonly gridCenterX: number;

  public constructor(
    modelViewTransform: ModelViewTransform2,
    layoutBounds: Bounds2,
    options?: OscillatorGridNodeOptions,
  ) {
    super();

    this.modelViewTransform = modelViewTransform;
    this.majorSpacing = options?.majorSpacing ?? DEFAULT_MAJOR_SPACING;
    this.minorDivisionsPerMajor = options?.minorDivisionsPerMajor ?? DEFAULT_MINOR_DIVISIONS_PER_MAJOR;
    this.gridWidth = options?.gridWidth ?? DEFAULT_GRID_WIDTH;
    // Use model coordinates for top and bottom
    this.gridTopModel = options?.gridTopModel ?? DEFAULT_GRID_TOP_MODEL;
    this.gridBottomModel = options?.gridBottomModel ?? DEFAULT_GRID_BOTTOM_MODEL;
    this.gridCenterX = options?.gridCenterX ?? layoutBounds.centerX + DEFAULT_GRID_CENTER_X_OFFSET;

    // Create the grid
    this.createGrid();
  }

  private createGrid(): void {
    const minorSpacing = this.majorSpacing / this.minorDivisionsPerMajor;

    // Calculate view spacing for minor grid lines
    const minorSpacingView = Math.abs(this.modelViewTransform.modelToViewDeltaY(minorSpacing));

    // Grid bounds in view coordinates (using modelViewTransform)
    const gridLeft = this.gridCenterX - this.gridWidth / 2;
    const gridRight = this.gridCenterX + this.gridWidth / 2;
    const gridTopView = this.modelViewTransform.modelToViewY(this.gridTopModel);
    const gridBottomView = this.modelViewTransform.modelToViewY(this.gridBottomModel);

    // Calculate equilibrium Y position (model Y=0) using modelViewTransform
    const equilibriumViewY = this.modelViewTransform.modelToViewY(0);

    // Create shapes for minor and major grid lines
    const minorLinesShape = new Shape();
    const majorLinesShape = new Shape();

    // Draw horizontal lines based on model coordinates
    // Iterate through model Y values from bottom to top
    const numMajorLinesBelow = Math.ceil(Math.abs(this.gridBottomModel) / this.majorSpacing);
    const numMajorLinesAbove = Math.ceil(this.gridTopModel / this.majorSpacing);

    for (let majorIndex = -numMajorLinesBelow; majorIndex <= numMajorLinesAbove; majorIndex++) {
      // Draw minor lines between this major and the next
      for (let minorIndex = 0; minorIndex < this.minorDivisionsPerMajor; minorIndex++) {
        const modelY = majorIndex * this.majorSpacing + minorIndex * minorSpacing;
        if (modelY < this.gridBottomModel || modelY > this.gridTopModel) {
          continue;
        }

        const viewY = this.modelViewTransform.modelToViewY(modelY);

        // Skip the y=0 line (will be drawn separately as bold)
        if (Math.abs(modelY) < Y_ZERO_THRESHOLD) {
          continue;
        }

        const isMajor = minorIndex === 0;
        const shape = isMajor ? majorLinesShape : minorLinesShape;
        shape.moveTo(gridLeft, viewY);
        shape.lineTo(gridRight, viewY);
      }
    }

    // Draw vertical lines (varying X)
    const numLinesLeft = Math.ceil(this.gridWidth / 2 / minorSpacingView);
    const numLinesRight = numLinesLeft;

    for (let i = -numLinesLeft; i <= numLinesRight; i++) {
      const x = this.gridCenterX + i * minorSpacingView;
      if (x < gridLeft || x > gridRight) {
        continue;
      }

      const isMajor = i % this.minorDivisionsPerMajor === 0;
      const shape = isMajor ? majorLinesShape : minorLinesShape;
      shape.moveTo(x, gridTopView);
      shape.lineTo(x, gridBottomView);
    }

    // Create path nodes for grid lines with better visibility for projector mode
    const minorLinesNode = new Path(minorLinesShape, {
      stroke: ResonanceColors.gridLinesProperty,
      lineWidth: MINOR_LINE_WIDTH,
      opacity: MINOR_LINE_OPACITY,
    });

    const majorLinesNode = new Path(majorLinesShape, {
      stroke: ResonanceColors.gridLinesProperty,
      lineWidth: MAJOR_LINE_WIDTH,
      opacity: MAJOR_LINE_OPACITY,
    });

    // Bold y=0 (equilibrium) line - positioned using modelViewTransform
    const equilibriumLine = new Line(gridLeft, equilibriumViewY, gridRight, equilibriumViewY, {
      stroke: ResonanceColors.equilibriumProperty,
      lineWidth: EQUILIBRIUM_LINE_WIDTH,
    });

    // Add grid lines to the node
    this.addChild(minorLinesNode);
    this.addChild(majorLinesNode);
    this.addChild(equilibriumLine);

    // Create scale indicator with double arrow between two major grid lines
    // Position in upper right corner so it doesn't obstruct the simulation
    this.createScaleIndicator(gridRight, gridTopView);
  }

  /**
   * Creates a scale indicator showing the distance between major grid lines.
   * Positioned in the upper right corner between two actual major grid lines.
   */
  private createScaleIndicator(gridRight: number, _gridTopView: number): void {
    // Position in upper right corner of the grid
    const indicatorX = gridRight + SCALE_INDICATOR_X_OFFSET;

    // Find the top two major grid lines using model coordinates
    // Use the top of the grid and one major spacing below it
    const topMajorLineModel = Math.floor(this.gridTopModel / this.majorSpacing) * this.majorSpacing;
    const nextMajorLineModel = topMajorLineModel - this.majorSpacing;

    // Convert to view coordinates using modelViewTransform
    const arrowTop = this.modelViewTransform.modelToViewY(topMajorLineModel);
    const arrowBottom = this.modelViewTransform.modelToViewY(nextMajorLineModel);

    const arrow = new ArrowNode(indicatorX, arrowTop, indicatorX, arrowBottom, {
      doubleHead: true,
      headHeight: ARROW_HEAD_HEIGHT,
      headWidth: ARROW_HEAD_WIDTH,
      tailWidth: ARROW_TAIL_WIDTH,
      fill: ResonanceColors.textProperty,
      stroke: null,
    });

    // Label showing the distance (convert meters to cm)
    const distanceCm = this.majorSpacing * 100;
    const label = new Text(
      new PatternStringProperty(ResonanceStrings.units.cmPatternStringProperty, { value: distanceCm }),
      {
        font: new PhetFont({ size: 12 }),
        fill: ResonanceColors.textProperty,
        right: indicatorX - 8,
        centerY: (arrowTop + arrowBottom) / 2,
      },
    );

    // Container for scale indicator
    const scaleIndicator = new Node({
      children: [arrow, label],
    });

    this.addChild(scaleIndicator);
  }
}
