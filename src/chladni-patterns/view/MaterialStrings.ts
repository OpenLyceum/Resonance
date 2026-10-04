/**
 * MaterialStrings.ts
 *
 * Localized display names for the plate materials. Material.name is an English
 * identifier; anything user-visible (combo box, descriptions, alerts) must go
 * through these string Properties instead.
 */

import { DynamicProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { ResonanceStrings } from "../../i18n/ResonanceStrings.js";
import { Material, type MaterialType } from "../model/Material.js";

const MATERIAL_STRINGS = new Map<MaterialType, TReadOnlyProperty<string>>([
  [Material.COPPER, ResonanceStrings.chladni.copperStringProperty],
  [Material.ALUMINUM, ResonanceStrings.chladni.aluminumStringProperty],
  [Material.ZINC, ResonanceStrings.chladni.zincStringProperty],
  [Material.STAINLESS_STEEL, ResonanceStrings.chladni.stainlessSteelStringProperty],
]);

/**
 * The localized name of a material.
 */
export function getMaterialStringProperty(material: MaterialType): TReadOnlyProperty<string> {
  return MATERIAL_STRINGS.get(material) ?? ResonanceStrings.chladni.copperStringProperty;
}

/**
 * The localized name of whichever material is selected; follows both material and locale changes.
 */
export function createMaterialNameProperty(
  materialProperty: TReadOnlyProperty<MaterialType>,
): TReadOnlyProperty<string> {
  return new DynamicProperty<string, string, MaterialType>(materialProperty, {
    derive: getMaterialStringProperty,
  });
}
