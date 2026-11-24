/**
 * DisplacementColormapNode.ts
 *
 * Overlay visualization showing displacement magnitude across the Chladni plate surface.
 * Uses a colormap (blue-white-red) to represent the displacement field, which helps
 * users understand the nodal patterns where particles accumulate.
 *
 * Blue = negative displacement (downward)
 * White = zero displacement (nodal lines)
 * Red = positive displacement (upward)
 */

import { Bounds2 } from "scenerystack/dot";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { CanvasNode, type CanvasNodeOptions } from "scenerystack/scenery";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import { ChladniOverlayNode } from "./ChladniOverlayNode.js";

/**
 * Type for the displacement function
 */
export type DisplacementFunction = (x: number, y: number) => number;

/**
 * Resolution of the colormap grid (pixels per sample point).
 * Lower values = higher resolution but more computation.
 */
const SAMPLE_RESOLUTION = 4;

/**
 * Opacity of the colormap overlay (0-1).
 * Lower values allow particles to show through better.
 */
const COLORMAP_OPACITY = 0.6;

/**
 * Internal canvas node that renders the displacement colormap.
 */
class ColormapCanvasNode extends CanvasNode {
  private psiFunction: DisplacementFunction;
  private plateWidthMeters: number;
  private plateHeightMeters: number;

  // Pre-allocated ImageData for efficient rendering
  private imageData: ImageData | null = null;

  public constructor(
    width: number,
    height: number,
    psiFunction: DisplacementFunction,
    plateWidthMeters: number,
    plateHeightMeters: number,
    providedOptions?: CanvasNodeOptions,
  ) {
    const options = optionize<CanvasNodeOptions, EmptySelfOptions, CanvasNodeOptions>()(
      { canvasBounds: new Bounds2(0, 0, width, height) },
      providedOptions,
    );
    super(options);
    this.psiFunction = psiFunction;
    this.plateWidthMeters = plateWidthMeters;
    this.plateHeightMeters = plateHeightMeters;
  }

  public setPsiFunction(psiFunction: DisplacementFunction): void {
    this.psiFunction = psiFunction;
  }

  public setDimensions(width: number, height: number, plateWidthMeters: number, plateHeightMeters: number): void {
    this.canvasBounds = new Bounds2(0, 0, width, height);
    this.plateWidthMeters = plateWidthMeters;
    this.plateHeightMeters = plateHeightMeters;
    // Reset imageData to force reallocation at new size
    this.imageData = null;
  }

  /**
   * Convert displacement value to RGB color.
   * Blue (-1) -> White (0) -> Red (+1)
   */
  private displacementToColor(normalizedDisplacement: number): [number, number, number] {
    // Clamp to [-1, 1]
    const d = Math.max(-1, Math.min(1, normalizedDisplacement));

    if (d < 0) {
      // Blue to White (negative displacement)
      const t = 1 + d; // 0 to 1 as d goes from -1 to 0
      return [
        Math.round(t * 255), // R: 0 -> 255
        Math.round(t * 255), // G: 0 -> 255
        255, // B: always 255
      ];
    } else {
      // White to Red (positive displacement)
      const t = 1 - d; // 1 to 0 as d goes from 0 to 1
      return [
        255, // R: always 255
        Math.round(t * 255), // G: 255 -> 0
        Math.round(t * 255), // B: 255 -> 0
      ];
    }
  }

