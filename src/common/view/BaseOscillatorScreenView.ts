/**
 * BaseOscillatorScreenView is the shared view for oscillator-based screens.
 * It provides the common UI elements for:
 * - Single Oscillator
 * - Multiple Oscillators
 * - Phase Analysis
 *
 * This includes:
 * - Driver plate and connection rod
 * - Measurement lines
 * - Resonators (springs + masses)
 * - Control panel
 * - Reset button
 * - Playback controls
 * - Ruler
 * - Trace mode (strip-chart recording of mass motion)
 */

import { Property } from "scenerystack/axon";
import { Bounds2, Vector2, Vector2Property } from "scenerystack/dot";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { ModelViewTransform2, StringUtils } from "scenerystack/phetcommon";
import { Line, Node, Rectangle, RichDragListener, Text } from "scenerystack/scenery";
import { type ParametricSpringNode, ResetAllButton, RulerNode } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { Checkbox } from "scenerystack/sun";
import { Utterance } from "scenerystack/utterance-queue";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import ResonanceColors from "../../ResonanceColors.js";
import ResonanceConstants from "../../ResonanceConstants.js";
import type { BaseOscillatorScreenModel } from "../model/BaseOscillatorScreenModel.js";
import { TraceDataModel } from "../model/TraceDataModel.js";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../ResonanceButtonOptions.js";
import { utteranceQueue } from "../util/utteranceQueue.js";
import { ConfigurableGraph } from "./graph/ConfigurableGraph.js";
import type { PlottableProperty } from "./graph/PlottableProperty.js";
import { OscillatorControlPanel, type OscillatorControlPanelOptions } from "./OscillatorControlPanel.js";
import { OscillatorDriverControlNode } from "./OscillatorDriverControlNode.js";
import { OscillatorGridNode } from "./OscillatorGridNode.js";
import { OscillatorMeasurementLinesNode } from "./OscillatorMeasurementLinesNode.js";
import { OscillatorPlaybackControlNode } from "./OscillatorPlaybackControlNode.js";
import { OscillatorResonatorNodeBuilder } from "./OscillatorResonatorNodeBuilder.js";
import { OscillatorScreenSummaryContent } from "./OscillatorScreenSummaryContent.js";
import { OscillatorTraceNode } from "./OscillatorTraceNode.js";

// ===== Layout and grid constants =====
const GRID_MAJOR_SPACING = 0.05; // 5 cm between major grid lines (model meters)
const GRID_MINOR_DIVISIONS_PER_MAJOR = 5; // 1 cm minor grid lines
const GRID_WIDTH = 550; // grid width in view pixels
const GRID_TOP_MODEL = 0.3; // 30 cm above equilibrium (model meters)
const GRID_BOTTOM_MODEL = -0.25; // 25 cm below equilibrium (model meters)

// ===== Connection rod constants =====
const CONNECTION_ROD_OVERLAP = 0.02; // 2 cm overlap into driver box (model meters)
const CONNECTION_ROD_MARKER_LINE_WIDTH = 3;
const CONNECTION_ROD_MARKER_REST_FRACTION = 0.35; // marker positioned ~1/3 down the rod at rest

// ===== Rod / plate view constraints =====
const MIN_ROD_HEIGHT_VIEW = 10; // minimum rod height in view pixels

// ===== Ruler drag constants =====
const RULER_DRAG_MARGIN = 20; // keep at least this many pixels visible on each edge
const RULER_KEYBOARD_DRAG_SPEED = 150; // pixels per second
const RULER_KEYBOARD_SHIFT_DRAG_SPEED = 50; // slower with shift key

// ===== Graph checkbox constants =====
const GRAPH_CHECKBOX_BOX_WIDTH = 14;
const GRAPH_CHECKBOX_SPACING = 6;

export type BaseOscillatorScreenViewOptions = ScreenViewOptions;

