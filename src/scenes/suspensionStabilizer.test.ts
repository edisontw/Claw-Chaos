import { describe, expect, it } from "vitest";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

const config = {
  stiffness: 55,
  damping: 8.5,
  maxForce: 4,
};

describe("M02 suspension stabilizer", () => {
  it("pushes an offset hub back toward the carriage centerline", () => {
    const impulse = computeSuspensionStabilizerImpulse(
      {
        anchorX: 0,
        anchorZ: 0,
        anchorVelocityX: 0,
        anchorVelocityZ: 0,
        hubX: 0.02,
        hubZ: -0.01,
        hubVelocityX: 0,
        hubVelocityZ: 0,
      },
      config,
      1 / 120,
    );

    expect(impulse.x).toBeLessThan(0);
    expect(impulse.z).toBeGreaterThan(0);
  });

  it("damps relative horizontal velocity even at zero offset", () => {
    const impulse = computeSuspensionStabilizerImpulse(
      {
        anchorX: 0,
        anchorZ: 0,
        anchorVelocityX: 0.3,
        anchorVelocityZ: 0,
        hubX: 0,
        hubZ: 0,
        hubVelocityX: 0.45,
        hubVelocityZ: 0,
      },
      config,
      1 / 120,
    );

    expect(impulse.x).toBeLessThan(0);
    expect(impulse.z).toBe(0);
  });

  it("limits the applied corrective force", () => {
    const dt = 1 / 120;
    const impulse = computeSuspensionStabilizerImpulse(
      {
        anchorX: 0,
        anchorZ: 0,
        anchorVelocityX: 0,
        anchorVelocityZ: 0,
        hubX: 1,
        hubZ: 1,
        hubVelocityX: 10,
        hubVelocityZ: 10,
      },
      config,
      dt,
    );

    expect(Math.hypot(impulse.x, impulse.z)).toBeLessThanOrEqual(
      config.maxForce * dt + 1e-12,
    );
  });
});
