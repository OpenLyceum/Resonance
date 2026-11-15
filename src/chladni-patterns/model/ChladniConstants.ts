/**
 * ChladniConstants.ts
 *
 * Physics and configuration constants for the Chladni plate simulation.
 * Extracted from ChladniModel for better organization and reusability.
 */

// ============================================================================
// MATHEMATICAL CONSTANTS
// ============================================================================

export const TWO_PI = Math.PI * 2;

// ============================================================================
// PHYSICAL CONSTANTS
// ============================================================================

/**
 * Default physical plate dimensions in meters.
 * These affect wave number calculations and resonant frequencies.
 * For a rectangular plate, width (a) is along x-axis, height (b) is along y-axis.
 */
export const DEFAULT_PLATE_WIDTH = 0.32; // meters
export const DEFAULT_PLATE_HEIGHT = 0.32; // meters

/**
 * Plate size constraints
 */
const MIN_PLATE_SIZE_RATIO = 0.5;
export const MIN_PLATE_WIDTH = DEFAULT_PLATE_WIDTH * MIN_PLATE_SIZE_RATIO;
export const MIN_PLATE_HEIGHT = DEFAULT_PLATE_HEIGHT * MIN_PLATE_SIZE_RATIO;

/**
 * Damping coefficient for the plate vibration (dimensionless).
 * gamma = DAMPING_COEFFICIENT / sqrt(a * b)
 */
export const DAMPING_COEFFICIENT = 0.02;

// ============================================================================
// FREQUENCY PARAMETERS
// ============================================================================

export const FREQUENCY_MIN = 50;
export const FREQUENCY_MAX = 4000;
export const FREQUENCY_DEFAULT = 500;

/**
 * Frequency sweep rate (Hz per second).
 * Full range is 3950 Hz (50-4000) → ~60 second sweep at 66 Hz/s.
 */
export const SWEEP_RATE = 66;

// ============================================================================
// MODAL CALCULATION PARAMETERS
// ============================================================================

/**
 * Maximum mode number for modal superposition (m, n = 0, 1, 2, ..., MAX_MODE)
 */
export const MAX_MODE = 16;

/**
 * Mode step size for iterating through mode numbers.
 *
 * RATIONALE:
 * - MODE_STEP = 1: Include ALL modes (m, n = 0, 1, 2, 3, ...)
 *   Used for general excitation positions, including off-center excitation.
 *   Off-center excitation couples to both even and odd modes.
 *
 * - MODE_STEP = 2: Include only EVEN modes (m, n = 0, 2, 4, ...)
 *   Would be appropriate for center excitation only, where odd modes have
 *   zero amplitude due to symmetry (sin(mπ/2) = 0 for odd m at center).
 *   This optimization is NOT used because we support draggable excitation.
 *
 * PHYSICS:
 * For a rectangular plate with clamped edges, the mode shape is:
 *   φ_mn(x, y) = sin(mπx/a) × sin(nπy/b)
 *
 * At the center (x=a/2, y=b/2):
 *   φ_mn(a/2, b/2) = sin(mπ/2) × sin(nπ/2)
 *
 * This is zero when m or n is even, so only odd-odd modes contribute.
 * However, for off-center excitation, all modes may contribute.
 *
 * We use MODE_STEP = 1 to support the full range of excitation positions.
 */
export const MODE_STEP = 1;

/**
 * Threshold for skipping modes with negligible source contribution.
 *
 * RATIONALE:
 * When summing modal contributions, modes where the excitation position
 * coincides with (or is very close to) a nodal line contribute negligibly.
 * The source term is proportional to φ_mn(x_exc, y_exc).
 *
 * VALUE SELECTION:
 * - 0.001 (0.1%) provides a good balance:
 *   - Skips modes that contribute < 0.1% of maximum possible amplitude
 *   - Reduces computation by ~20-40% for typical off-center positions
 *   - Has negligible visual impact (< 0.1% error in displacement field)
 *
 * - Lower values (e.g., 0.0001) would include more modes but slow computation
 * - Higher values (e.g., 0.01) would be faster but may show visible artifacts
 *
 * The squared version avoids a sqrt() call in the hot path:
 *   if (source² < SOURCE_THRESHOLD²) skip mode
 * is equivalent to:
 *   if (|source| < SOURCE_THRESHOLD) skip mode
 */
export const SOURCE_THRESHOLD = 0.001;
export const SOURCE_THRESHOLD_SQUARED = SOURCE_THRESHOLD * SOURCE_THRESHOLD;

/**
 * Normalization factor for rectangular plate mode shapes: (2/√(ab))² = 4/(ab)
 */
export const NORMALIZATION_NUMERATOR = 4;

// ============================================================================
// PARTICLE ANIMATION PARAMETERS
// ============================================================================

/**
 * Scale factor for particle step size, tuned to match Roussel's pixel-based behavior.
 * Roussel: 5*psi pixels on ~480px plate ≈ 0.01*psi fraction of plate
 * Here: PARTICLE_STEP_SCALE * psi * STEP_TIME_SCALE meters on 0.32m plate
 */
export const PARTICLE_STEP_SCALE = 0.3;

/**
 * Time scaling factor for step size calculation
 */
export const STEP_TIME_SCALE = 0.01;

/**
 * Target frame rate for normalizing time-based calculations
 */
export const TARGET_FPS = 60;

// ============================================================================
// EXCITATION PARAMETERS
// ============================================================================

/**
 * Default excitation position (center of plate, in model coordinates).
 * Model uses centered coordinates: (0,0) is at plate center.
 */
export const DEFAULT_EXCITATION_X = 0;
export const DEFAULT_EXCITATION_Y = 0;

// ============================================================================
// RESONANCE CURVE GRAPH PARAMETERS
// ============================================================================

/**
 * Width of the visible window in the resonance curve graph (Hz)
 */
export const GRAPH_WINDOW_WIDTH = 500;

/**
 * Precomputed resonance curve resolution (samples per Hz)
 */
export const CURVE_SAMPLES_PER_HZ = 4;
export const TOTAL_CURVE_SAMPLES = (FREQUENCY_MAX - FREQUENCY_MIN) * CURVE_SAMPLES_PER_HZ;

// ============================================================================
// GRAIN COUNT OPTIONS
// ============================================================================

/**
 * Boundary handling mode: how particles behave at plate edges
 */
export type BoundaryMode = "clamp" | "remove";

/**
 * Default boundary handling mode
 */
export const DEFAULT_BOUNDARY_MODE: BoundaryMode = "clamp";

/**
 * Grain count option type for combo box
 */
export type GrainCountOption = {
  readonly value: number;
  readonly name: string;
};

/**
 * Available grain count options
 */
export const GRAIN_COUNT_OPTIONS: readonly GrainCountOption[] = [
  { value: 1000, name: "1000" },
  { value: 5000, name: "5000" },
  { value: 10000, name: "10000" },
  { value: 25000, name: "25000" },
] as const;

/**
 * Default grain count index in GRAIN_COUNT_OPTIONS array
 */
const DEFAULT_GRAIN_COUNT_INDEX = 2; // 10,000
export const DEFAULT_GRAIN_COUNT = GRAIN_COUNT_OPTIONS[DEFAULT_GRAIN_COUNT_INDEX]!;
