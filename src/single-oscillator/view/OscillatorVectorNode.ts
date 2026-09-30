/**
 * OscillatorVectorNode displays velocity, acceleration, and applied force vectors
 * on the oscillator mass. Each vector is shown as an arrow originating from the
 * bottom of the mass, with length proportional to the magnitude of the quantity.
 *
 * The vectors are:
 * - Velocity (green): points in the direction of motion
 * - Acceleration (yellow): points in the direction of net acceleration
 * - Applied Force (orange): the spring force from the driver
 */

import { type BooleanProperty, Multilink, type TReadOnlyProperty, type UnknownMultilink } from "scenerystack/axon";
import type { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Node, Text } from "scenerystack/scenery";
import { ArrowNode, PhetFont } from "scenerystack/scenery-phet";
import type { ResonanceModel } from "../../common/model/ResonanceModel.js";
import { StringManager } from "../../i18n/StringManager.js";
import ResonanceColors from "../../ResonanceColors.js";

// Scale factors to convert physics values to pixel lengths
const VELOCITY_SCALE = 200; // pixels per m/s (increased for visibility)
const ACCELERATION_SCALE = 20; // pixels per m/s^2
const FORCE_SCALE = 200; // pixels per Newton

// Minimum length threshold to display vectors (pixels)
const MIN_VECTOR_LENGTH = 2;

// Arrow styling constants
const ARROW_HEAD_WIDTH = 12;
const ARROW_HEAD_HEIGHT = 10;
const ARROW_TAIL_WIDTH = 5;

// Horizontal spacing between vectors (pixels)
const VECTOR_SPACING = 12;

// Label styling
const LABEL_FONT = new PhetFont({ size: 12, weight: "bold" });
const LABEL_OFFSET_X = 4; // horizontal offset from arrow

export type OscillatorVectorNodeOptions = {
  velocityVisibleProperty: BooleanProperty;
  accelerationVisibleProperty: BooleanProperty;
  appliedForceVisibleProperty: BooleanProperty;
};

export class OscillatorVectorNode extends Node {
  private readonly velocityArrow: ArrowNode;
  private readonly accelerationArrow: ArrowNode;
  private readonly appliedForceArrow: ArrowNode;
  private readonly velocityContainer: Node;
  private readonly accelerationContainer: Node;
  private readonly appliedForceContainer: Node;
  private readonly velocityLabel: Text;
  private readonly accelerationLabel: Text;
  private readonly appliedForceLabel: Text;
  private readonly model: ResonanceModel;
  private readonly multilink: UnknownMultilink;

  public constructor(
    model: ResonanceModel,
    _modelViewTransform: ModelViewTransform2,
    options: OscillatorVectorNodeOptions,
  ) {
    super();

    this.model = model;

    // Create velocity arrow container (green) - leftmost position
    this.velocityContainer = new Node({ x: -VECTOR_SPACING });
    this.velocityArrow = new ArrowNode(0, 0, 0, 0, {
      fill: ResonanceColors.velocityVectorProperty,
      stroke: null,
      headWidth: ARROW_HEAD_WIDTH,
      headHeight: ARROW_HEAD_HEIGHT,
      tailWidth: ARROW_TAIL_WIDTH,
    });
    const controls = StringManager.getInstance().getAllStringProperties().resonance.controls;
    this.velocityLabel = new Text(controls.velocitySymbolStringProperty, {
      font: LABEL_FONT,
      fill: ResonanceColors.velocityVectorProperty,
    });
    this.velocityContainer.addChild(this.velocityArrow);
    this.velocityContainer.addChild(this.velocityLabel);
    this.addChild(this.velocityContainer);

    // Create acceleration arrow container (yellow) - center position
    this.accelerationContainer = new Node({ x: 0 });
    this.accelerationArrow = new ArrowNode(0, 0, 0, 0, {
      fill: ResonanceColors.accelerationVectorProperty,
      stroke: null,
      headWidth: ARROW_HEAD_WIDTH,
      headHeight: ARROW_HEAD_HEIGHT,
      tailWidth: ARROW_TAIL_WIDTH,
    });
    this.accelerationLabel = new Text(controls.accelerationSymbolStringProperty, {
      font: LABEL_FONT,
      fill: ResonanceColors.accelerationVectorProperty,
    });
    this.accelerationContainer.addChild(this.accelerationArrow);
    this.accelerationContainer.addChild(this.accelerationLabel);
    this.addChild(this.accelerationContainer);

    // Create applied force arrow container (orange) - rightmost position
    this.appliedForceContainer = new Node({ x: VECTOR_SPACING });
    this.appliedForceArrow = new ArrowNode(0, 0, 0, 0, {
      fill: ResonanceColors.appliedForceVectorProperty,
      stroke: null,
      headWidth: ARROW_HEAD_WIDTH,
      headHeight: ARROW_HEAD_HEIGHT,
      tailWidth: ARROW_TAIL_WIDTH,
    });
    this.appliedForceLabel = new Text(controls.appliedForceSymbolStringProperty, {
      font: LABEL_FONT,
      fill: ResonanceColors.appliedForceVectorProperty,
    });
    this.appliedForceContainer.addChild(this.appliedForceArrow);
    this.appliedForceContainer.addChild(this.appliedForceLabel);
    this.addChild(this.appliedForceContainer);

    // Link visibility to the control properties
    options.velocityVisibleProperty.linkAttribute(this.velocityContainer, "visible");
    options.accelerationVisibleProperty.linkAttribute(this.accelerationContainer, "visible");
    options.appliedForceVisibleProperty.linkAttribute(this.appliedForceContainer, "visible");

    // Create multilink to update vectors when physics values change
    this.multilink = Multilink.multilink(
      [
        options.velocityVisibleProperty as TReadOnlyProperty<boolean>,
        options.accelerationVisibleProperty as TReadOnlyProperty<boolean>,
        options.appliedForceVisibleProperty as TReadOnlyProperty<boolean>,
        model.velocityProperty as TReadOnlyProperty<number>,
        model.positionProperty as TReadOnlyProperty<number>,
      ],
      (
        velocityVisible: boolean,
        accelerationVisible: boolean,
        forceVisible: boolean,
        _velocity: number,
        _position: number,
      ) => {
        if (velocityVisible || accelerationVisible || forceVisible) {
          this.updateVectors();
        }
      },
    );
  }

