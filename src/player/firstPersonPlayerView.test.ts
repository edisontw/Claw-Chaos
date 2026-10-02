import { describe, expect, it } from "vitest";
import { M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";
import {
  M07_CAMERA_FOV_DEGREES,
  M07_CABINET_VIEW_TARGETS,
  M07_FIRST_PERSON_VIEW_CONFIG,
  M07_SIDE_INSPECTION_CASES,
  advanceFirstPersonPlayerView,
  applyFirstPersonLookDelta,
  computeLookAnglesToPoint,
  createFirstPersonPlayerViewState,
  findFocusedPlayerViewTarget,
  playerCameraPosition,
} from "./firstPersonPlayerView";

describe("M07 first-person player view constraints", () => {
  it("PT-025 provides at least ±90 degrees of yaw with bounded look-down pitch", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    let state = createFirstPersonPlayerViewState(config);

    expect(config.yawLimitRadians).toBeGreaterThanOrEqual(
      Math.PI * 0.5,
    );
    expect(M07_CAMERA_FOV_DEGREES).toBe(50);

    state = applyFirstPersonLookDelta(
      state,
      -100_000,
      -100_000,
      config,
    );
    expect(state.yawRadians).toBeCloseTo(
      config.yawLimitRadians,
      10,
    );
    expect(state.pitchRadians).toBeCloseTo(
      config.pitchMaxRadians,
      10,
    );

    state = applyFirstPersonLookDelta(
      state,
      200_000,
      200_000,
      config,
    );
    expect(state.yawRadians).toBeCloseTo(
      -config.yawLimitRadians,
      10,
    );
    expect(state.pitchRadians).toBeCloseTo(
      config.pitchMinRadians,
      10,
    );
    expect(config.pitchMinRadians).toBeLessThanOrEqual(
      -Math.PI / 3,
    );
  });

  it("PT-026 blocks direct front entry but allows walking around the front corner to side glass", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;

    let blocked = createFirstPersonPlayerViewState(config);
    for (let index = 0; index < 600; index += 1) {
      blocked = advanceFirstPersonPlayerView(
        blocked,
        { strafe: 0, forward: 1, lean: 0 },
        1 / 60,
        config,
      );
    }
    expect(blocked.x).toBeCloseTo(0, 10);
    expect(blocked.z).toBeCloseTo(
      config.cabinetFrontClearZ,
      10,
    );

    let side = createFirstPersonPlayerViewState(config);
    for (let index = 0; index < 240; index += 1) {
      side = advanceFirstPersonPlayerView(
        side,
        { strafe: 1, forward: 0, lean: 0 },
        1 / 60,
        config,
      );
    }
    expect(side.x).toBeGreaterThanOrEqual(
      config.cabinetSideClearX,
    );

    for (let index = 0; index < 240; index += 1) {
      side = advanceFirstPersonPlayerView(
        side,
        { strafe: 0, forward: 1, lean: 0 },
        1 / 60,
        config,
      );
    }
    expect(side.z).toBeLessThan(config.cabinetFrontClearZ);
    expect(side.x).toBeGreaterThanOrEqual(
      config.cabinetSideClearX,
    );
    expect(config.eyeY).toBe(0.98);
  });

  it("PT-026 keeps inward lean outside the side-glass clearance", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    let state = {
      ...createFirstPersonPlayerViewState(config),
      x: config.cabinetSideClearX + 0.02,
      z: 0.02,
    };

    for (let index = 0; index < 120; index += 1) {
      state = advanceFirstPersonPlayerView(
        state,
        { strafe: 0, forward: 0, lean: -1 },
        1 / 60,
        config,
      );
    }

    const cameraPosition = playerCameraPosition(state, config);
    expect(cameraPosition.x).toBeGreaterThanOrEqual(
      config.cabinetSideClearX - 1e-10,
    );
    expect(state.leanMeters).toBeCloseTo(-0.02, 6);
  });

  it("PT-025 reaches both side-glass depth-inspection sight lines without widening FOV", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    const sideGlassOuterX =
      M06_CABINET_CONFIG.interiorHalfX +
      M06_CABINET_CONFIG.wallHalfThickness * 2;
    const sideGlassHalfZ =
      M06_CABINET_CONFIG.interiorHalfZ +
      M06_CABINET_CONFIG.wallHalfThickness * 2;

    expect(M07_CAMERA_FOV_DEGREES).toBe(50);

    for (const entry of M07_SIDE_INSPECTION_CASES) {
      const cameraPosition = {
        x: entry.position.x,
        y: config.eyeY,
        z: entry.position.z,
      };
      const look = computeLookAnglesToPoint(
        cameraPosition,
        entry.target,
      );

      expect(Math.abs(look.yawRadians)).toBeLessThanOrEqual(
        config.yawLimitRadians,
      );
      expect(look.pitchRadians).toBeGreaterThanOrEqual(
        config.pitchMinRadians,
      );
      expect(look.pitchRadians).toBeLessThanOrEqual(
        config.pitchMaxRadians,
      );

      const planeX =
        entry.side === "right"
          ? sideGlassOuterX
          : -sideGlassOuterX;
      const t =
        (planeX - cameraPosition.x) /
        (entry.target.x - cameraPosition.x);
      const crossingZ =
        cameraPosition.z +
        (entry.target.z - cameraPosition.z) * t;
      const crossingY =
        cameraPosition.y +
        (entry.target.y - cameraPosition.y) * t;

      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
      expect(Math.abs(crossingZ)).toBeLessThan(sideGlassHalfZ);
      expect(crossingY).toBeGreaterThan(0);
      expect(crossingY).toBeLessThan(
        M06_CABINET_CONFIG.playAreaHeight,
      );
    }
  });

  it("PT-025 can look down at both the control panel and chute and acquire gaze focus", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    const base = {
      ...createFirstPersonPlayerViewState(config),
      x: 0,
      z: config.maxZ,
      leanMeters: 0,
    };
    const cameraPosition = playerCameraPosition(base, config);

    for (const target of M07_CABINET_VIEW_TARGETS) {
      const look = computeLookAnglesToPoint(
        cameraPosition,
        target.position,
      );

      expect(Math.abs(look.yawRadians)).toBeLessThanOrEqual(
        config.yawLimitRadians,
      );
      expect(look.pitchRadians).toBeGreaterThanOrEqual(
        config.pitchMinRadians,
      );
      expect(look.pitchRadians).toBeLessThanOrEqual(
        config.pitchMaxRadians,
      );

      const focused = findFocusedPlayerViewTarget(
        {
          ...base,
          yawRadians: look.yawRadians,
          pitchRadians: look.pitchRadians,
        },
        M07_CABINET_VIEW_TARGETS,
        config,
      );

      expect(focused?.target.id).toBe(target.id);
    }
  });
});
