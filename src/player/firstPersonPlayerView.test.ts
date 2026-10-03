import { describe, expect, it } from "vitest";
import { M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";
import {
  M07_CAMERA_FOV_DEGREES,
  M07_CABINET_VIEW_TARGETS,
  M07_FIRST_PERSON_VIEW_CONFIG,
  advanceFirstPersonPlayerView,
  applyFirstPersonLookDelta,
  computeLookAnglesToPoint,
  createFirstPersonPlayerViewState,
  findFocusedPlayerViewTarget,
  playerCameraPosition,
} from "./firstPersonPlayerView";

describe("M07 first-person player view constraints", () => {
  it("uses a faster calibrated touch-look sensitivity than mouse look", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    const initial = createFirstPersonPlayerViewState(config);
    const mouse = applyFirstPersonLookDelta(
      initial,
      -100,
      0,
      config,
    );
    const touch = applyFirstPersonLookDelta(
      initial,
      -100,
      0,
      config,
      config.touchSensitivityRadiansPerPixel,
    );

    expect(config.touchSensitivityRadiansPerPixel).toBeGreaterThan(
      config.mouseSensitivityRadiansPerPixel,
    );
    expect(touch.yawRadians).toBeGreaterThan(mouse.yawRadians);
    expect(touch.yawRadians).toBeCloseTo(0.3, 10);
  });

  it("PT-025 keeps a realistic front-player look envelope", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    let state = createFirstPersonPlayerViewState(config);

    expect(config.yawLimitRadians).toBeCloseTo(Math.PI * 0.5, 10);
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
  });

  it("PT-026 stays in the front standing zone and cannot walk around either cabinet side", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    const sideGlassOuterX =
      M06_CABINET_CONFIG.interiorHalfX +
      M06_CABINET_CONFIG.wallHalfThickness * 2;

    let right = createFirstPersonPlayerViewState(config);
    for (let index = 0; index < 900; index += 1) {
      right = advanceFirstPersonPlayerView(
        right,
        { strafe: 1, forward: 1 },
        1 / 60,
        config,
      );
    }

    expect(right.x).toBeCloseTo(config.maxX, 10);
    expect(right.z).toBeCloseTo(config.minZ, 10);
    expect(Math.abs(right.x)).toBeLessThan(sideGlassOuterX);
    expect(right.z).toBeGreaterThan(config.cabinetFrontClearZ);

    let left = createFirstPersonPlayerViewState(config);
    for (let index = 0; index < 900; index += 1) {
      left = advanceFirstPersonPlayerView(
        left,
        { strafe: -1, forward: 1 },
        1 / 60,
        config,
      );
    }

    expect(left.x).toBeCloseTo(config.minX, 10);
    expect(left.z).toBeCloseTo(config.minZ, 10);
    expect(Math.abs(left.x)).toBeLessThan(sideGlassOuterX);
  });

  it("PT-025 allows only small front-position adjustment", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    let state = createFirstPersonPlayerViewState(config);

    for (let index = 0; index < 240; index += 1) {
      state = advanceFirstPersonPlayerView(
        state,
        { strafe: 1, forward: -1 },
        1 / 60,
        config,
      );
    }

    expect(state.x).toBe(config.maxX);
    expect(state.z).toBe(config.maxZ);
  });

  it("PT-025 can still look down at the control panel and chute from the front zone", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    const base = {
      ...createFirstPersonPlayerViewState(config),
      x: 0,
      z: config.maxZ,
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
