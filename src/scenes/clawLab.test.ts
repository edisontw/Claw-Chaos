import { describe, expect, it } from "vitest";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  computeFingerPathLength,
  computeFingerTipSpan,
  evaluatePt002Slip,
  evaluatePt003Rotation,
  evaluatePt004Hook,
  evaluatePt005BlockedFinger,
  parseClawLabExperiment,
  quaternionAngleFromIdentity,
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


describe("M01 claw-lab experiment selection", () => {
  it("keeps PT-001 as default and selects PT-002 explicitly", () => {
    expect(parseClawLabExperiment("")).toBe("pt001");
    expect(parseClawLabExperiment("?experiment=pt001")).toBe("pt001");
    expect(parseClawLabExperiment("?experiment=pt002")).toBe("pt002");
    expect(parseClawLabExperiment("?experiment=pt003")).toBe("pt003");
    expect(parseClawLabExperiment("?experiment=pt004")).toBe("pt004");
    expect(parseClawLabExperiment("?experiment=pt005")).toBe("pt005");
    expect(parseClawLabExperiment("?experiment=unknown")).toBe("pt001");
  });

  it("requires an initial lift followed by measurable slip for PT-002", () => {
    expect(evaluatePt002Slip(0.08, 0.01)).toBe(true);
    expect(evaluatePt002Slip(0.02, -0.02)).toBe(false);
    expect(evaluatePt002Slip(0.08, 0.06)).toBe(false);
    expect(evaluatePt002Slip(0.08, 0.04)).toBe(false);
  });
});


describe("PT-003 rotation helpers", () => {
  it("converts a quaternion to angular displacement from identity", () => {
    const halfAngle = 0.2;
    expect(
      quaternionAngleFromIdentity({
        x: 0,
        y: Math.sin(halfAngle),
        z: 0,
        w: Math.cos(halfAngle),
      }),
    ).toBeCloseTo(0.4, 8);
  });

  it("requires meaningful box rotation", () => {
    expect(evaluatePt003Rotation(0.2)).toBe(true);
    expect(evaluatePt003Rotation(0.05)).toBe(false);
  });
});


describe("PT-004 hook acceptance helper", () => {
  it("requires lift, asymmetric hanging and rotation together", () => {
    expect(evaluatePt004Hook(0.05, 0.3, -0.08)).toBe(true);
    expect(evaluatePt004Hook(0.01, 0.3, -0.08)).toBe(false);
    expect(evaluatePt004Hook(0.05, 0.05, -0.08)).toBe(false);
    expect(evaluatePt004Hook(0.05, 0.3, -0.01)).toBe(false);
  });
});


describe("PT-005 blocked-finger acceptance helper", () => {
  it("requires one finger to remain clearly behind two independently closing fingers", () => {
    expect(evaluatePt005BlockedFinger([0.40, 0.75, 0.74], 0)).toBe(true);
    expect(evaluatePt005BlockedFinger([0.62, 0.75, 0.74], 0)).toBe(false);
    expect(evaluatePt005BlockedFinger([0.40, 0.50, 0.74], 0)).toBe(false);
    expect(evaluatePt005BlockedFinger([0.70, 0.71, 0.72], 0)).toBe(false);
  });
});
