import { M06_CABINET_CONFIG } from "./cabinetGeometry";

export const CABINET_CLAW_PARK_POSITION = {
  x: M06_CABINET_CONFIG.chuteCenterX,
  z: M06_CABINET_CONFIG.chuteCenterZ,
} as const;

// The original conservative stops guarantee a completely open claw and
// remain the full-opening zone (including the chute park). Beyond these
// stops the claw narrows progressively before approaching the glass.
export const CABINET_FULL_OPEN_TRAVEL_BOUNDS = {
  xMin: -0.28,
  xMax: 0.28,
  zMin: -0.18,
  zMax: M06_CABINET_CONFIG.chuteCenterZ,
} as const;

// Extend carriage reach to include edge stock without pushing the 75 mm
// carriage half-width/depth through the enclosing cabinet walls.
export const CABINET_GANTRY_TRAVEL_BOUNDS = {
  xMin: -0.37,
  xMax: 0.37,
  zMin: -0.27,
  zMax: 0.27,
} as const;

export const CABINET_WALL_SAFE_OPENING = {
  predictiveSeconds: 0.40,
  additionalMarginMeters: 0.010,
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
