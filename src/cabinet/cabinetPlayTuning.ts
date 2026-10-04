import { M06_CABINET_CONFIG } from "./cabinetGeometry";

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
  fingerNodes: [
    { radial: 0, down: 0 },
    { radial: 0.03, down: 0.07 },
    { radial: 0.075, down: 0.165 },
    { radial: 0.05, down: 0.225 },
    { radial: 0.09, down: 0.205 },
    { radial: 0.082, down: 0.183 },
  ],
  fingerLowerPadSegmentIndices: [2, 4],
  chuteTrimHalfWidth: 0.012,
  chuteTrimHalfHeight: 0.004,
} as const;
