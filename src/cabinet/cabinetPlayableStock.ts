import type { Vec3 } from "../physics/PhysicsRuntime";
import { M06_CABINET_CONFIG } from "./cabinetGeometry";

export function isPrizeBelowChuteOpening(
  point: Vec3,
): boolean {
  const c = M06_CABINET_CONFIG;
  return (
    Math.abs(point.x - c.chuteCenterX) <=
      c.chuteOpeningHalfX &&
    Math.abs(point.z - c.chuteCenterZ) <=
      c.chuteOpeningHalfZ &&
    point.y <
      c.playDeckY - c.playDeckHalfThickness
  );
}
