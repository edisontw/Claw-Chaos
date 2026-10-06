import { M06_CABINET_CONFIG } from "./cabinetGeometry";

export const CABINET_CLAW_PARK_POSITION = {
  x: M06_CABINET_CONFIG.chuteCenterX,
  z: M06_CABINET_CONFIG.chuteCenterZ,
} as const;

// Keep the fully-open claw inside the visible cabinet envelope at the
// opaque side/back edges. The front limit still reaches the chute park.
export const CABINET_GANTRY_TRAVEL_BOUNDS = {
  xMin: -0.28,
  xMax: 0.28,
  zMin: -0.18,
  zMax: M06_CABINET_CONFIG.chuteCenterZ,
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
