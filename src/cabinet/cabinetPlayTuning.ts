import { M06_CABINET_CONFIG } from "./cabinetGeometry";

export const CABINET_CLAW_PARK_POSITION = {
  x: M06_CABINET_CONFIG.chuteCenterX,
  z: M06_CABINET_CONFIG.chuteCenterZ,
} as const;

// Expanded carriage travel lets the fully-open fingers meet cabinet
// boundaries physically. Actual contact with glass/frames is resolved by
// Rapier; never pre-close fingers merely because they approach a wall.
// The 75 mm carriage half-width/depth remains inside the enclosure.
export const CABINET_GANTRY_TRAVEL_BOUNDS = {
  xMin: -0.37,
  xMax: 0.37,
  zMin: -0.27,
  zMax: 0.27,
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
