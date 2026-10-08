import { M06_CABINET_CONFIG } from "./cabinetGeometry";
import { CLAW_LAB_CONFIG } from "../scenes/clawLab";

export const CABINET_CLAW_PARK_POSITION = {
  x: M06_CABINET_CONFIG.chuteCenterX,
  z: M06_CABINET_CONFIG.chuteCenterZ,
} as const;

export const CABINET_PLAY_TUNING = {
  verticalHomeOffsetMeters: 0.085,
  fingerFriction: 1.94,
  closePickupTorque: 10.0,
  retainingTorque: 0.014,
  holdBoostTorque: 0.018,
  pickupLiftDistanceMeters: 0.18,
  closedAngleRadians: -0.63,
  fingerLowerPadRadiusMeters: 0.010,
  fingerLowerPadLengthMeters: 0.012,
  chuteTrimHalfWidth: 0.012,
  chuteTrimHalfHeight: 0.004,
} as const;

// The longitudinal carriage end-stop must account for the actual *open*
// three-prong envelope. Z +/-0.27 used to force a front/back finger several
// centimetres into the window, causing its real revolute joint to fold and
// the rendered claw to look as though one finger had grown longer.
// A small 10 mm contact allowance preserves natural physical glass bumps.
// This is a fixed rail end-stop, NOT a proximity-triggered claw angle change.
export const CABINET_LONGITUDINAL_CONTACT_ALLOWANCE_METERS = 0.010;

export function openClawLongitudinalReachMeters(): number {
  const claw = CLAW_LAB_CONFIG;
  const openCos = Math.cos(claw.openAngle);
  const openSin = Math.sin(claw.openAngle);
  const fingerAzimuths = [0, 2 * Math.PI / 3, 4 * Math.PI / 3];

  let maxZ = 0;
  for (const theta of fingerAzimuths) {
    const radialZ = Math.abs(Math.sin(theta));
    for (const node of claw.fingerNodes) {
      const radial =
        claw.fingerPivotRadius +
        node.radial * openCos +
        node.down * openSin;
      maxZ = Math.max(maxZ, radial * radialZ);
    }
  }

  // The contact pad is thicker than the metal rod and provides a
  // conservative collision margin for the whole finger capsule chain.
  return maxZ + Math.max(
    claw.fingerRodRadius,
    CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
  );
}

export const CABINET_SAFE_LONGITUDINAL_END_STOP_METERS =
  Math.round(
    (
      M06_CABINET_CONFIG.interiorHalfZ -
      openClawLongitudinalReachMeters() +
      CABINET_LONGITUDINAL_CONTACT_ALLOWANCE_METERS
    ) * 1000,
  ) / 1000;

// Keep the approved wide lateral reach. Only fix the dangerous deep
// front/back over-travel. All finger motors remain fully open against glass.
export const CABINET_GANTRY_TRAVEL_BOUNDS = {
  xMin: -0.37,
  xMax: 0.37,
  zMin: -CABINET_SAFE_LONGITUDINAL_END_STOP_METERS,
  zMax: CABINET_SAFE_LONGITUDINAL_END_STOP_METERS,
} as const;

