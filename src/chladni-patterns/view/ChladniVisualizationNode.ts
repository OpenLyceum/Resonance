/**
 * ChladniVisualizationNode.ts
 *
 * A high-performance visualization for rendering Chladni pattern particles.
 * Supports both Canvas 2D and WebGL (via SceneryStack's Sprites system) rendering modes.
 * User can choose between renderers via preferences.
 *
 * Coordinate System:
 * - Model: (0,0) at center, +Y up
 * - View: (0,0) at top-left, +Y down
 * - Uses ModelViewTransform2 for coordinate conversion
 */

import { PatternStringProperty, type Property } from "scenerystack/axon";
import { Bounds2 } from "scenerystack/dot";
import { optionize } from "scenerystack/phet-core";
import type { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Node, type NodeOptions, Rectangle } from "scenerystack/scenery";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import { RendererType } from "../../preferences/RendererType.js";
import ResonanceColors from "../../ResonanceColors.js";
import type { ChladniModel } from "../model/ChladniModel.js";
import { createChladniTransform } from "./ChladniTransformFactory.js";
import { createMaterialNameProperty } from "./MaterialStrings.js";
import { CanvasParticleRenderer, type ParticleRenderer, WebGLParticleRenderer } from "./renderers/index.js";

type ChladniVisualizationNodeSelfOptions = {
  // Size of the visualization area (deprecated, use visualizationWidth/Height)
  visualizationSize?: number;
  // Width of the visualization area in pixels
  visualizationWidth?: number;
  // Height of the visualization area in pixels
  visualizationHeight?: number;
};

export type ChladniVisualizationNodeOptions = ChladniVisualizationNodeSelfOptions & NodeOptions;

const DEFAULT_VISUALIZATION_SIZE = 400;

export class ChladniVisualizationNode extends Node {
  private readonly model: ChladniModel;
  private visualizationWidth: number;
  private visualizationHeight: number;

  // Model-View transform for coordinate conversion
  private modelViewTransform: ModelViewTransform2;

  // Common elements
  private readonly backgroundRect: Rectangle;
  private readonly borderRect: Rectangle;
  private readonly innerBorderRect: Rectangle;

  // Particle renderer (strategy pattern)
  private particleRenderer: ParticleRenderer | null = null;
  private currentRendererType: RendererType;

  public constructor(
    model: ChladniModel,
    rendererTypeProperty: Property<RendererType>,
    providedOptions?: ChladniVisualizationNodeOptions,
  ) {
    // Support both legacy visualizationSize and new width/height options: width and
    // height each fall back to the (possibly legacy) square size when not given.
    const visualizationSize = providedOptions?.visualizationSize ?? DEFAULT_VISUALIZATION_SIZE;
    const options = optionize<ChladniVisualizationNodeOptions, ChladniVisualizationNodeSelfOptions, NodeOptions>()(
      {
        visualizationSize,
        visualizationWidth: visualizationSize,
        visualizationHeight: visualizationSize,
      },
      providedOptions,
    );

    super(options);

    const visualizationWidth = options.visualizationWidth;
    const visualizationHeight = options.visualizationHeight;

    this.model = model;
    this.visualizationWidth = visualizationWidth;
    this.visualizationHeight = visualizationHeight;
    this.currentRendererType = rendererTypeProperty.value;

    // Create the model-view transform using the shared factory
    this.modelViewTransform = createChladniTransform(
      model.plateWidth,
      model.plateHeight,
      visualizationWidth,
      visualizationHeight,
    );

    // Create background rectangle
    this.backgroundRect = new Rectangle(0, 0, visualizationWidth, visualizationHeight, {
      fill: ResonanceColors.chladniBackgroundProperty,
    });
    this.addChild(this.backgroundRect);

    // Create border rectangle (outer)
    this.borderRect = new Rectangle(0, 0, visualizationWidth, visualizationHeight, {
      stroke: ResonanceColors.chladniPlateBorderProperty,
      lineWidth: 2,
    });

    // Create inner border rectangle (shown only in clamp mode)
    const innerInset = 4;
    this.innerBorderRect = new Rectangle(
      innerInset,
      innerInset,
      visualizationWidth - 2 * innerInset,
      visualizationHeight - 2 * innerInset,
      {
        stroke: ResonanceColors.chladniPlateBorderProperty,
        lineWidth: 1,
        opacity: 0.6,
      },
    );

    // Initialize the renderer using strategy pattern
    this.initializeRenderer(this.currentRendererType);

    // Add borders on top
    this.addChild(this.borderRect);
    this.addChild(this.innerBorderRect);

    // Link inner border visibility to boundary mode
    model.boundaryModeProperty.link((mode) => {
      this.innerBorderRect.visible = mode === "clamp";
    });

    // Listen for renderer type changes
    rendererTypeProperty.link((newRenderer) => {
      if (newRenderer !== this.currentRendererType) {
        this.switchRenderer(newRenderer);
      }
    });

    // Update renderer when particle color changes
    ResonanceColors.chladniParticleProperty.link(() => {
      this.particleRenderer?.onColorChange();
    });

    // --- Accessibility (PDOM) Setup ---
    // Make the visualization accessible to screen readers
    this.tagName = "div";
    this.ariaRole = "img";
    this.accessibleName = ResonanceStrings.chladni.a11y.visualizationLabelStringProperty;

    // Dynamic description; follows the model state and the locale
    this.descriptionContent = new PatternStringProperty(
      ResonanceStrings.chladni.a11y.visualizationDescriptionStringProperty,
      {
        count: model.actualParticleCountProperty,
        material: createMaterialNameProperty(model.materialProperty),
        frequency: model.frequencyProperty,
      },
      { maps: { frequency: (frequency: number) => Math.round(frequency) } },
    );
  }

