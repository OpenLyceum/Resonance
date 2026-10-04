/**
 * Material.ts
 *
 * Defines the available plate materials and their physical properties
 * for the Chladni pattern simulation.
 *
 * The dispersion constant C relates frequency to wave number via: k = sqrt(freq / C)
 * Values are based on physical material properties.
 */

export interface MaterialProperties {
  /** English identifier, not for display — use MaterialStrings for the localized name. */
  readonly name: string;
  readonly dispersionConstant: number;
}

/**
 * Available plate materials with their dispersion constants.
 * The dispersion constant affects how patterns form at different frequencies.
 */
export const Material = {
  COPPER: {
    name: "Copper",
    dispersionConstant: 0.178,
  },
  ALUMINUM: {
    name: "Aluminum",
    dispersionConstant: 0.246,
  },
  ZINC: {
    name: "Zinc",
    dispersionConstant: 0.166,
  },
  STAINLESS_STEEL: {
    name: "Stainless Steel",
    dispersionConstant: 0.238,
  },
} as const;

export type MaterialType = (typeof Material)[keyof typeof Material];

/**
 * Get all available materials as an array for UI iteration.
 */
export const MATERIALS: readonly MaterialType[] = [
  Material.COPPER,
  Material.ALUMINUM,
  Material.ZINC,
  Material.STAINLESS_STEEL,
];
