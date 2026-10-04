/**
 * ResonanceCurveNode.ts
 *
 * Displays the resonance curve (courbe de résonance) showing how the plate's
 * amplitude response varies with frequency. Uses the bamboo charting library
 * for proper plotting with axes and grid lines.
 *
 * The graph shows a scrolling window that follows the current frequency,
 * revealing resonance peaks as you adjust the frequency slider.
 */

import { DerivedProperty, Multilink } from "scenerystack/axon";
import { ChartRectangle, ChartTransform, GridLineSet, LinePlot, TickLabelSet, TickMarkSet } from "scenerystack/bamboo";
import { Bounds2, Range } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { StringUtils } from "scenerystack/phetcommon";
import { Line, Node, Text } from "scenerystack/scenery";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceColors from "../../ResonanceColors.js";
import ResonanceConstants from "../../ResonanceConstants.js";
import type { ChladniModel } from "../model/ChladniModel.js";
import { createMaterialNameProperty } from "./MaterialStrings.js";

// Chart dimensions
const CHART_WIDTH = 220;
const CHART_HEIGHT = 120;

// Total height including space for axis tick marks and labels below the chart
const TOTAL_HEIGHT = CHART_HEIGHT + 35;

// Number of sample points for the curve
const SAMPLE_COUNT = 2000;

export class ResonanceCurveNode extends Node {
  private readonly model: ChladniModel;
  private readonly chartTransform: ChartTransform;
  private readonly linePlot: LinePlot;
  private readonly frequencyMarker: Line;
  private readonly chartRectangle: ChartRectangle;

  // Grid and tick elements
  private verticalGridLines: GridLineSet;
  private horizontalGridLines: GridLineSet;
  private xTickMarks: TickMarkSet;
  private xTickLabels: TickLabelSet;

  // Hz label
  private readonly hzLabel: Text;

  // Container for all chart content (chart area, ticks, labels)
  private readonly fixedContainer: Node;

  // Track current window range
  private currentWindowRange: Range;

  public constructor(model: ChladniModel) {
    super();

    this.model = model;

    // Get initial window range
    this.currentWindowRange = model.getGraphWindowRange();

    // Create chart transform
    this.chartTransform = new ChartTransform({
      viewWidth: CHART_WIDTH,
      viewHeight: CHART_HEIGHT,
      modelXRange: this.currentWindowRange,
      modelYRange: new Range(0, 1), // Normalized amplitude
    });

    // Container for all chart content
    this.fixedContainer = new Node();

    // Background rectangle
    this.chartRectangle = new ChartRectangle(this.chartTransform, {
      fill: ResonanceColors.chladniBackgroundProperty,
      stroke: ResonanceColors.chladniPlateBorderProperty,
      lineWidth: 1,
    });
    this.fixedContainer.addChild(this.chartRectangle);

    // Create a clipped container for the chart content (grid, curve, marker)
    // This prevents the curve and grid from rendering outside the chart area
    const chartClipArea = Shape.bounds(new Bounds2(0, 0, CHART_WIDTH, CHART_HEIGHT));
    const clippedChartContent = new Node({
      clipArea: chartClipArea,
    });

    // Grid lines
    const gridSpacingX = this.calculateGridSpacing(this.currentWindowRange);
    this.verticalGridLines = new GridLineSet(this.chartTransform, Orientation.VERTICAL, gridSpacingX, {
      stroke: ResonanceColors.gridLinesProperty,
      lineWidth: 0.5,
    });
    clippedChartContent.addChild(this.verticalGridLines);

    this.horizontalGridLines = new GridLineSet(this.chartTransform, Orientation.HORIZONTAL, 0.2, {
      stroke: ResonanceColors.gridLinesProperty,
      lineWidth: 0.5,
    });
    clippedChartContent.addChild(this.horizontalGridLines);

    // Create the line plot for resonance curve using precomputed data
    const dataSet = this.model.getResonanceCurveData(SAMPLE_COUNT);
    this.linePlot = new LinePlot(this.chartTransform, dataSet, {
      stroke: ResonanceColors.frequencyTrackProperty,
      lineWidth: 2,
    });
    clippedChartContent.addChild(this.linePlot);

    // Current frequency marker (vertical line)
    this.frequencyMarker = new Line(0, 0, 0, CHART_HEIGHT, {
      stroke: ResonanceColors.textProperty,
      lineWidth: 2,
      lineDash: [4, 4],
    });
    clippedChartContent.addChild(this.frequencyMarker);

    this.fixedContainer.addChild(clippedChartContent);

    // X-axis tick marks (outside clip area, at the bottom edge)
    this.xTickMarks = new TickMarkSet(this.chartTransform, Orientation.HORIZONTAL, gridSpacingX, {
      edge: "min",
      stroke: ResonanceColors.textProperty,
      lineWidth: 1,
      extent: 6,
    });
    this.fixedContainer.addChild(this.xTickMarks);

    // X-axis tick labels with fixed-width formatting to prevent layout shifts
    this.xTickLabels = new TickLabelSet(this.chartTransform, Orientation.HORIZONTAL, gridSpacingX, {
      edge: "min",
      createLabel: (value: number) =>
        new Text(Math.round(value).toString(), {
          font: ResonanceConstants.TICK_LABEL_FONT,
          fill: ResonanceColors.textProperty,
          maxWidth: 40, // Fixed max width to prevent layout shifts
        }),
    });
    this.fixedContainer.addChild(this.xTickLabels);

    // Hz label at fixed position
    this.hzLabel = new Text(ResonanceStrings.units.hzStringProperty, {
      font: ResonanceConstants.TICK_LABEL_FONT,
      fill: ResonanceColors.textProperty,
      left: CHART_WIDTH + 5,
      top: CHART_HEIGHT + 18,
    });
    this.fixedContainer.addChild(this.hzLabel);

    // Add the fixed container to this node
    this.addChild(this.fixedContainer);

    // Set explicit local bounds so that the node always reports the same bounds
    // regardless of which tick labels are currently visible. Without this, tick
    // labels near the chart edges extend the node's bounds, causing parent layout
    // (VBox centering, right-alignment) to shift as the x-axis window scrolls.
    // The origin (0,0) is the top-left of the chart area.
    this.localBounds = new Bounds2(0, 0, CHART_WIDTH, TOTAL_HEIGHT);

    this.updateFrequencyMarker();

    // Update when frequency changes (just update window and marker, data is precomputed)
    model.frequencyProperty.link(() => {
      this.updateWindowRange();
      this.updateCurveFromPrecomputed();
      this.updateFrequencyMarker();
    });

    // Update curve when material, excitation position, or plate dimensions change
    // (model recomputes the full curve, we just need to display the window)
    // Using Multilink to consolidate multiple properties triggering the same action
    Multilink.multilink(
      [model.materialProperty, model.excitationPositionProperty, model.plateWidthProperty, model.plateHeightProperty],
      () => {
        this.updateCurveFromPrecomputed();
      },
    );

    // --- Accessibility (PDOM) Setup ---
    this.tagName = "div";
    this.ariaRole = "img";
    this.accessibleName = ResonanceStrings.chladni.a11y.resonanceCurveLabelStringProperty;

    // Dynamic description; follows frequency, material, resonance state and the locale
    const a11yStrings = ResonanceStrings.chladni.a11y;
    const descriptionProperty = new DerivedProperty(
      [
        model.frequencyProperty,
        createMaterialNameProperty(model.materialProperty),
        a11yStrings.resonanceCurveDescriptionStringProperty,
        a11yStrings.responseStrongPeakStringProperty,
        a11yStrings.responseNearPeakStringProperty,
        a11yStrings.responseModerateStringProperty,
        a11yStrings.responseLowStringProperty,
      ],
      (frequency, materialName, pattern, strongPeak, nearPeak, moderate, low) => {
        const strength = model.strength(frequency);
        const maxStrength = this.estimateMaxStrengthInWindow();
        const normalizedStrength = maxStrength > 0 ? strength / maxStrength : 0;
        const windowRange = model.getGraphWindowRange();

        let response = low;
        if (normalizedStrength > 0.8) {
          response = strongPeak;
        } else if (normalizedStrength > 0.5) {
          response = nearPeak;
        } else if (normalizedStrength > 0.2) {
          response = moderate;
        }

        return StringUtils.fillIn(pattern, {
          material: materialName,
          minFrequency: Math.round(windowRange.min),
          maxFrequency: Math.round(windowRange.max),
          frequency: Math.round(frequency),
          response: response,
        });
      },
    );

    descriptionProperty.link((description) => {
      this.descriptionContent = description;
    });
  }

