import { describe, expect, it } from "vitest";
import { CLAW_LAB_CONFIG } from "./clawLab";
import {
  advanceGantryMotion,
  type GantryMotionConfig,
} from "./gantryMotion";
import {
  fingerRadialEnvelope,
  wallSafeFingerOpenAngle,
} from "./gantryWallSafety";
import {
  CABINET_CLAW_PARK_POSITION,
  CABINET_FULL_OPEN_TRAVEL_BOUNDS,
  CABINET_GANTRY_TRAVEL_BOUNDS,
  CABINET_WALL_SAFE_OPENING,
} from "../cabinet/cabinetPlayTuning";
import { M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";

const profile = {
  interiorHalfX: M06_CABINET_CONFIG.interiorHalfX,
  interiorHalfZ: M06_CABINET_CONFIG.interiorHalfZ,
  fullOpenBounds: CABINET_FULL_OPEN_TRAVEL_BOUNDS,
  extendedBounds: CABINET_GANTRY_TRAVEL_BOUNDS,
  fingerPivotRadius: CLAW_LAB_CONFIG.fingerPivotRadius,
  fingerNodes: CLAW_LAB_CONFIG.fingerNodes,
  fingerRadius: CLAW_LAB_CONFIG.fingerRodRadius,
  fingerTipRadius: 0.010,
  minAngleRadians: -0.63,
  maxAngleRadians: CLAW_LAB_CONFIG.openAngle,
  ...CABINET_WALL_SAFE_OPENING,
};

describe("Cabinet edge claw reach", () => {
  it("reaches prizes outside the original center-only travel lane", () => {
    const config: GantryMotionConfig = {
      x: {
        minPosition: CABINET_GANTRY_TRAVEL_BOUNDS.xMin,
        maxPosition: CABINET_GANTRY_TRAVEL_BOUNDS.xMax,
        maxSpeed: 0.45,
        acceleration: 1.35,
        braking: 3.5,
      },
      z: {
        minPosition: CABINET_GANTRY_TRAVEL_BOUNDS.zMin,
        maxPosition: CABINET_GANTRY_TRAVEL_BOUNDS.zMax,
        maxSpeed: 0.45,
        acceleration: 1.35,
        braking: 3.5,
      },
    };
    let state = {
      x: { position: -0.28, velocity: 0 },
      z: { position: 0.20, velocity: 0 },
    };
    for (let tick = 0; tick < 400; tick++) {
      state = advanceGantryMotion(state, 1, -1, config, 1 / 120);
    }

    expect(state.x.position).toBeCloseTo(0.37, 5);
    expect(state.z.position).toBeCloseTo(-0.27, 5);
  });

  it("keeps original central opening and return/chute park unchanged", () => {
    expect(
      wallSafeFingerOpenAngle(
        CABINET_CLAW_PARK_POSITION,
        profile,
      ),
    ).toBeCloseTo(CLAW_LAB_CONFIG.openAngle, 10);
    expect(
      wallSafeFingerOpenAngle({ x: 0, z: 0 }, profile),
    ).toBeCloseTo(CLAW_LAB_CONFIG.openAngle, 10);
  });

  it("automatically reduces opening enough to fit near both walls", () => {
    for (const point of [
      { x: -0.37, z: 0.0 },
      { x: 0.37, z: 0.0 },
      { x: 0.0, z: -0.27 },
      { x: 0.0, z: 0.27 },
      { x: 0.37, z: -0.27 },
      { x: -0.37, z: 0.27 },
    ]) {
      const angle = wallSafeFingerOpenAngle(point, profile);
      const extent = fingerRadialEnvelope(angle, profile);
      expect(angle).toBeLessThan(CLAW_LAB_CONFIG.openAngle);
      expect(angle).toBeGreaterThan(-0.63);
      expect(Math.abs(point.x) + extent).toBeLessThan(
        M06_CABINET_CONFIG.interiorHalfX,
      );
      expect(Math.abs(point.z) + extent).toBeLessThan(
        M06_CABINET_CONFIG.interiorHalfZ,
      );
    }
  });

  it("predictively narrows before reaching a wall at transport speed", () => {
    const still = wallSafeFingerOpenAngle(
      { x: 0.265, z: 0 },
      profile,
    );
    const moving = wallSafeFingerOpenAngle(
      { x: 0.265, z: 0, velocityX: 0.45 },
      profile,
    );
    expect(still).toBeCloseTo(profile.maxAngleRadians, 10);
    expect(moving).toBeLessThan(still);
  });
});
