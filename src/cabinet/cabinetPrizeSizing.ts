import type { PrizeDefinition } from "../prizes/types";
import type { CabinetLayoutId } from "../layouts/cabinetLayouts";

// Apply a moderate physical size increase only to the player-facing stocked
// cabinet. The remaining calibrated M09 layouts retain their exact geometry.
export const STOCKED_PRIZE_SIZE_MULTIPLIER = 1.13;
// A 9 cm stocked can is much narrower than the three-finger contact
// triangle; model the larger cylindrical prize actually sold in this
// machine while keeping its existing mass and upright height.
export const STOCKED_CAN_DIAMETER_MULTIPLIER = 1.27;
export const STOCKED_TALL_BOX_WIDTH_MULTIPLIER = 1.27;

export function cabinetPrizeDefinition(
  definition: PrizeDefinition,
  layoutId: CabinetLayoutId,
): PrizeDefinition {
  if (layoutId !== "stocked" || definition.shapeFamily === "ring") {
    return definition;
  }

  const factor = STOCKED_PRIZE_SIZE_MULTIPLIER;
  const horizontalFactor = definition.shapeFamily === "cylinder"
    ? factor * STOCKED_CAN_DIAMETER_MULTIPLIER
    : definition.shapeFamily === "tall_box"
      ? factor * STOCKED_TALL_BOX_WIDTH_MULTIPLIER
      : factor;
  return {
    ...definition,
    dimensions: {
      x: definition.dimensions.x * horizontalFactor,
      y: definition.dimensions.y * factor,
      z: definition.dimensions.z * horizontalFactor,
    },
    // Stocked 3D can renders real top/bottom seams; use matching physical
    // ledges instead of an unrealistically smooth full-radius cylinder.
    colliderProfileId: definition.shapeFamily === "cylinder"
      ? "cylinder/rimmed_v1"
      : definition.colliderProfileId,
    // Intentional: increased collision and visual size, unchanged weight.
    nominalMassKg: definition.nominalMassKg,
  };
}
