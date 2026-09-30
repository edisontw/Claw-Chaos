import { describe, expect, it } from "vitest";
import { advanceReel } from "./reelMotion";

const config = {
  minPayout: 0,
  maxPayout: 0.28,
  maxSpeed: 0.28,
  acceleration: 0.9,
  braking: 1.4,
};

describe("M02 reel motion", () => {
  it("accelerates payout without discontinuous cable-length jumps", () => {
    let state = { payout: 0, velocity: 0 };
    const dt = 1 / 120;

    for (let tick = 0; tick < 90; tick += 1) {
      const previous = state;
      state = advanceReel(state, 1, config, dt);

      expect(state.payout).toBeGreaterThanOrEqual(previous.payout);
      expect(state.payout - previous.payout).toBeLessThanOrEqual(
        config.maxSpeed * dt + 1e-9,
      );
    }

    expect(state.payout).toBeGreaterThan(0.1);
    expect(state.velocity).toBeGreaterThan(0);
  });

  it("brakes into both reel limits without high-energy clipping", () => {
    let state = { payout: 0, velocity: 0 };
    const dt = 1 / 120;

    for (let tick = 0; tick < 300; tick += 1) {
      state = advanceReel(state, 1, config, dt);
    }

    expect(state.payout).toBeCloseTo(config.maxPayout, 5);
    expect(state.velocity).toBeCloseTo(0, 5);

    for (let tick = 0; tick < 300; tick += 1) {
      state = advanceReel(state, -1, config, dt);
    }

    expect(state.payout).toBeCloseTo(config.minPayout, 5);
    expect(state.velocity).toBeCloseTo(0, 5);
  });

  it("brakes smoothly when the command is released mid-travel", () => {
    let state = { payout: 0, velocity: 0 };
    const dt = 1 / 120;

    for (let tick = 0; tick < 60; tick += 1) {
      state = advanceReel(state, 1, config, dt);
    }

    const releasePayout = state.payout;
    const releaseSpeed = state.velocity;

    for (let tick = 0; tick < 60; tick += 1) {
      state = advanceReel(state, 0, config, dt);
    }

    expect(state.payout).toBeGreaterThan(releasePayout);
    expect(state.velocity).toBeCloseTo(0, 8);
    expect(releaseSpeed).toBeGreaterThan(0);
  });
});
