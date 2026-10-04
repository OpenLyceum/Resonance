/**
 * ModalShapeNode.ts
 *
 * Visualizes the theoretical modal shape (eigenfunction) of the Chladni plate
 * at a selected mode (m, n).
 *
 * For a rectangular plate with free edges, the modal shape is:
 * φ_{m,n}(x, y) = cos(mπx/a) * cos(nπy/b)
 *
 * where (m, n) are the mode numbers and (a, b) are the plate dimensions.
 * The visualization uses a diverging colormap (blue-white-red) to show
 * the amplitude, with nodal lines (where φ = 0) appearing as white.
 */

import { DerivedProperty, type Property } from "scenerystack/axon";
import { Bounds2 } from "scenerystack/dot";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { StringUtils } from "scenerystack/phetcommon";
import { CanvasNode, type CanvasNodeOptions } from "scenerystack/scenery";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";

/**
 * Represents a mode selection (m, n) for the Chladni plate.
 */
export type ModeSelection = {
  m: number;
  n: number;
};

export type ModalShapeNodeOptions = CanvasNodeOptions;

/**
 * Resolution of the modal shape grid (pixels per sample point).
 * Lower values = higher resolution but more computation.
 */
const SAMPLE_RESOLUTION = 4;

/**
 * Opacity of the modal shape overlay (0-1).
 */
const MODAL_SHAPE_OPACITY = 0.5;

/**
 * ModalShapeNode renders the theoretical modal shape for a selected mode.
 * Uses canvas rendering with a blue-white-red colormap to visualize the
 * eigenfunction amplitude across the plate surface.
 */
export class ModalShapeNode extends CanvasNode {
  private readonly selectedModeProperty: Property<ModeSelection>;
  private plateWidth: number;
  private plateHeight: number;

  // Pre-allocated ImageData for efficient rendering
  private imageData: ImageData | null = null;

  public constructor(
    viewWidth: number,
    viewHeight: number,
    plateWidth: number,
    plateHeight: number,
    selectedModeProperty: Property<ModeSelection>,
    providedOptions?: ModalShapeNodeOptions,
  ) {
    const options = optionize<ModalShapeNodeOptions, EmptySelfOptions, CanvasNodeOptions>()(
      { canvasBounds: new Bounds2(0, 0, viewWidth, viewHeight) },
      providedOptions,
    );
    super(options);

    this.plateWidth = plateWidth;
    this.plateHeight = plateHeight;
    this.selectedModeProperty = selectedModeProperty;

    // Listen for mode changes
    this.selectedModeProperty.link(() => {
      this.update();
    });

    // PDOM accessibility
    this.tagName = "div";
    this.ariaRole = "img";
    this.accessibleName = ResonanceStrings.chladni.a11y.modalShapeLabelStringProperty;

    // Dynamic description that updates with mode selection
    const descriptionProperty = new DerivedProperty(
      [selectedModeProperty, ResonanceStrings.chladni.a11y.modalShapeDescriptionStringProperty],
      (mode, pattern) => StringUtils.fillIn(pattern, { m: mode.m, n: mode.n }),
    );
    this.descriptionContent = descriptionProperty;
    // Listen for visibility changes to trigger repaint when becoming visible
    this.visibleProperty.lazyLink((visible) => {
      if (visible) {
        this.invalidatePaint();
      }
    });
  }

  /**
   * Update the dimensions of the modal shape visualization.
   */
  public updateDimensions(viewWidth: number, viewHeight: number, plateWidth: number, plateHeight: number): void {
    this.plateWidth = plateWidth;
    this.plateHeight = plateHeight;

    this.setCanvasBounds(new Bounds2(0, 0, viewWidth, viewHeight));
    // Reset imageData to force reallocation at new size
    this.imageData = null;
    this.update();
  }

  /**
   * Update the modal shape visualization.
   */
  public update(): void {
    if (!this.visible) {
      return;
    }

    this.invalidatePaint();
  }

