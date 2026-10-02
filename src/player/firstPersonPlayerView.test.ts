import { describe, expect, it } from "vitest";
import { M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";
import {
  M07_FIRST_PERSON_VIEW_CONFIG,
  advanceFirstPersonPlayerView,
  applyFirstPersonLookDelta,
  createFirstPersonPlayerViewState,
} from "./firstPersonPlayerView";

describe("M07 first-person player view constraints", () => {
  it("PT-025 provides at least ±90 degrees of yaw with bounded pitch", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    let state = createFirstPersonPlayerViewState(config);

    expect(config.yawLimitRadians).toBeGreaterThanOrEqual(
      Math.PI * 0.5,
    );

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

  it("PT-025 allows small forward/back, lateral movement and lean", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    let state = createFirstPersonPlayerViewState(config);

    state = advanceFirstPersonPlayerView(
      state,
      { strafe: 1, forward: 1, lean: 1 },
      0.5,
      config,
    );

    expect(state.x).toBeGreaterThan(config.initialX);
    expect(state.z).toBeLessThan(config.initialZ);
    expect(state.leanMeters).toBeGreaterThan(0);

    for (let index = 0; index < 120; index += 1) {
      state = advanceFirstPersonPlayerView(
        state,
        { strafe: 0, forward: 0, lean: 1 },
        1 / 60,
        config,
      );
    }
    expect(state.leanMeters).toBeCloseTo(
      config.maxLeanMeters,
      10,
    );
  });

  it("PT-026 cannot free-fly or cross the front glass clearance", () => {
    const config = M07_FIRST_PERSON_VIEW_CONFIG;
    let state = createFirstPersonPlayerViewState(config);

    for (let index = 0; index < 600; index += 1) {
      state = advanceFirstPersonPlayerView(
        state,
        { strafe: 1, forward: 1, lean: 0 },
        1 / 60,
        config,
      );
    }

    const frontGlassOuterZ =
      M06_CABINET_CONFIG.interiorHalfZ +
      M06_CABINET_CONFIG.wallHalfThickness * 2;

    expect(state.x).toBe(config.maxX);
    expect(state.z).toBe(config.minZ);
    expect(state.z).toBeGreaterThan(frontGlassOuterZ);
    expect(config.eyeY).toBe(0.98);

    for (let index = 0; index < 600; index += 1) {
      state = advanceFirstPersonPlayerView(
        state,
        { strafe: -1, forward: -1, lean: 0 },
        1 / 60,
        config,
      );
    }

    expect(state.x).toBe(config.minX);
    expect(state.z).toBe(config.maxZ);
  });
});
