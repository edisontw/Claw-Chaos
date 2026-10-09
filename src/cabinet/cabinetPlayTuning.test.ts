import { describe, expect, it } from "vitest";
import { CLAW_LAB_CONFIG } from "../scenes/clawLab";
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
  CABINET_STOCKED_GRIP_TUNING,
  CABINET_STOCKED_REEL_MAX_SPEED_METERS_PER_SECOND,
  CABINET_SAFE_LONGITUDINAL_END_STOP_METERS,
  CABINET_LONGITUDINAL_CONTACT_ALLOWANCE_METERS,
  openClawLongitudinalReachMeters,
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

  it("retains the extended travel range where open fingers naturally touch glass", () => {
    // Carriage remains inside the cabinet; fingers are free to contact
    // the real Rapier wall rather than receiving an artificial open-angle cap.
    expect(CABINET_GANTRY_TRAVEL_BOUNDS.xMin).toBe(-0.37);
    expect(CABINET_GANTRY_TRAVEL_BOUNDS.xMax).toBe(0.37);
    expect(CABINET_GANTRY_TRAVEL_BOUNDS.zMin).toBe(
      -CABINET_SAFE_LONGITUDINAL_END_STOP_METERS,
    );
    expect(CABINET_GANTRY_TRAVEL_BOUNDS.zMax).toBe(
      CABINET_SAFE_LONGITUDINAL_END_STOP_METERS,
    );
    // Prevent the old several-centimetre window overdrive while still
    // allowing the physical capsules to make a small natural contact.
    expect(CABINET_SAFE_LONGITUDINAL_END_STOP_METERS).toBeGreaterThanOrEqual(
      CABINET_CLAW_PARK_POSITION.z,
    );
    expect(CABINET_SAFE_LONGITUDINAL_END_STOP_METERS).toBeLessThan(0.22);
    expect(
      CABINET_SAFE_LONGITUDINAL_END_STOP_METERS +
      openClawLongitudinalReachMeters() -
      M06_CABINET_CONFIG.interiorHalfZ,
    ).toBeLessThanOrEqual(
      CABINET_LONGITUDINAL_CONTACT_ALLOWANCE_METERS + 0.001,
    );
    expect(
      CABINET_GANTRY_TRAVEL_BOUNDS.xMax +
        M02_GANTRY_CONFIG.carriageHalfX,
    ).toBeLessThan(M06_CABINET_CONFIG.interiorHalfX);
    expect(
      Math.abs(CABINET_GANTRY_TRAVEL_BOUNDS.zMin) +
        M02_GANTRY_CONFIG.carriageHalfZ,
    ).toBeLessThan(M06_CABINET_CONFIG.interiorHalfZ);
    expect(CABINET_GANTRY_TRAVEL_BOUNDS.xMin).toBeLessThanOrEqual(
      CABINET_CLAW_PARK_POSITION.x,
    );
    expect(CABINET_GANTRY_TRAVEL_BOUNDS.zMax).toBeGreaterThanOrEqual(
      CABINET_CLAW_PARK_POSITION.z,
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

  it("reserves the deeper, rubber-padded hold for stocked prizes only", () => {
    expect(CABINET_STOCKED_GRIP_TUNING.additionalPickupDropMeters).toBe(0.055);
    expect(CABINET_STOCKED_GRIP_TUNING.fingerFriction).toBe(1.94);
    expect(CABINET_STOCKED_GRIP_TUNING.fingerRodFriction).toBe(1.94);
    expect(CABINET_STOCKED_GRIP_TUNING.closePickupTorque).toBe(10.0);
    expect(CABINET_STOCKED_GRIP_TUNING.fingerLowerPadLengthMeters).toBe(0.045);
    expect(CABINET_STOCKED_GRIP_TUNING.fingerLowerPadRadiusMeters).toBe(0.014);
    expect(CABINET_STOCKED_GRIP_TUNING.retainingTorque).toBe(0.10);
    expect(CABINET_STOCKED_GRIP_TUNING.holdBoostTorque).toBe(0.12);
    expect(CABINET_STOCKED_GRIP_TUNING.fingerDensity).toBe(
      CABINET_PLAY_TUNING.fingerDensity,
    );
    expect(CABINET_STOCKED_GRIP_TUNING.fingerDensity).toBe(3200);
    expect(CABINET_STOCKED_GRIP_TUNING.fingerAngularDamping).toBe(24.0);
    expect(CABINET_STOCKED_GRIP_TUNING.descentOpenStiffness).toBe(8);
    expect(CABINET_STOCKED_GRIP_TUNING.descentOpenDamping).toBe(10);
    expect(CABINET_STOCKED_GRIP_TUNING.descentOpenMaxTorque).toBe(0.05);
    expect(CABINET_STOCKED_GRIP_TUNING.bottomCloseSettleSeconds).toBe(0.12);
    expect(CABINET_STOCKED_GRIP_TUNING.closeRampSeconds).toBe(0.20);
    expect(CABINET_STOCKED_GRIP_TUNING.closeRampStartTorque).toBe(1.5);
    expect(CABINET_STOCKED_GRIP_TUNING.closeMotorDamping).toBe(32.0);
    expect(CABINET_STOCKED_REEL_MAX_SPEED_METERS_PER_SECOND).toBe(0.14);
    expect(CABINET_STOCKED_REEL_MAX_SPEED_METERS_PER_SECOND).toBeLessThan(
      M02_GANTRY_CONFIG.reelMaxSpeed,
    );
    expect(CABINET_PLAY_TUNING.fingerLowerPadLengthMeters).toBe(0.012);
    expect(CABINET_PLAY_TUNING.retainingTorque).toBe(0.014);
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
