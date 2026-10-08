import type { PrizeDefinition } from "../prizes/types";
import type { CabinetLayoutId } from "../layouts/cabinetLayouts";

// Apply a moderate physical size increase only to the player-facing stocked
// cabinet. The remaining calibrated M09 layouts retain their exact geometry.
export const STOCKED_PRIZE_SIZE_MULTIPLIER = 1.13;

export function cabinetPrizeDefinition(
  definition: PrizeDefinition,
  layoutId: CabinetLayoutId,
): PrizeDefinition {
  if (layoutId !== "stocked" || definition.shapeFamily === "ring") {
    return definition;
  }

  const factor = STOCKED_PRIZE_SIZE_MULTIPLIER;
  return {
    ...definition,
    dimensions: {
      x: definition.dimensions.x * factor,
      y: definition.dimensions.y * factor,
      z: definition.dimensions.z * factor,
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
