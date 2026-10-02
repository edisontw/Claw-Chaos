import { describe, expect, it } from "vitest";
import { CLAW_LAB_CONFIG } from "../scenes/clawLab";
import { M02_GANTRY_CONFIG } from "../scenes/gantryLab";
import { M04_PLAY_CONFIG } from "../scenes/m04PlayCycle";
import { M06_CABINET_CONFIG } from "./cabinetGeometry";
import { CABINET_PLAY_TUNING } from "./cabinetPlayTuning";

describe("Cabinet play tuning", () => {
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
    expect(CABINET_PLAY_TUNING.retainingTorque).toBeLessThan(
      M04_PLAY_CONFIG.holdBoostTorque,
    );
    expect(
      CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
    ).toBeGreaterThan(
      M04_PLAY_CONFIG.pickupLiftDistanceMeters,
    );
    expect(
      CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
    ).toBe(0.12);
  });
});
