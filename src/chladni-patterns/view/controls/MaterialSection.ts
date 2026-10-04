/**
 * MaterialSection.ts
 *
 * Control panel section for material selection in the Chladni plate visualization.
 */

import { type Node, Text, VBox } from "scenerystack/scenery";
import type { ComboBoxItem } from "scenerystack/sun";
import { ComboBox } from "scenerystack/sun";
import { ResonanceStrings } from "../../../i18n/ResonanceStrings.js";
import ResonanceColors from "../../../ResonanceColors.js";
import ResonanceConstants from "../../../ResonanceConstants.js";
import type { ChladniModel } from "../../model/ChladniModel.js";
import { MATERIALS, type MaterialType } from "../../model/Material.js";
import { getMaterialStringProperty } from "../MaterialStrings.js";

export class MaterialSection extends VBox {
  public constructor(model: ChladniModel, comboBoxListParent: Node) {
    // Create label
    const materialLabel = new Text(ResonanceStrings.chladni.materialStringProperty, {
      font: ResonanceConstants.LABEL_FONT,
      fill: ResonanceColors.textProperty,
    });

    // Create combo box items
    const materialComboBoxItems: ComboBoxItem<MaterialType>[] = MATERIALS.map((material) => ({
      value: material,
      createNode: () => {
        return new Text(getMaterialStringProperty(material), {
          font: ResonanceConstants.CONTROL_FONT,
        });
      },
    }));

    // Create combo box
    const materialComboBox = new ComboBox(model.materialProperty, materialComboBoxItems, comboBoxListParent, {
      xMargin: ResonanceConstants.COMBO_BOX_X_MARGIN,
      yMargin: ResonanceConstants.COMBO_BOX_Y_MARGIN,
      cornerRadius: ResonanceConstants.COMBO_BOX_CORNER_RADIUS,
      // Accessibility
      accessibleName: ResonanceStrings.chladni.a11y.controlPanel.materialLabelStringProperty,
    });

    super({
      children: [materialLabel, materialComboBox],
      spacing: ResonanceConstants.COMBO_BOX_SPACING,
      align: "left",
    });
  }
}
