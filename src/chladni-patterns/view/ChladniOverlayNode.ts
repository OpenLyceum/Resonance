/**
 * ChladniOverlayNode.ts
 *
 * Abstract base class for Chladni plate overlay components (ruler, grid).
 * Provides common functionality for managing overlay dimensions and updates.
 */

import { NumberProperty, PatternStringProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { Node } from "scenerystack/scenery";

/**
 * Overlay dimension parameters used for creating and updating overlays.
 */
export interface OverlayDimensions {
  visualizationWidth: number;
  visualizationHeight: number;
  plateWidthMeters: number;
  plateHeightMeters: number;
}

/**
 * Pixels per centimeter in X and Y directions.
 */
export interface PixelsPerCm {
  x: number;
  y: number;
}

/**
 * Abstract base class for Chladni plate overlays.
 * Provides common dimension management and helper methods.
 */
export abstract class ChladniOverlayNode extends Node {
  protected visualizationWidth: number;
  protected visualizationHeight: number;
  protected plateWidthMeters: number;
  protected plateHeightMeters: number;

  // Plate size in whole centimeters, feeding the PDOM description so it tracks resizes
  private readonly plateWidthCmProperty: NumberProperty;
  private readonly plateHeightCmProperty: NumberProperty;

  public constructor(
    visualizationWidth: number,
    visualizationHeight: number,
    plateWidthMeters: number,
    plateHeightMeters: number,
  ) {
    super();

    this.visualizationWidth = visualizationWidth;
    this.visualizationHeight = visualizationHeight;
    this.plateWidthMeters = plateWidthMeters;
    this.plateHeightMeters = plateHeightMeters;
    this.plateWidthCmProperty = new NumberProperty(Math.round(plateWidthMeters * 100));
    this.plateHeightCmProperty = new NumberProperty(Math.round(plateHeightMeters * 100));

    this.create();
  }

  /**
   * Use a "{{width}}" / "{{height}}" pattern (centimeters) as this overlay's PDOM
   * description. It stays current across locale changes and plate resizes.
   */
  protected setPlateDescription(patternStringProperty: TReadOnlyProperty<string>): void {
    this.descriptionContent = new PatternStringProperty(patternStringProperty, {
      width: this.plateWidthCmProperty,
      height: this.plateHeightCmProperty,
    });
  }

  /**
   * Abstract method to create the overlay content.
   * Subclasses must implement this to draw their specific overlay elements.
   */
  protected abstract create(): void;

  /**
   * Get the plate dimensions in centimeters.
   */
  protected getPlateDimensionsCm(): { widthCm: number; heightCm: number } {
    return {
      widthCm: this.plateWidthMeters * 100,
      heightCm: this.plateHeightMeters * 100,
    };
  }

  /**
   * Get the pixels per centimeter in both directions.
   */
  protected getPixelsPerCm(): PixelsPerCm {
    const { widthCm, heightCm } = this.getPlateDimensionsCm();
    return {
      x: this.visualizationWidth / widthCm,
      y: this.visualizationHeight / heightCm,
    };
  }

  /**
   * Update the overlay for new dimensions.
   * Clears existing content and recreates it with new dimensions.
   *
   * @param visualizationWidth - New visualization width in pixels
   * @param visualizationHeight - New visualization height in pixels
   * @param plateWidthMeters - New plate width in meters
   * @param plateHeightMeters - New plate height in meters
   */
  public updateDimensions(
    visualizationWidth: number,
    visualizationHeight: number,
    plateWidthMeters: number,
    plateHeightMeters: number,
  ): void {
    this.visualizationWidth = visualizationWidth;
    this.visualizationHeight = visualizationHeight;
    this.plateWidthMeters = plateWidthMeters;
    this.plateHeightMeters = plateHeightMeters;
    this.plateWidthCmProperty.value = Math.round(plateWidthMeters * 100);
    this.plateHeightCmProperty.value = Math.round(plateHeightMeters * 100);

    this.removeAllChildren();
    this.create();
  }

  /**
   * Get the current dimensions.
   */
  public getDimensions(): OverlayDimensions {
    return {
      visualizationWidth: this.visualizationWidth,
      visualizationHeight: this.visualizationHeight,
      plateWidthMeters: this.plateWidthMeters,
      plateHeightMeters: this.plateHeightMeters,
    };
  }
}
