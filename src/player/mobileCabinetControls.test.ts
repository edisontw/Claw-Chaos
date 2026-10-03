import { describe, expect, it } from "vitest";
import { normalizeVirtualJoystick } from "./mobileCabinetControls";

describe("mobile cabinet controls", () => {
  it("keeps joystick input inside the unit circle", () => {
    const centered = normalizeVirtualJoystick(0, 0, 50);
    expect(centered).toEqual({ x: 0, z: 0 });

    const right = normalizeVirtualJoystick(50, 0, 50);
    expect(right.x).toBeCloseTo(1, 10);
    expect(right.z).toBeCloseTo(0, 10);

    const up = normalizeVirtualJoystick(0, -50, 50);
    expect(up.x).toBeCloseTo(0, 10);
    expect(up.z).toBeCloseTo(-1, 10);

    const diagonal = normalizeVirtualJoystick(100, 100, 50);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1, 10);
    expect(diagonal.x).toBeGreaterThan(0);
    expect(diagonal.z).toBeGreaterThan(0);
  });

  it("handles invalid or tiny joystick radii safely", () => {
    const vector = normalizeVirtualJoystick(1, -1, 0);
    expect(Number.isFinite(vector.x)).toBe(true);
    expect(Number.isFinite(vector.z)).toBe(true);
    expect(Math.hypot(vector.x, vector.z)).toBeLessThanOrEqual(1);
  });
});
