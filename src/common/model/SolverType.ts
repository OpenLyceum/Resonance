import type { ReadOnlyProperty } from "scenerystack/axon";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";

/**
 * Available ODE solver types
 */
export const SolverType = {
  RUNGE_KUTTA_4: "rk4",
  ADAPTIVE_RK45: "adaptiveRK45",
  ANALYTICAL: "analytical",
} as const;

export type SolverType = (typeof SolverType)[keyof typeof SolverType];

/**
 * Human-readable names for solver types (localized)
 * @unused Not referenced in production code; only used in tests.
 * @internal Exported for unit tests; not part of the application API.
 */
export const SolverTypeName: Record<SolverType, ReadOnlyProperty<string>> = {
  [SolverType.RUNGE_KUTTA_4]: ResonanceStrings.common.solverNames.solverRK4StringProperty,
  [SolverType.ADAPTIVE_RK45]: ResonanceStrings.common.solverNames.solverAdaptiveRK45StringProperty,
  [SolverType.ANALYTICAL]: ResonanceStrings.common.solverNames.solverAnalyticalStringProperty,
};

/**
 * Human-readable descriptions for solver types (localized)
 * @unused Not referenced in production code; only used in tests.
 * @internal Exported for unit tests; not part of the application API.
 */
export const SolverTypeDescription: Record<SolverType, ReadOnlyProperty<string>> = {
  [SolverType.RUNGE_KUTTA_4]: ResonanceStrings.preferences.solvers.rk4DescriptionStringProperty,
  [SolverType.ADAPTIVE_RK45]: ResonanceStrings.preferences.solvers.adaptiveRK45DescriptionStringProperty,
  [SolverType.ANALYTICAL]: ResonanceStrings.preferences.solvers.analyticalDescriptionStringProperty,
};