  /**
   * Update the vector arrows based on current physics values.
   * Called each frame when the view steps.
   */
  public updateVectors(): void {
    const velocity = this.model.velocityProperty.value;
    const position = this.model.positionProperty.value;
    const mass = this.model.massProperty.value;
    const springConstant = this.model.springConstantProperty.value;
    const damping = this.model.dampingProperty.value;
    const gravity = this.model.gravityProperty.value;

    // Calculate the driving force
    let drivingForce = 0;
    if (this.model.drivingEnabledProperty.value) {
      const amplitude = this.model.drivingAmplitudeProperty.value;
      const phase = this.model.drivingPhaseProperty.value;
      drivingForce = springConstant * amplitude * Math.sin(phase);
    }

    // Calculate acceleration from the equation of motion:
    // m*a = -k*x - b*v - m*g + F_drive
    const acceleration = (-springConstant * position - damping * velocity - mass * gravity + drivingForce) / mass;

    // The applied force is the spring force from the driver (the driving term)
    // This is F_drive = k * A * sin(phase)
    const appliedForce = drivingForce;

    // Update velocity arrow
    // In model coordinates, positive velocity means moving in positive direction (upward when viewed)
    // In view coordinates with inverted Y, we need to convert
    const velocityPixels = velocity * VELOCITY_SCALE;
    // Positive velocity in model = upward = negative Y in view
    const velocityTipY = -velocityPixels;
    if (Math.abs(velocityPixels) > MIN_VECTOR_LENGTH) {
      this.velocityArrow.setTailAndTip(0, 0, 0, velocityTipY);
      // Position label at the tip of the arrow, offset to the side
      this.velocityLabel.visible = true;
      this.velocityLabel.x = LABEL_OFFSET_X;
      this.velocityLabel.centerY = velocityTipY;
    } else {
      this.velocityArrow.setTailAndTip(0, 0, 0, 0);
      this.velocityLabel.visible = false;
    }

    // Update acceleration arrow
    // Positive acceleration in model = upward = negative Y in view
    const accelerationPixels = acceleration * ACCELERATION_SCALE;
    const accelerationTipY = -accelerationPixels;
    if (Math.abs(accelerationPixels) > MIN_VECTOR_LENGTH) {
      this.accelerationArrow.setTailAndTip(0, 0, 0, accelerationTipY);
      // Position label at the tip of the arrow, offset to the side
      this.accelerationLabel.visible = true;
      this.accelerationLabel.x = LABEL_OFFSET_X;
      this.accelerationLabel.centerY = accelerationTipY;
    } else {
      this.accelerationArrow.setTailAndTip(0, 0, 0, 0);
      this.accelerationLabel.visible = false;
    }

    // Update applied force arrow
    // Positive force in model = upward = negative Y in view
    const forcePixels = appliedForce * FORCE_SCALE;
    const forceTipY = -forcePixels;
    if (Math.abs(forcePixels) > MIN_VECTOR_LENGTH) {
      this.appliedForceArrow.setTailAndTip(0, 0, 0, forceTipY);
      // Position label at the tip of the arrow, offset to the side
      this.appliedForceLabel.visible = true;
      this.appliedForceLabel.x = LABEL_OFFSET_X;
      this.appliedForceLabel.centerY = forceTipY;
    } else {
      this.appliedForceArrow.setTailAndTip(0, 0, 0, 0);
      this.appliedForceLabel.visible = false;
    }
  }

  /**
   * Set the position of this node (bottom of the mass in view coordinates).
   * Vectors originate from the bottom of the mass, which is the connection
   * point between the spring and mass.
   */
  public setMassBottom(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public override dispose(): void {
    this.multilink.dispose();
    super.dispose();
  }
}