  public override paintCanvas(context: CanvasRenderingContext2D): void {
    const width = this.canvasBounds.width;
    const height = this.canvasBounds.height;

    // Calculate sample grid dimensions
    const sampleWidth = Math.ceil(width / SAMPLE_RESOLUTION);
    const sampleHeight = Math.ceil(height / SAMPLE_RESOLUTION);

    // Allocate or reuse ImageData
    if (!this.imageData || this.imageData.width !== sampleWidth || this.imageData.height !== sampleHeight) {
      this.imageData = context.createImageData(sampleWidth, sampleHeight);
    }

    const data = this.imageData.data;
    const halfWidth = this.plateWidthMeters / 2;
    const halfHeight = this.plateHeightMeters / 2;

    // First pass: calculate all displacements to find max for normalization
    let maxDisplacement = 0;
    const displacements: number[] = new Array<number>(sampleWidth * sampleHeight);

    for (let sy = 0; sy < sampleHeight; sy++) {
      // Convert sample Y to model Y (view Y is top-down, model Y is bottom-up)
      const viewY = (sy + 0.5) * SAMPLE_RESOLUTION;
      const modelY = halfHeight - (viewY / height) * this.plateHeightMeters;

      for (let sx = 0; sx < sampleWidth; sx++) {
        // Convert sample X to model X
        const viewX = (sx + 0.5) * SAMPLE_RESOLUTION;
        const modelX = (viewX / width) * this.plateWidthMeters - halfWidth;

        const psi = this.psiFunction(modelX, modelY);
        const idx = sy * sampleWidth + sx;
        displacements[idx] = psi;

        if (Math.abs(psi) > maxDisplacement) {
          maxDisplacement = Math.abs(psi);
        }
      }
    }

    // Avoid division by zero
    if (maxDisplacement === 0) {
      maxDisplacement = 1;
    }

    // Second pass: convert to colors
    const alpha = Math.round(COLORMAP_OPACITY * 255);
    for (let i = 0; i < displacements.length; i++) {
      const normalized = displacements[i]! / maxDisplacement;
      const [r, g, b] = this.displacementToColor(normalized);
      const pixelIdx = i * 4;
      data[pixelIdx] = r;
      data[pixelIdx + 1] = g;
      data[pixelIdx + 2] = b;
      data[pixelIdx + 3] = alpha;
    }

    // Draw the low-res image scaled up
    // Create a temporary canvas for the small image
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = sampleWidth;
    tempCanvas.height = sampleHeight;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) {
      return;
    }
    tempCtx.putImageData(this.imageData, 0, 0);

    // Draw scaled up with smoothing disabled for pixelated look,
    // or enabled for smooth interpolation
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(tempCanvas, 0, 0, width, height);
  }
}

/**
 * DisplacementColormapNode extends ChladniOverlayNode to show displacement
 * magnitude across the plate surface using a blue-white-red colormap.
 */
export class DisplacementColormapNode extends ChladniOverlayNode {
  private readonly canvasNode: ColormapCanvasNode;

  public constructor(
    visualizationWidth: number,
    visualizationHeight: number,
    plateWidthMeters: number,
    plateHeightMeters: number,
    psiFunction: DisplacementFunction,
  ) {
    super(visualizationWidth, visualizationHeight, plateWidthMeters, plateHeightMeters);

    // Create the canvas node for rendering
    this.canvasNode = new ColormapCanvasNode(
      visualizationWidth,
      visualizationHeight,
      psiFunction,
      plateWidthMeters,
      plateHeightMeters,
    );
    this.addChild(this.canvasNode);

    // PDOM accessibility
    this.tagName = "div";
    this.ariaRole = "img";
    this.accessibleName = ResonanceStrings.chladni.a11y.displacementColormapLabelStringProperty;
    this.descriptionContent = ResonanceStrings.chladni.a11y.displacementColormapDescriptionStringProperty;
  }

  /**
   * Create is called by the parent constructor.
   * We don't create the canvas here since psiFunction isn't set yet.
   */
  protected override create(): void {
    // Canvas node is created in constructor after super() call
  }

  /**
   * Update the displacement function (e.g., when frequency changes).
   */
  public setPsiFunction(psiFunction: DisplacementFunction): void {
    this.canvasNode.setPsiFunction(psiFunction);
  }

  /**
   * Trigger a repaint of the colormap.
   * Call this when frequency or other parameters change.
   */
  public update(): void {
    this.canvasNode.invalidatePaint();
  }

  /**
   * Override updateDimensions to handle canvas resizing.
   */
  public override updateDimensions(
    visualizationWidth: number,
    visualizationHeight: number,
    plateWidthMeters: number,
    plateHeightMeters: number,
  ): void {
    this.visualizationWidth = visualizationWidth;
    this.visualizationHeight = visualizationHeight;
    this.plateWidthMeters = plateWidthMeters;
    this.plateHeightMeters = plateHeightMeters;

    this.canvasNode.setDimensions(visualizationWidth, visualizationHeight, plateWidthMeters, plateHeightMeters);
    this.canvasNode.invalidatePaint();
  }
}
