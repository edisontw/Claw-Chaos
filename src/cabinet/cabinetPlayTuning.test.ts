import { describe, expect, it } from "vitest";
import {
  CLAW_LAB_CONFIG,
  computeFingerTipSpan,
} from "../scenes/clawLab";
import {
  M02_GANTRY_CONFIG,
  resolveGantryInitialPosition,
} from "../scenes/gantryLab";
import { M04_PLAY_CONFIG } from "../scenes/m04PlayCycle";
import { M06_CABINET_CONFIG } from "./cabinetGeometry";
import {
  CABINET_CLAW_PARK_POSITION,
  CABINET_GANTRY_TRAVEL_BOUNDS,
  CABINET_PLAY_TUNING,
} from "./cabinetPlayTuning";

describe("Cabinet play tuning", () => {
  it("parks the initial cabinet claw directly over the chute", () => {
    expect(CABINET_CLAW_PARK_POSITION).toEqual({
      x: M06_CABINET_CONFIG.chuteCenterX,
      z: M06_CABINET_CONFIG.chuteCenterZ,
    });
    expect(
      resolveGantryInitialPosition(CABINET_CLAW_PARK_POSITION),
    ).toEqual(CABINET_CLAW_PARK_POSITION);
    expect(CABINET_CLAW_PARK_POSITION.x).toBeGreaterThanOrEqual(
      M02_GANTRY_CONFIG.xMin,
    );
    expect(CABINET_CLAW_PARK_POSITION.x).toBeLessThanOrEqual(
      M02_GANTRY_CONFIG.xMax,
    );
    expect(CABINET_CLAW_PARK_POSITION.z).toBeGreaterThanOrEqual(
      M02_GANTRY_CONFIG.zMin,
    );
    expect(CABINET_CLAW_PARK_POSITION.z).toBeLessThanOrEqual(
      M02_GANTRY_CONFIG.zMax,
    );
  });

  it("keeps the fully-open claw inside the side/back viewing envelope", () => {
    const openRadius =
      computeFingerTipSpan(CLAW_LAB_CONFIG.openAngle) * 0.5 +
      CLAW_LAB_CONFIG.fingerTipVisualRadius;

    expect(CABINET_GANTRY_TRAVEL_BOUNDS.xMin).toBeLessThanOrEqual(
      CABINET_CLAW_PARK_POSITION.x,
    );
    expect(CABINET_GANTRY_TRAVEL_BOUNDS.zMax).toBe(
      CABINET_CLAW_PARK_POSITION.z,
    );

    expect(
      Math.abs(CABINET_GANTRY_TRAVEL_BOUNDS.xMin) +
        openRadius,
    ).toBeLessThanOrEqual(
      M06_CABINET_CONFIG.interiorHalfX + 0.001,
    );
    expect(
      CABINET_GANTRY_TRAVEL_BOUNDS.xMax +
        openRadius,
    ).toBeLessThanOrEqual(
      M06_CABINET_CONFIG.interiorHalfX + 0.001,
    );
    expect(
      Math.abs(CABINET_GANTRY_TRAVEL_BOUNDS.zMin) +
        openRadius,
    ).toBeLessThanOrEqual(
      M06_CABINET_CONFIG.interiorHalfZ + 0.001,
    );
  });

  it("raises the idle claw while preserving the locked bottom reach", () => {
    const offset = CABINET_PLAY_TUNING.verticalHomeOffsetMeters;
    const cabinetCarriageY = M02_GANTRY_CONFIG.carriageY + offset;
    const cabinetMaxPayout =
      M02_GANTRY_CONFIG.reelMaxPayout + offset;

    const baselineLowestAnchorY =
      M02_GANTRY_CONFIG.carriageY -
      M02_GANTRY_CONFIG.carriageHalfY -
      M02_GANTRY_CONFIG.reelMaxPayout;
    const cabinetLowestAnchorY =
      cabinetCarriageY -
      M02_GANTRY_CONFIG.carriageHalfY -
      cabinetMaxPayout;
    const cabinetCarriageTopY =
      cabinetCarriageY + M02_GANTRY_CONFIG.carriageHalfY;

    expect(offset).toBe(0.085);
    expect(cabinetLowestAnchorY).toBeCloseTo(
      baselineLowestAnchorY,
      12,
    );
    expect(cabinetCarriageTopY).toBeLessThan(
      M06_CABINET_CONFIG.playAreaHeight,
    );
    expect(
      M06_CABINET_CONFIG.playAreaHeight - cabinetCarriageTopY,
    ).toBeGreaterThanOrEqual(0.009);
  });

  it("strengthens normal cabinet grip without exceeding HOLD BOOST", () => {
    expect(CABINET_PLAY_TUNING.fingerFriction).toBeGreaterThan(
      CLAW_LAB_CONFIG.fingerFriction,
    );
    expect(CABINET_PLAY_TUNING.closePickupTorque).toBeGreaterThan(
      CLAW_LAB_CONFIG.maxMotorTorque,
    );
    expect(CABINET_PLAY_TUNING.retainingTorque).toBeGreaterThan(
      CLAW_LAB_CONFIG.pt002RetainingTorque,
    );
    expect(CABINET_PLAY_TUNING.holdBoostTorque).toBeGreaterThan(
      CABINET_PLAY_TUNING.retainingTorque,
    );
    expect(CABINET_PLAY_TUNING.holdBoostTorque).toBeGreaterThan(
      M04_PLAY_CONFIG.holdBoostTorque,
    );
    expect(CABINET_PLAY_TUNING.fingerFriction).toBe(1.94);
    expect(CABINET_PLAY_TUNING.closePickupTorque).toBe(10.0);
    expect(CABINET_PLAY_TUNING.retainingTorque).toBe(0.014);
    expect(CABINET_PLAY_TUNING.holdBoostTorque).toBe(0.018);
    expect(CABINET_PLAY_TUNING.closedAngleRadians).toBe(-0.63);
    expect(
      CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
    ).toBe(0.010);
    expect(
      CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
    ).toBeGreaterThan(
      M04_PLAY_CONFIG.pickupLiftDistanceMeters,
    );
    expect(
      CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
    ).toBe(0.18);
  });
});
