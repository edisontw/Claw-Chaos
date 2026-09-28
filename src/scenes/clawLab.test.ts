import { describe, expect, it } from "vitest";
import { advanceMotorCommand } from "./clawLab";

describe("M01 claw motor command", () => {
  it("moves toward the target at the configured angular speed", () => {
    expect(advanceMotorCommand(0, 1, 2, 0.1)).toBeCloseTo(0.2, 8);
    expect(advanceMotorCommand(0, -1, 2, 0.1)).toBeCloseTo(-0.2, 8);
  });

  it("does not overshoot the target", () => {
    expect(advanceMotorCommand(0.95, 1, 2, 0.1)).toBe(1);
    expect(advanceMotorCommand(-0.95, -1, 2, 0.1)).toBe(-1);
  });
});