  /**
   * Initialize the specified renderer using strategy pattern.
   */
  private initializeRenderer(rendererType: RendererType): void {
    // Dispose existing renderer
    if (this.particleRenderer) {
      const oldNode = this.particleRenderer.getNode();
      if (this.hasChild(oldNode)) {
        this.removeChild(oldNode);
      }
      this.particleRenderer.dispose();
    }

    // Create new renderer based on type
    if (rendererType === RendererType.WEBGL) {
      this.particleRenderer = new WebGLParticleRenderer(
        this.visualizationWidth,
        this.visualizationHeight,
        this.modelViewTransform,
      );
    } else {
      this.particleRenderer = new CanvasParticleRenderer(
        this.visualizationWidth,
        this.visualizationHeight,
        this.modelViewTransform,
      );
    }

    // Insert renderer node between background and border
    this.insertChild(1, this.particleRenderer.getNode());
    this.currentRendererType = rendererType;
  }

  /**
   * Switch to a different renderer.
   */
  private switchRenderer(newRendererType: RendererType): void {
    this.initializeRenderer(newRendererType);
    this.update();
  }

  /**
   * Update the visualization (called each frame when animating).
   */
  public update(): void {
    if (this.particleRenderer) {
      this.particleRenderer.update(this.model.particlePositions, this.modelViewTransform);
    }
  }

  /**
   * Resize the visualization to new dimensions.
   * The center position is preserved.
   * Recreates the ModelViewTransform2 for the new dimensions.
   */
  public resize(newWidth: number, newHeight: number): void {
    this.visualizationWidth = newWidth;
    this.visualizationHeight = newHeight;

    // Recreate the transform using the shared factory
    this.modelViewTransform = createChladniTransform(
      this.model.plateWidth,
      this.model.plateHeight,
      newWidth,
      newHeight,
    );

    // Update background and borders
    this.backgroundRect.setRect(0, 0, newWidth, newHeight);
    this.borderRect.setRect(0, 0, newWidth, newHeight);
    const innerInset = 4;
    this.innerBorderRect.setRect(innerInset, innerInset, newWidth - 2 * innerInset, newHeight - 2 * innerInset);

    // Resize the renderer
    if (this.particleRenderer) {
      this.particleRenderer.resize(newWidth, newHeight, this.modelViewTransform);
    }

    // Explicitly set local bounds so they update immediately (even when paused)
    this.localBounds = new Bounds2(0, 0, newWidth, newHeight);

    // Update positions
    this.update();
  }

  /**
   * Get the current visualization width.
   */
  public getVisualizationWidth(): number {
    return this.visualizationWidth;
  }

  /**
   * Get the current visualization height.
   */
  public getVisualizationHeight(): number {
    return this.visualizationHeight;
  }

  /**
   * Dispose of the visualization node and its renderer.
   */
  public override dispose(): void {
    this.particleRenderer?.dispose();
    super.dispose();
  }
}
