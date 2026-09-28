import { describe, expect, it } from "vitest";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  computeFingerPathLength,
  computeFingerTipSpan,
} from "./clawLab";

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

describe("M01 realistic three-prong geometry", () => {
  it("keeps the segmented finger near the documented quarter-meter path", () => {
    expect(computeFingerPathLength()).toBeCloseTo(0.246, 2);
  });

  it("opens to a broad span and closes near the center without scripted overlap", () => {
    const openSpan = computeFingerTipSpan(CLAW_LAB_CONFIG.openAngle);
    const closedSpan = computeFingerTipSpan(CLAW_LAB_CONFIG.closedAngle);

    expect(openSpan).toBeGreaterThan(0.34);
    expect(openSpan).toBeLessThan(0.36);
    expect(closedSpan).toBeGreaterThanOrEqual(0);
    expect(closedSpan).toBeLessThan(0.02);
    expect(openSpan).toBeGreaterThan(closedSpan * 15);
  });

  it("uses three curved-path segments rather than one straight finger bar", () => {
    expect(CLAW_LAB_CONFIG.fingerNodes).toHaveLength(4);
    expect(CLAW_LAB_CONFIG.fingerNodes[2]!.radial).toBeGreaterThan(
      CLAW_LAB_CONFIG.fingerNodes[3]!.radial,
    );
    expect(CLAW_LAB_CONFIG.fingerRodRadius * 2).toBeCloseTo(0.009, 6);
  });
});