  /**
   * Calculate the modal shape amplitude at a given point.
   * Uses the eigenfunction: φ_{m,n}(x, y) = cos(mπx/a) * cos(nπy/b)
   *
   * @param x - X coordinate in model space (0 to plateWidth)
   * @param y - Y coordinate in model space (0 to plateHeight)
   * @returns The amplitude in range [-1, 1]
   */
  private calculateModalAmplitude(x: number, y: number): number {
    const mode = this.selectedModeProperty.value;
    const m = mode.m;
    const n = mode.n;

    // Calculate the eigenfunction value
    // φ_{m,n}(x, y) = cos(mπx/a) * cos(nπy/b)
    const phiX = Math.cos((m * Math.PI * x) / this.plateWidth);
    const phiY = Math.cos((n * Math.PI * y) / this.plateHeight);

    return phiX * phiY;
  }

  /**
   * Convert modal amplitude to RGB color.
   * Blue (-1) -> White (0) -> Red (+1)
   */
  private amplitudeToColor(amplitude: number): [number, number, number] {
    // Clamp to [-1, 1]
    const a = Math.max(-1, Math.min(1, amplitude));

    if (a < 0) {
      // Blue to White (negative amplitude)
      const t = 1 + a; // 0 to 1 as a goes from -1 to 0
      return [
        Math.round(t * 255), // R: 0 -> 255
        Math.round(t * 255), // G: 0 -> 255
        255, // B: always 255
      ];
    } else {
      // White to Red (positive amplitude)
      const t = 1 - a; // 1 to 0 as a goes from 0 to 1
      return [
        255, // R: always 255
        Math.round(t * 255), // G: 255 -> 0
        Math.round(t * 255), // B: 255 -> 0
      ];
    }
  }

  /**
   * Paint the modal shape on the canvas.
   * Renders the eigenfunction using a blue-white-red colormap.
   */
  public override paintCanvas(context: CanvasRenderingContext2D): void {
    const bounds = this.canvasBounds;
    if (!bounds) {
      return;
    }

    const width = bounds.width;
    const height = bounds.height;

    // Calculate sample grid dimensions
    const sampleWidth = Math.ceil(width / SAMPLE_RESOLUTION);
    const sampleHeight = Math.ceil(height / SAMPLE_RESOLUTION);

    // Allocate or reuse ImageData
    if (!this.imageData || this.imageData.width !== sampleWidth || this.imageData.height !== sampleHeight) {
      this.imageData = context.createImageData(sampleWidth, sampleHeight);
    }

    const data = this.imageData.data;
    const alpha = Math.round(MODAL_SHAPE_OPACITY * 255);

    // Render the modal shape
    for (let sy = 0; sy < sampleHeight; sy++) {
      // Convert sample Y to model Y (view Y is top-down, model Y is bottom-up)
      const viewY = (sy + 0.5) * SAMPLE_RESOLUTION;
      const modelY = this.plateHeight - (viewY / height) * this.plateHeight;

      for (let sx = 0; sx < sampleWidth; sx++) {
        // Convert sample X to model X
        const viewX = (sx + 0.5) * SAMPLE_RESOLUTION;
        const modelX = (viewX / width) * this.plateWidth;

        // Calculate amplitude and convert to color
        const amplitude = this.calculateModalAmplitude(modelX, modelY);
        const [r, g, b] = this.amplitudeToColor(amplitude);

        // Set pixel color
        const pixelIdx = (sy * sampleWidth + sx) * 4;
        data[pixelIdx] = r;
        data[pixelIdx + 1] = g;
        data[pixelIdx + 2] = b;
        data[pixelIdx + 3] = alpha;
      }
    }

    // Draw the low-res image scaled up
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = sampleWidth;
    tempCanvas.height = sampleHeight;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.putImageData(this.imageData, 0, 0);

    // Draw scaled up with smoothing for a smoother appearance
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(tempCanvas, 0, 0, width, height);
  }
}