export class BaseOscillatorScreenView extends ScreenView {
  protected readonly model: BaseOscillatorScreenModel;
  protected readonly modelViewTransform: ModelViewTransform2;
  protected readonly resonatorsContainer: Node;
  protected springNodes: ParametricSpringNode[] = [];
  protected massNodes: Node[] = [];
  protected readonly rulerNode: RulerNode;
  protected readonly rulerVisibleProperty: Property<boolean>;
  protected readonly rulerPositionProperty: Vector2Property;
  protected readonly gridNode: OscillatorGridNode;
  protected readonly gridVisibleProperty: Property<boolean>;
  protected readonly measurementLinesNode: OscillatorMeasurementLinesNode;
  protected readonly controlPanel: OscillatorControlPanel;
  protected readonly driverNode: OscillatorDriverControlNode;
  protected driverPlate!: Rectangle;
  protected connectionRod!: Rectangle;
  protected connectionRodMarker!: Line;
  protected readonly traceDataModel: TraceDataModel;
  protected readonly traceNode: OscillatorTraceNode;

  public constructor(model: BaseOscillatorScreenModel, providedOptions?: BaseOscillatorScreenViewOptions) {
    // Register the accessible screen summary (Interactive Description). Shared by
    // the oscillator-based screens; current details are derived live from the model.
    const options = optionize<BaseOscillatorScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new OscillatorScreenSummaryContent(model),
      },
      providedOptions,
    );
    super(options);

    this.model = model;

    // Initialize ModelViewTransform with isometric scaling and inverted Y axis
    // Model origin (0, 0) = equilibrium position of single mass
    // Positive Y in model = upward on screen (natural physics convention)
    this.modelViewTransform = ModelViewTransform2.createSinglePointScaleInvertedYMapping(
      new Vector2(0, 0), // Model equilibrium point
      new Vector2(ResonanceConstants.EQUILIBRIUM_VIEW_X, ResonanceConstants.EQUILIBRIUM_VIEW_Y), // View equilibrium point
      ResonanceConstants.MODEL_VIEW_SCALE, // pixels per meter (isometric)
    );

    // Initialize ruler properties
    this.rulerVisibleProperty = new Property<boolean>(false);
    const initialViewX = this.layoutBounds.left + ResonanceConstants.RULER_LEFT_MARGIN;
    const initialViewY = this.layoutBounds.top + ResonanceConstants.RULER_TOP_MARGIN;
    const initialModelX = this.modelViewTransform.viewToModelX(initialViewX);
    const initialModelY = this.modelViewTransform.viewToModelY(initialViewY);
    this.rulerPositionProperty = new Vector2Property(new Vector2(initialModelX, initialModelY));

    // Initialize grid properties
    this.gridVisibleProperty = new Property<boolean>(false);

    // Initialize trace data model
    this.traceDataModel = new TraceDataModel();

    // Create simulation area container
    const simulationArea = new Node();

    // ===== DRIVER CONTROL BOX =====
    // Position driver box using model coordinates so the driver plate, connection rod,
    // and driver box are all positioned consistently through the model-view transform
    this.driverNode = new OscillatorDriverControlNode(model);
    this.driverNode.centerX = this.layoutBounds.centerX + ResonanceConstants.DRIVER_CENTER_X_OFFSET;
    // Position driver box top using model Y coordinate
    const driverBoxTopViewY = this.modelViewTransform.modelToViewY(ResonanceConstants.DRIVER_BOX_TOP_MODEL_Y);
    this.driverNode.top = driverBoxTopViewY;

    // ===== GRID =====
    // Added FIRST to be behind everything else
    this.gridNode = new OscillatorGridNode(this.modelViewTransform, this.layoutBounds, {
      majorSpacing: GRID_MAJOR_SPACING,
      minorDivisionsPerMajor: GRID_MINOR_DIVISIONS_PER_MAJOR,
      gridWidth: GRID_WIDTH,
      gridTopModel: GRID_TOP_MODEL,
      gridBottomModel: GRID_BOTTOM_MODEL,
      gridCenterX: this.driverNode.centerX,
    });
    this.gridNode.visible = false;
    simulationArea.addChild(this.gridNode);

    // ===== TRACE NODE =====
    // The trace node contains its own scrolling grid and the trace line.
    // It sits at the same layer as the static grid and replaces it when trace is active.
    const gridTopModel = GRID_TOP_MODEL;
    const gridBottomModel = GRID_BOTTOM_MODEL;
    const gridWidth = GRID_WIDTH;

    this.traceNode = new OscillatorTraceNode(this.modelViewTransform, this.traceDataModel, this.layoutBounds, {
      penViewX: this.driverNode.centerX,
      gridWidth: gridWidth,
      gridTopModel: gridTopModel,
      gridBottomModel: gridBottomModel,
      gridCenterX: this.driverNode.centerX,
      timeSpeedProperty: model.resonanceModel.timeSpeedProperty,
    });
    this.traceNode.visible = false;
    simulationArea.addChild(this.traceNode);

    // ===== CONNECTION ROD (behind driver box) =====
    // Add the rod BEFORE the driver box so the box covers its bottom
    this.createConnectionRod(simulationArea);

    // Now add the driver node (on top of rod, covers rod bottom)
    simulationArea.addChild(this.driverNode);

    // ===== DRIVER PLATE & MARKER =====
    this.createDriverPlateAndMarker(simulationArea);

    // ===== MEASUREMENT LINES =====
    // Must be created before resonators since measurement lines appear behind them
    this.measurementLinesNode = new OscillatorMeasurementLinesNode(
      this.driverPlate.centerX,
      ResonanceConstants.DRIVER_BOX_WIDTH,
      this.modelViewTransform,
    );
    this.measurementLinesNode.visible = false;
    simulationArea.addChild(this.measurementLinesNode);

    // ===== RESONATORS (springs + masses) =====
    // Create all resonator nodes once - visibility controlled by count
    this.resonatorsContainer = new Node();
    simulationArea.addChild(this.resonatorsContainer);
    this.createAllResonators();

    // Update visibility when resonator count changes
    model.resonatorCountProperty.link((count: number) => {
      this.updateResonatorVisibility(count);
      this.updateSpringAndMass();
    });

    this.addChild(simulationArea);

    // ===== CONTROL PANEL (right side) =====
    this.controlPanel = new OscillatorControlPanel(
      model,
      this.layoutBounds,
      this.rulerVisibleProperty,
      this.gridVisibleProperty,
      this.traceDataModel.traceEnabledProperty,
      {
        singleOscillatorMode: model.singleOscillatorMode,
        ...this.getControlPanelOptions(),
      },
    );
    this.addChild(this.controlPanel);
    this.addChild(this.controlPanel.comboBoxListParent);
    this.addChild(this.controlPanel.presetComboBoxListParent);

    // ===== RESET ALL BUTTON =====
    const resetAllButton = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      listener: () => {
        model.reset();
        this.reset();
        this.controlPanel.gravityEnabledProperty.value = model.resonanceModel.gravityProperty.value > 0;
      },
      right: this.layoutBounds.maxX - ResonanceConstants.RESET_ALL_RIGHT_MARGIN,
      bottom: this.layoutBounds.maxY - ResonanceConstants.RESET_ALL_BOTTOM_MARGIN,
    });
    this.addChild(resetAllButton);

    // ===== PLAYBACK CONTROLS =====
    const playbackControls = new OscillatorPlaybackControlNode(model, this.layoutBounds);
    this.addChild(playbackControls);

    // ===== RULER =====
    // Added last so it appears on top of control panel and playback controls when dragged
    this.rulerNode = this.createRulerNode();
    this.addChild(this.rulerNode);

    // Update ruler and measurement lines visibility from the shared property
    this.rulerVisibleProperty.link((visible: boolean) => {
      this.rulerNode.visible = visible;
      this.measurementLinesNode.visible = visible;
    });

    // Update grid and trace visibility.
    // When trace is enabled, the static grid is hidden and replaced by
    // the scrolling trace node. When trace is disabled, the static grid
    // is restored.
    const updateGridTraceVisibility = () => {
      const gridOn = this.gridVisibleProperty.value;
      const traceOn = this.traceDataModel.traceEnabledProperty.value;

      if (gridOn && traceOn) {
        // Trace active: show trace node, hide static grid
        this.gridNode.visible = false;
        this.traceNode.visible = true;
      } else if (gridOn) {
        // Grid only: show static grid, hide trace
        this.gridNode.visible = true;
        this.traceNode.visible = false;
      } else {
        // Everything off
        this.gridNode.visible = false;
        this.traceNode.visible = false;
      }
    };

    this.gridVisibleProperty.link(updateGridTraceVisibility);
    this.traceDataModel.traceEnabledProperty.link((traceOn: boolean) => {
      updateGridTraceVisibility();
      // Clear old trace data when trace mode is toggled on
      if (traceOn) {
        this.traceNode.clear();
      }
    });

    // Set up accessibility alerts
    this.setupAccessibilityAlerts();

    // ── Accessibility: keyboard / reading traversal order ───────────────────────
    // Deterministic Tab/reading order: the resonators (draggable masses) and
    // driver first, then the control panel and playback controls, the ruler, and
    // Reset All last. ScreenView throws if you set pdomOrder on itself, so use a
    // wrapper Node.
    this.addChild(
      new Node({
        pdomOrder: [
          this.resonatorsContainer,
          this.driverNode,
          this.controlPanel,
          playbackControls,
          this.rulerNode,
          resetAllButton,
        ],
      }),
    );

    // Initial spring/mass update
    this.updateSpringAndMass();
  }

  /**
   * Set up screen reader alerts for important state changes.
   */
  protected setupAccessibilityAlerts(): void {
    const alerts = ResonanceStrings.a11y.alerts;

    // Announce play/pause state changes
    this.model.isPlayingProperty.lazyLink((isPlaying: boolean) => {
      const alertString = isPlaying
        ? alerts.simulationPlayingStringProperty.value
        : alerts.simulationPausedStringProperty.value;
      utteranceQueue.addToBack(
        new Utterance({
          alert: alertString,
          priority: Utterance.LOW_PRIORITY,
        }),
      );
    });

    // Announce gravity toggle
    this.model.resonanceModel.gravityProperty.lazyLink((gravity: number) => {
      const alertString = gravity > 0 ? alerts.gravityOnStringProperty.value : alerts.gravityOffStringProperty.value;
      utteranceQueue.addToBack(
        new Utterance({
          alert: alertString,
          priority: Utterance.LOW_PRIORITY,
        }),
      );
    });

    // Announce resonator count changes (only for multi-oscillator screens)
    if (!this.model.singleOscillatorMode) {
      this.model.resonatorCountProperty.lazyLink((count: number) => {
        const alertString = StringUtils.fillIn(alerts.resonatorCountStringProperty, { count: count });
        utteranceQueue.addToBack(
          new Utterance({
            alert: alertString,
            priority: Utterance.LOW_PRIORITY,
          }),
        );
      });
    }
  }

  /**
   * Create the connection rod (added before driver box so box covers its bottom).
   * Uses model coordinates for positioning to stay connected with driver plate and box.
   */
  protected createConnectionRod(simulationArea: Node): void {
    const rodWidth = ResonanceConstants.CONNECTION_ROD_WIDTH;

    // Calculate rod position using model coordinates
    // Rod top: bottom of driver plate (plate top + plate height in model)
    const rodTopModelY = ResonanceConstants.DRIVER_PLATE_REST_MODEL_Y - ResonanceConstants.DRIVER_PLATE_HEIGHT_MODEL;
    // Rod bottom: top of driver box (with overlap so box covers it)
    const rodBottomModelY = ResonanceConstants.DRIVER_BOX_TOP_MODEL_Y - CONNECTION_ROD_OVERLAP; // 2cm overlap into box

    // Convert to view coordinates
    const rodTopViewY = this.modelViewTransform.modelToViewY(rodTopModelY);
    const rodBottomViewY = this.modelViewTransform.modelToViewY(rodBottomModelY);
    const rodHeightView = rodBottomViewY - rodTopViewY;

    // Connection rod between control box and plate (rectangle with no corner radius)
    this.connectionRod = new Rectangle(0, 0, rodWidth, rodHeightView, {
      fill: ResonanceColors.driverFillProperty,
      stroke: ResonanceColors.driverStrokeProperty,
      lineWidth: ResonanceConstants.DRIVER_BOX_LINE_WIDTH,
    });
    this.connectionRod.centerX = this.driverNode.centerX;
    this.connectionRod.top = rodTopViewY;
    simulationArea.addChild(this.connectionRod);
  }

  /**
   * Create the driver plate and marker line (added after driver box).
   * Uses model coordinates for positioning to stay connected with the system.
   */
  protected createDriverPlateAndMarker(simulationArea: Node): void {
    const driverPlateWidth = ResonanceConstants.DRIVER_BOX_WIDTH;
    const rodWidth = ResonanceConstants.CONNECTION_ROD_WIDTH;

    // Calculate plate position using model coordinates
    const plateTopViewY = this.modelViewTransform.modelToViewY(ResonanceConstants.DRIVER_PLATE_REST_MODEL_Y);
    const plateHeightView = Math.abs(
      this.modelViewTransform.modelToViewDeltaY(ResonanceConstants.DRIVER_PLATE_HEIGHT_MODEL),
    );

    // Marker line across the connection rod - moves with driver plate to show motion
    // Use a contrasting dark color so it's visible against the gray rod
    this.connectionRodMarker = new Line(-rodWidth / 2, 0, rodWidth / 2, 0, {
      stroke: ResonanceColors.connectionRodMarkerProperty,
      lineWidth: CONNECTION_ROD_MARKER_LINE_WIDTH,
      lineCap: "round",
    });
    this.connectionRodMarker.x = this.driverNode.centerX;
    simulationArea.addChild(this.connectionRodMarker);

    // Driver plate - positioned using model coordinates
    this.driverPlate = new Rectangle(0, 0, driverPlateWidth, plateHeightView, {
      fill: ResonanceColors.driverFillProperty,
      stroke: ResonanceColors.driverStrokeProperty,
      lineWidth: ResonanceConstants.DRIVER_BOX_LINE_WIDTH,
      cornerRadius: ResonanceConstants.DRIVER_PLATE_CORNER_RADIUS,
    });
    this.driverPlate.centerX = this.driverNode.centerX;
    this.driverPlate.y = plateTopViewY;
    simulationArea.addChild(this.driverPlate);
  }

  /**
   * Create and configure the ruler node with drag handling.
   * The ruler uses model-based dimensions converted to view coordinates.
   */
  protected createRulerNode(): RulerNode {
    // Generate labels: 0, 5, 10, 15, ..., 50 (cm)
    const rulerLabels: string[] = [];
    for (let i = 0; i < ResonanceConstants.RULER_NUM_MAJOR_TICKS; i++) {
      rulerLabels.push(String(i * 5));
    }

    // Convert ruler length from model (meters) to view pixels
    const rulerLengthView = Math.abs(this.modelViewTransform.modelToViewDeltaY(ResonanceConstants.RULER_LENGTH_MODEL));

    // Major tick spacing: ruler length / (num ticks - 1)
    const majorTickWidth = rulerLengthView / (ResonanceConstants.RULER_NUM_MAJOR_TICKS - 1);

    const rulerNode = new RulerNode(
      rulerLengthView,
      ResonanceConstants.RULER_THICKNESS_VIEW,
      majorTickWidth,
      rulerLabels,
      ResonanceStrings.units.cmStringProperty.value,
      {
        minorTicksPerMajorTick: ResonanceConstants.RULER_MINOR_TICKS_PER_MAJOR,
        insetsWidth: ResonanceConstants.RULER_INSETS_WIDTH,
      },
    );

    rulerNode.rotation = -Math.PI / 2;

    // Position from model coordinates
    this.rulerPositionProperty.link((modelPosition: Vector2) => {
      const viewX = this.modelViewTransform.modelToViewX(modelPosition.x);
      const viewY = this.modelViewTransform.modelToViewY(modelPosition.y);
      rulerNode.centerX = viewX;
      rulerNode.centerY = viewY;
    });

    rulerNode.visible = false;

    // Drag handling - keep ruler within visible bounds so it's always grabbable
    // The ruler is rotated, so its "width" in view is actually its thickness,
    // and its "height" in view is its length
    const margin = RULER_DRAG_MARGIN;
    const rulerThickness = ResonanceConstants.RULER_THICKNESS_VIEW;

    const dragBounds = new Bounds2(
      this.layoutBounds.minX + margin,
      this.layoutBounds.minY + rulerLengthView / 2 + margin,
      this.layoutBounds.maxX - rulerThickness - margin,
      this.layoutBounds.maxY - rulerLengthView / 2 - margin,
    );

    // Convert to model bounds for the drag listener
    const dragBoundsModel = this.modelViewTransform.viewToModelBounds(dragBounds);

    rulerNode.addInputListener(
      new RichDragListener({
        positionProperty: this.rulerPositionProperty,
        transform: this.modelViewTransform,
        dragBoundsProperty: new Property(dragBoundsModel),
        dragListenerOptions: {
          targetNode: rulerNode,
          useParentOffset: true,
        },
        keyboardDragListenerOptions: {
          dragSpeed: RULER_KEYBOARD_DRAG_SPEED,
          shiftDragSpeed: RULER_KEYBOARD_SHIFT_DRAG_SPEED,
        },
      }),
    );
    rulerNode.cursor = "move";

    // Make focusable for keyboard navigation
    rulerNode.tagName = "div";
    rulerNode.focusable = true;
    rulerNode.accessibleName = ResonanceStrings.a11y.rulerAccessibleNameStringProperty;

    return rulerNode;
  }

  /**
   * Create all resonator nodes (springs + masses) once at startup.
   * All MAX_RESONATORS are created; visibility is controlled by count.
   */
  protected createAllResonators(): void {
    const context = {
      modelViewTransform: this.modelViewTransform,
      layoutBounds: this.layoutBounds,
      selectedResonatorIndexProperty: this.model.selectedResonatorIndexProperty,
    };

    const result = OscillatorResonatorNodeBuilder.buildResonators(this.model.resonatorModels, context);

    this.springNodes = result.springNodes;
    this.massNodes = result.massNodes;

    // Add all nodes to container
    for (const springNode of this.springNodes) {
      this.resonatorsContainer.addChild(springNode);
    }
    for (const massNode of this.massNodes) {
      this.resonatorsContainer.addChild(massNode);
    }

    // Set initial visibility based on current count
    this.updateResonatorVisibility(this.model.resonatorCountProperty.value);
  }

  /**
   * Update visibility of resonator nodes based on the current count.
   */
  protected updateResonatorVisibility(count: number): void {
    for (let i = 0; i < this.springNodes.length; i++) {
      const visible = i < count;
      this.springNodes[i]!.visible = visible;
      this.massNodes[i]!.visible = visible;
    }
  }

  /**
   * Update spring and mass positions each frame.
   *
   * Model coordinate system:
   * - Y = 0 at equilibrium (mass at rest position)
   * - Positive Y = upward
   * - Driver plate top at Y = -naturalLength (at rest), oscillates around that
   * - Mass position = positionProperty.value (displacement from equilibrium)
   *
   * With isometric modelViewTransform:
   * - modelViewTransform.modelToViewY(modelY) gives exact view position
   * - No manual equilibrium offset calculations needed
   */
  protected updateSpringAndMass(): void {
    const count = this.model.resonatorCountProperty.value;
    if (count === 0) {
      return;
    }

    // Get driver model parameters
    const driverModel = this.model.resonanceModel;
    const phase = driverModel.drivingPhaseProperty.value;
    const drivingAmplitude = driverModel.drivingAmplitudeProperty.value;
    const naturalLength = driverModel.naturalLengthProperty.value;

    // Driver plate top position in model coordinates
    // At rest: Y = -naturalLength (e.g., -0.2m = -20cm below equilibrium)
    // When oscillating: Y = -naturalLength + A*sin(phase)
    let driverTopModelY = -naturalLength;
    if (driverModel.drivingEnabledProperty.value) {
      driverTopModelY += drivingAmplitude * Math.sin(phase);
    }

    // Convert driver plate top from model to view using transform directly
    const driverTopViewY = this.modelViewTransform.modelToViewY(driverTopModelY);

    // Position driver plate (its .y property is its top edge)
    this.driverPlate.y = driverTopViewY;

    // Calculate plate bottom in model and view coordinates
    const plateBottomModelY = driverTopModelY - ResonanceConstants.DRIVER_PLATE_HEIGHT_MODEL;
    const plateBottomViewY = this.modelViewTransform.modelToViewY(plateBottomModelY);

    // Update connection rod to stretch/compress with driver movement
    // Rod connects plate bottom to driver box top (using model coordinates)
    const rodBottomModelY = ResonanceConstants.DRIVER_BOX_TOP_MODEL_Y - CONNECTION_ROD_OVERLAP; // 2cm overlap
    const rodBottomViewY = this.modelViewTransform.modelToViewY(rodBottomModelY);
    const rodHeight = Math.max(MIN_ROD_HEIGHT_VIEW, rodBottomViewY - plateBottomViewY);

    // Position marker line about 1/3 down the rod at rest, moves with plate
    const restPlateBottomViewY = this.modelViewTransform.modelToViewY(
      -naturalLength - ResonanceConstants.DRIVER_PLATE_HEIGHT_MODEL,
    );
    const restRodHeight = rodBottomViewY - restPlateBottomViewY;
    const markerRestY = restPlateBottomViewY + restRodHeight * CONNECTION_ROD_MARKER_REST_FRACTION;

    // Add the plate displacement to the marker rest position
    const plateDisplacementView = plateBottomViewY - restPlateBottomViewY;
    this.connectionRodMarker.y = markerRestY + plateDisplacementView;

    this.connectionRod.setRect(0, 0, ResonanceConstants.CONNECTION_ROD_WIDTH, rodHeight);
    this.connectionRod.top = plateBottomViewY;

    // Position springs and masses
    const driverCenterX = this.driverPlate.centerX;
    const spacing = ResonanceConstants.DRIVER_BOX_WIDTH / (count + 1);

    // Spring stem lengths in view coordinates (use modelToViewDeltaY for lengths)
    const leftEndLengthView = Math.abs(
      this.modelViewTransform.modelToViewDeltaY(ResonanceConstants.SPRING_LEFT_END_LENGTH_MODEL),
    );
    const rightEndLengthView = Math.abs(
      this.modelViewTransform.modelToViewDeltaY(ResonanceConstants.SPRING_RIGHT_END_LENGTH_MODEL),
    );
    const endLengths = leftEndLengthView + rightEndLengthView;

    for (let i = 0; i < count; i++) {
      const xCenter = driverCenterX - ResonanceConstants.DRIVER_BOX_WIDTH / 2 + spacing * (i + 1);

      const resonatorModel = this.model.getResonatorModel(i);

      // Mass position is directly the displacement from equilibrium (Y=0 in model)
      const massModelY = resonatorModel.positionProperty.value;

      // Spring length = distance from driver top to mass bottom (both in model coordinates)
      const springLengthModel = massModelY - driverTopModelY;

      // Convert mass position to view using transform directly
      const massBottomViewY = this.modelViewTransform.modelToViewY(massModelY);

      // Position mass node (local origin is at bottom of mass box)
      this.massNodes[i]!.x = xCenter;
      this.massNodes[i]!.y = massBottomViewY;

      // Configure spring
      const springNode = this.springNodes[i]!;
      const loopsTimesRadius = ResonanceConstants.SPRING_LOOPS * ResonanceConstants.SPRING_RADIUS;

      // Spring length in view - use absolute value for rendering
      const springLengthView = Math.abs(springLengthModel) * ResonanceConstants.MODEL_VIEW_SCALE;

      // Calculate xScale to make spring coils fill the visual distance
      // With phase=π, the ParametricSpringNode total length is:
      //   totalLength = leftEndLength + xScale × loops × radius + rightEndLength
      // So: xScale = (springLengthView - endLengths) / (loops × radius)
      const xScale = Math.max(ResonanceConstants.MIN_SPRING_XSCALE, (springLengthView - endLengths) / loopsTimesRadius);

      springNode.xScaleProperty.value = xScale;

      // Position spring to connect driver plate top to mass bottom
      // Normal case: mass above driver, spring extends upward (rotation -90°)
      // Abnormal case: mass below driver, spring extends downward (rotation +90°)
      //
      // ParametricSpringNode origin is at "left center" - with -90° rotation:
      // - The origin becomes the bottom of the spring (at driver plate)
      // - The spring extends upward to the mass
      // No offset needed - the origin should be at the driver plate top
      const massAboveDriver = springLengthModel > 0;
      springNode.rotation = massAboveDriver ? -Math.PI / 2 : Math.PI / 2;
      springNode.x = xCenter;
      springNode.y = driverTopViewY;
    }
  }

  public reset(): void {
    this.rulerVisibleProperty.reset();
    this.rulerPositionProperty.reset();
    this.gridVisibleProperty.reset();
    this.traceDataModel.reset();
    this.traceNode.reset();
    this.measurementLinesNode.reset();
    this.controlPanel.reset();
  }

  /**
   * Override in subclasses to provide additional control panel options.
   * For example, to hide the trace checkbox, return { showTrace: false }.
   */
  protected getControlPanelOptions(): Partial<OscillatorControlPanelOptions> {
    return {};
  }

  public override step(dt: number): void {
    // Note: model.step(dt) is called by the Screen base class, not here
    // to avoid double-stepping

    // Update the visual representation
    this.updateSpringAndMass();

    // Record trace data and update the trace visualization
    if (this.traceDataModel.traceEnabledProperty.value && this.model.isPlayingProperty.value) {
      // Record the position of the first (selected) resonator
      const selectedIndex = this.model.selectedResonatorIndexProperty.value;
      const position = this.model.getResonatorModel(selectedIndex).positionProperty.value;
      // Pass current scroll offset so points maintain position when speed changes
      this.traceDataModel.addPoint(this.traceNode.getScrollOffset(), position);
    }

    // Step the trace node only when playing (grid stops when paused)
    if (this.traceDataModel.traceEnabledProperty.value && this.model.isPlayingProperty.value) {
      this.traceNode.step(dt);
    }
  }

  /**
   * Create a ConfigurableGraph with its visibility checkbox and combo box list parent.
   * Handles the common wiring: visibility-to-subStepCollection link, child addition.
   * Callers are responsible for positioning the returned elements.
   */
  protected createConfigurableGraphSetup(options: {
    plottableProperties: PlottableProperty[];
    initialXIndex: number;
    initialYIndex: number;
    graphWidth: number;
    graphHeight: number;
    maxDataPoints?: number;
    initiallyVisible?: boolean;
  }): {
    graph: ConfigurableGraph;
    checkbox: Checkbox;
    comboBoxListParent: Node;
  } {
    const {
      plottableProperties,
      initialXIndex,
      initialYIndex,
      graphWidth,
      graphHeight,
      maxDataPoints = 2000,
      initiallyVisible = false,
    } = options;

    const initialXProperty = plottableProperties[initialXIndex]!;
    const initialYProperty = plottableProperties[initialYIndex]!;

    const comboBoxListParent = new Node();

    const graph = new ConfigurableGraph(
      plottableProperties,
      initialXProperty,
      initialYProperty,
      graphWidth,
      graphHeight,
      comboBoxListParent,
      maxDataPoints,
    );

    if (initiallyVisible) {
      graph.getGraphVisibleProperty().value = true;
    }

    const checkboxLabel = new Text(ResonanceStrings.controls.graphStringProperty, {
      font: ResonanceConstants.CONTROL_FONT,
      fill: ResonanceColors.textProperty,
    });
    const checkbox = new Checkbox(graph.getGraphVisibleProperty(), checkboxLabel, {
      boxWidth: GRAPH_CHECKBOX_BOX_WIDTH,
      checkboxColor: ResonanceColors.textProperty,
      checkboxColorBackground: ResonanceColors.panelFillProperty,
      spacing: GRAPH_CHECKBOX_SPACING,
    });

    this.addChild(checkbox);
    this.addChild(graph);
    this.addChild(comboBoxListParent);

    // Enable sub-step data collection only when graph is visible (performance optimization)
    graph.getGraphVisibleProperty().link((visible) => {
      this.model.resonanceModel.subStepCollectionEnabled = visible;
    });

    return { graph, checkbox, comboBoxListParent };
  }

  /**
   * Feed sub-step (or single-point) data to a ConfigurableGraph during simulation step.
   * Call this from subclass step() methods.
   */
  protected stepConfigurableGraph(graph: ConfigurableGraph): void {
    if (this.model.isPlayingProperty.value) {
      const resonanceModel = this.model.resonanceModel;
      if (resonanceModel.hasSubStepData()) {
        const subStepData = resonanceModel.flushSubStepData();
        graph.addDataPointsFromSubSteps(subStepData);
      } else {
        graph.addDataPoint();
      }
    }
  }
}