  /**
   * Estimate the maximum strength in the current visible window.
   * Used for normalizing the resonance description.
   */
  private estimateMaxStrengthInWindow(): number {
    const windowRange = this.model.getGraphWindowRange();
    const sampleCount = 20;
    let maxStrength = 0;

    for (let i = 0; i <= sampleCount; i++) {
      const freq = windowRange.min + (i / sampleCount) * (windowRange.max - windowRange.min);
      const strength = this.model.strength(freq);
      if (strength > maxStrength) {
        maxStrength = strength;
      }
    }

    return maxStrength;
  }

  /**
   * Calculate appropriate grid spacing based on the frequency range.
   */
  private calculateGridSpacing(range: Range): number {
    const span = range.max - range.min;
    if (span <= 200) {
      return 50;
    }
    if (span <= 500) {
      return 100;
    }
    if (span <= 1000) {
      return 200;
    }
    return 500;
  }

  /**
   * Update the window range based on current frequency.
   */
  private updateWindowRange(): void {
    const newRange = this.model.getGraphWindowRange();

    // Only update if range actually changed
    if (newRange.min !== this.currentWindowRange.min || newRange.max !== this.currentWindowRange.max) {
      this.currentWindowRange = newRange;
      this.chartTransform.setModelXRange(newRange);

      // Update grid and tick spacing
      const gridSpacing = this.calculateGridSpacing(newRange);
      this.verticalGridLines.setSpacing(gridSpacing);
      this.xTickMarks.setSpacing(gridSpacing);
      this.xTickLabels.setSpacing(gridSpacing);
    }
  }

  /**
   * Update the resonance curve using precomputed data from the model.
   * The model precomputes the full frequency range; we just extract the visible window.
   */
  private updateCurveFromPrecomputed(): void {
    const dataSet = this.model.getResonanceCurveData(SAMPLE_COUNT);
    this.linePlot.setDataSet(dataSet);
  }

  /**
   * Update the position of the frequency marker line.
   */
  private updateFrequencyMarker(): void {
    const freq = this.model.frequencyProperty.value;
    const x = this.chartTransform.modelToViewX(freq);

    this.frequencyMarker.x1 = x;
    this.frequencyMarker.x2 = x;
    this.frequencyMarker.y1 = 0;
    this.frequencyMarker.y2 = CHART_HEIGHT;
  }

  /**
   * Force a full update of the curve and marker.
   * @unused Not called from outside this class; updates are driven by internal property links.
   */
  public update(): void {
    this.updateWindowRange();
    this.updateCurveFromPrecomputed();
    this.updateFrequencyMarker();
  }
}
