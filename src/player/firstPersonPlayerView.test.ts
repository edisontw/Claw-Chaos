import { describe, expect, it } from "vitest";
import { M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";
import {
  M07_CAMERA_FOV_DEGREES,
  M07_MOBILE_CAMERA_FOV_DEGREES,
  M07_CABINET_VIEW_TARGETS,
  M07_FIRST_PERSON_VIEW_CONFIG,
  M07_MOBILE_FIRST_PERSON_VIEW_CONFIG,
  advanceFirstPersonPlayerView,
  applyFirstPersonDesktopDragDelta,
  applyFirstPersonLookDelta,
  applyFirstPersonTouchDragDelta,
  computeLookAnglesToPoint,
  createFirstPersonPlayerViewState,
  findFocusedPlayerViewTarget,
  playerCameraPosition,
} from "./firstPersonPlayerView";

describe("M07 first-person player view constraints", () => {
  it("uses drag-direction touch semantics", () => {
    const config = M07_MOBILE_FIRST_PERSON_VIEW_CONFIG;
    const initial = createFirstPersonPlayerViewState(config);

    const draggedRight = applyFirstPersonTouchDragDelta(
      initial,
      100,
      0,
      config,
    );
    const draggedDown = applyFirstPersonTouchDragDelta(
      initial,
      0,
      100,
      config,
    );

    // Dragging the scene right/down turns the camera left/up so the
    // visible scene follows the finger instead of moving opposite it.
    expect(draggedRight.yawRadians).toBeGreaterThan(
      initial.yawRadians,
    );
    expect(draggedDown.pitchRadians).toBeGreaterThan(
      initial.pitchRadians,
    );
  });

  it("uses the same content-drag direction on desktop", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    const initial = createFirstPersonPlayerViewState(config);

    const draggedRight = applyFirstPersonDesktopDragDelta(
      initial,
      100,
      0,
      config,
    );
    const draggedDown = applyFirstPersonDesktopDragDelta(
      initial,
      0,
      100,
      config,
    );

    expect(draggedRight.yawRadians).toBeGreaterThan(
      initial.yawRadians,
    );
    expect(draggedDown.pitchRadians).toBeGreaterThan(
      initial.pitchRadians,
    );
  });

  it("starts with a directly playable desktop framing", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    const state = createFirstPersonPlayerViewState(config);
    const eye = playerCameraPosition(state, config);
    const upperClawPoint = { x: 0, y: 1.05, z: 0 };
    const frontPrizeTopPoint = { x: 0, y: 0.37, z: 0.14 };
    const upper = computeLookAnglesToPoint(eye, upperClawPoint);
    const lower = computeLookAnglesToPoint(eye, frontPrizeTopPoint);
    const halfFovRadians =
      (M07_CAMERA_FOV_DEGREES * Math.PI / 180) * 0.5;

    expect(config.initialZ).toBe(0.78);
    expect(config.maxZ).toBe(0.84);
    expect(
      config.initialPitchRadians * 180 / Math.PI,
    ).toBeCloseTo(-19, 10);
    expect(
      Math.abs(upper.pitchRadians - state.pitchRadians),
    ).toBeLessThan(halfFovRadians);
    expect(
      Math.abs(lower.pitchRadians - state.pitchRadians),
    ).toBeLessThan(halfFovRadians);
  });

  it("uses a wider but still bounded mobile framing", () => {
    const desktop = M07_FIRST_PERSON_VIEW_CONFIG;
    const mobile = M07_MOBILE_FIRST_PERSON_VIEW_CONFIG;

    expect(M07_CAMERA_FOV_DEGREES).toBe(50);
    expect(M07_MOBILE_CAMERA_FOV_DEGREES).toBe(58);
    expect(mobile.initialZ).toBeGreaterThan(desktop.initialZ);
    expect(mobile.initialZ).toBe(0.84);
    expect(mobile.maxZ).toBe(0.90);

    const eye = playerCameraPosition(
      createFirstPersonPlayerViewState(mobile),
      mobile,
    );
    const upperClawPoint = { x: 0, y: 1.19, z: 0.02 };
    const prizeDeckPoint = { x: 0, y: 0.34, z: 0.02 };
    const upper = computeLookAnglesToPoint(eye, upperClawPoint);
    const lower = computeLookAnglesToPoint(eye, prizeDeckPoint);
    const requiredVerticalSpanDegrees =
      Math.abs(
        (upper.pitchRadians - lower.pitchRadians) *
          (180 / Math.PI),
      );

    expect(requiredVerticalSpanDegrees).toBeLessThan(
      M07_MOBILE_CAMERA_FOV_DEGREES,
    );
  });

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
