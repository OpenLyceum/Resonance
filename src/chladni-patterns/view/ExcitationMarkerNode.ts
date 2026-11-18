/**
 * ExcitationMarkerNode.ts
 *
 * A draggable marker that shows the excitation position on the Chladni plate.
 * This is where the plate is being driven (vibrator position).
 * Extracted from ChladniScreenView for better separation of concerns.
 */

import { DerivedProperty, Property } from "scenerystack/axon";
import { Bounds2, Matrix3, Transform3, Vector2 } from "scenerystack/dot";
import type { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Circle, Node, RichDragListener, Voicing } from "scenerystack/scenery";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceColors from "../../ResonanceColors.js";
import type { ChladniModel } from "../model/ChladniModel.js";

// Excitation marker properties
const EXCITATION_MARKER_RADIUS = 12;
const EXCITATION_MARKER_INNER_RADIUS = 4;
const EXCITATION_MARKER_LINE_WIDTH = 3;
const KEYBOARD_DRAG_SPEED = 0.05; // meters per second (model units)
const KEYBOARD_SHIFT_DRAG_SPEED = 0.01; // slower with shift key for fine control

/**
 * Options for creating an ExcitationMarkerNode.
 */
export interface ExcitationMarkerNodeOptions {
  /**
   * Callback to get the current model-view transform.
   * Used for coordinate conversion during dragging.
   */
  getModelViewTransform: () => ModelViewTransform2;

  /**
   * Callback to get the visualization bounds in screen coordinates.
   * Used for positioning the marker relative to the visualization.
   */
  getVisualizationBounds: () => Bounds2;

  /**
   * Callback to get the visualization node for coordinate conversion.
   */
  getVisualizationNode: () => Node;

  /**
   * Optional callback when drag ends.
   */
  onDragEnd?: () => void;
}

// Apply Voicing mixin to Node for spoken descriptions
const VoicingNode = Voicing(Node);

export class ExcitationMarkerNode extends VoicingNode {
  private readonly model: ChladniModel;
  private readonly options: ExcitationMarkerNodeOptions;

  // View-coordinate position property for pointer drag handling
  // This is kept in sync with the model's excitation position
  private readonly viewPositionProperty: Property<Vector2>;
  private isUpdatingFromModel = false;
  private isUpdatingFromView = false;

  public constructor(model: ChladniModel, options: ExcitationMarkerNodeOptions) {
    super({ cursor: "pointer" });

    this.model = model;
    this.options = options;

    // Create view position property initialized from model
    const initialViewPos = this.modelToViewPosition(model.excitationPositionProperty.value);
    this.viewPositionProperty = new Property(initialViewPos);

    // Bidirectional sync: model -> view
    model.excitationPositionProperty.link((modelPos) => {
      if (this.isUpdatingFromView) {
        return;
      }
      this.isUpdatingFromModel = true;
      this.viewPositionProperty.value = this.modelToViewPosition(modelPos);
      this.isUpdatingFromModel = false;
    });

    // Bidirectional sync: view -> model
    this.viewPositionProperty.lazyLink((viewPos) => {
      if (this.isUpdatingFromModel) {
        return;
      }
      this.isUpdatingFromView = true;
      model.excitationPositionProperty.value = this.viewToModelPosition(viewPos);
      this.isUpdatingFromView = false;
    });

    // Create the marker visuals
    this.createMarker();

    // RichDragListener: pointer drag in view coords, keyboard drag in model coords.
    this.addRichDragListener();

    // Update node position when view position changes
    this.viewPositionProperty.link((viewPos) => {
      this.center = viewPos;
    });

    // --- Accessibility (PDOM) Setup ---
    this.tagName = "div";
    this.focusable = true;
    this.accessibleName = ResonanceStrings.chladni.a11y.excitationMarkerLabelStringProperty;
    this.descriptionContent = ResonanceStrings.chladni.a11y.excitationMarkerDescriptionStringProperty;

    // --- Voicing Setup ---
    // Spoken when the marker receives focus
    this.voicingNameResponse = ResonanceStrings.chladni.a11y.excitationMarkerLabelStringProperty;
    this.voicingHintResponse = ResonanceStrings.chladni.a11y.excitationMarkerVoicingHintStringProperty;
  }

  /**
   * Convert model position to global view position.
   */
  private modelToViewPosition(modelPos: Vector2): Vector2 {
    const transform = this.options.getModelViewTransform();
    const vizBounds = this.options.getVisualizationBounds();
    const localView = transform.modelToViewPosition(modelPos);
    return new Vector2(vizBounds.minX + localView.x, vizBounds.minY + localView.y);
  }

  /**
   * Convert global view position to model position.
   */
  private viewToModelPosition(viewPos: Vector2): Vector2 {
    const transform = this.options.getModelViewTransform();
    const vizBounds = this.options.getVisualizationBounds();
    const localView = new Vector2(viewPos.x - vizBounds.minX, viewPos.y - vizBounds.minY);
    return transform.viewToModelPosition(localView);
  }

  /**
   * Create the visual marker elements.
   */
  private createMarker(): void {
    // Outer circle (ring)
    const outerCircle = new Circle(EXCITATION_MARKER_RADIUS, {
      stroke: ResonanceColors.frequencyTrackProperty,
      lineWidth: EXCITATION_MARKER_LINE_WIDTH,
      fill: null,
    });
    this.addChild(outerCircle);

    // Inner filled circle
    const innerCircle = new Circle(EXCITATION_MARKER_INNER_RADIUS, {
      fill: ResonanceColors.frequencyTrackProperty,
    });
    this.addChild(innerCircle);
  }

  /**
   * Add RichDragListener for pointer and keyboard positioning.
   */
  private addRichDragListener(): void {
    const createViewDragBounds = () => this.options.getVisualizationBounds();
    const viewDragBoundsProperty = new Property(createViewDragBounds());

    this.model.plateWidthProperty.link(() => {
      viewDragBoundsProperty.value = createViewDragBounds();
    });
    this.model.plateHeightProperty.link(() => {
      viewDragBoundsProperty.value = createViewDragBounds();
    });

    // Keyboard drag stays on the plate, which is centered on the model origin.
    const modelDragBoundsProperty = new DerivedProperty(
      [this.model.plateWidthProperty, this.model.plateHeightProperty],
      (width, height) => new Bounds2(-width / 2, -height / 2, width / 2, height / 2),
    );

    // Invert Y for keyboard drag: model coords use +Y up, screen uses +Y down.
    const invertYTransform = new Transform3(Matrix3.scaling(1, -1));

    this.addInputListener(
      new RichDragListener({
        dragListenerOptions: {
          positionProperty: this.viewPositionProperty,
          dragBoundsProperty: viewDragBoundsProperty,
          useParentOffset: true,
          end: () => {
            this.options.onDragEnd?.();
          },
        },
        keyboardDragListenerOptions: {
          positionProperty: this.model.excitationPositionProperty,
          dragBoundsProperty: modelDragBoundsProperty,
          transform: invertYTransform,
          dragSpeed: KEYBOARD_DRAG_SPEED,
          shiftDragSpeed: KEYBOARD_SHIFT_DRAG_SPEED,
        },
      }),
    );
  }

  /**
   * Update the marker position based on the model.
   * Called when visualization size changes.
   */
  public updatePosition(): void {
    // Trigger re-sync from model to view
    this.isUpdatingFromModel = true;
    this.viewPositionProperty.value = this.modelToViewPosition(this.model.excitationPositionProperty.value);
    this.isUpdatingFromModel = false;
  }
}
