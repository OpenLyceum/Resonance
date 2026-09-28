/**
 * resonanceQueryParameters.ts
 *
 * Sim-specific startup query parameters. This is the single place where every
 * sim-specific query parameter is declared and documented. Public-facing
 * parameters (intended for end users / sharing links) must set `public: true`.
 *
 * ── How to add a query parameter ──────────────────────────────────────────────
 * 1. Add an entry below with a `type`, `defaultValue`, and (if user-facing)
 *    `public: true`. Add `isValidValue` to bound numeric ranges.
 * 2. If it should also be user-editable at runtime, surface it as a preference
 *    in ResonancePreferencesModel (initialize that Property from this query parameter).
 *
 * Usage: append e.g. `?solverType=analytical&showModalControls=true` to the sim URL.
 */

import { logGlobal } from "scenerystack/phet-core";
import { QueryStringMachine } from "scenerystack/query-string-machine";
import { SolverType } from "../common/model/SolverType.js";
import ResonanceNamespace from "../ResonanceNamespace.js";
import { RendererType } from "./RendererType.js";

const resonanceQueryParameters = QueryStringMachine.getAll({
  /** ODE solver used by the simulation. */
  solverType: {
    type: "string",
    defaultValue: SolverType.RUNGE_KUTTA_4,
    validValues: Object.values(SolverType),
    public: true,
  },

  /** Whether the per-mode controls are shown on the Chladni screen. */
  showModalControls: {
    type: "boolean",
    defaultValue: false,
    public: true,
  },

  /** Renderer used for the Chladni visualization. */
  rendererType: {
    type: "string",
    defaultValue: RendererType.CANVAS,
    validValues: Object.values(RendererType),
    public: true,
  },
});

ResonanceNamespace.register("resonanceQueryParameters", resonanceQueryParameters);

// Log query parameters (for the console / PhET-iO).
logGlobal("phet.chipper.queryParameters");

export default resonanceQueryParameters;
