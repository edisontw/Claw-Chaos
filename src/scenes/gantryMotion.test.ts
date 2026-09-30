import { describe, expect, it } from "vitest";
import {
  advanceGantryAxis,
  advanceGantryAxisTowardPosition,
  advanceGantryMotion,
  isGantryAxisAtTarget,
} from "./gantryMotion";

const config = {
  minPosition: -0.3,
  maxPosition: 0.3,
  maxSpeed: 0.45,
  acceleration: 1.35,
  braking: 3.5,
};

describe("M02 gantry axis motion", () => {
  it("accelerates toward commanded speed and brakes without teleporting", () => {
    let state = { position: 0, velocity: 0 };
    const dt = 1 / 120;

    for (let tick = 0; tick < 60; tick += 1) {
      const previous = state;
      state = advanceGantryAxis(state, 1, config, dt);
      expect(state.position - previous.position).toBeLessThanOrEqual(
        config.maxSpeed * dt + 1e-9,
      );
    }

    expect(state.position).toBeGreaterThan(0.05);
    expect(state.velocity).toBeGreaterThan(0.3);
    expect(state.velocity).toBeLessThanOrEqual(config.maxSpeed);

    for (let tick = 0; tick < 60; tick += 1) {
      state = advanceGantryAxis(state, 0, config, dt);
    }

    expect(Math.abs(state.velocity)).toBeLessThan(1e-9);
  });

  it("advances X and Z independently from the same fixed-step controller", () => {
    const motionConfig = {
      x: config,
      z: {
        ...config,
        minPosition: -0.24,
        maxPosition: 0.24,
      },
    };
    const state = advanceGantryMotion(
      {
        x: { position: 0, velocity: 0 },
        z: { position: 0, velocity: 0 },
      },
      1,
      -1,
      motionConfig,
      1 / 120,
    );

    expect(state.x.velocity).toBeGreaterThan(0);
    expect(state.z.velocity).toBeLessThan(0);
    expect(state.x.position).toBeGreaterThan(0);
    expect(state.z.position).toBeLessThan(0);
  });

  it("returns toward a target with braking-aware speed and no teleport", () => {
    let state = { position: 0.24, velocity: 0.18 };
    const dt = 1 / 120;
    let maxStep = 0;

    for (let tick = 0; tick < 360; tick += 1) {
      const previous = state;
      state = advanceGantryAxisTowardPosition(state, 0, config, dt);
      maxStep = Math.max(maxStep, Math.abs(state.position - previous.position));

      if (
        isGantryAxisAtTarget(
          state,
          0,
          { position: 0.002, velocity: 0.02 },
        )
      ) {
        break;
      }
    }

    expect(maxStep).toBeLessThanOrEqual(config.maxSpeed * dt + 1e-9);
    expect(Math.abs(state.position)).toBeLessThanOrEqual(0.002);
    expect(Math.abs(state.velocity)).toBeLessThanOrEqual(0.02);
  });

  it("stops cleanly at rail limits", () => {
    let state = { position: 0.295, velocity: 0.4 };

    for (let tick = 0; tick < 30; tick += 1) {
      state = advanceGantryAxis(state, 1, config, 1 / 120);
    }

    expect(state.position).toBe(config.maxPosition);
    expect(state.velocity).toBe(0);
  });
});
