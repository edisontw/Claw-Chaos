import { describe, expect, it } from "vitest";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  computeFingerPathLength,
  computeFingerTipSpan,
  createFingerPoints,
  createFingerSegments,
  evaluatePt002Slip,
  evaluatePt003Rotation,
  evaluatePt004Hook,
  evaluatePt005BlockedFinger,
  evaluateOversizedClose,
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

  it("keeps a thin lower arm and limits an enlarged pad to the terminal length", () => {
    const points = createFingerPoints(0);
    const legacy = createFingerSegments(points, 0.010);
    const shortPad = createFingerSegments(points, 0.010, 0.012);

    expect(legacy).toHaveLength(3);
    expect(legacy[2]!.radius).toBeCloseTo(0.010, 8);

    expect(shortPad).toHaveLength(4);
    expect(shortPad[2]!.radius).toBeCloseTo(
      CLAW_LAB_CONFIG.fingerRodRadius,
      8,
    );
    expect(shortPad[3]!.radius).toBeCloseTo(0.010, 8);
    expect(shortPad[2]!.end).toEqual(shortPad[3]!.start);

    const terminalPad = shortPad[3]!;
    const terminalPadLength = Math.hypot(
      terminalPad.end.x - terminalPad.start.x,
      terminalPad.end.y - terminalPad.start.y,
      terminalPad.end.z - terminalPad.start.z,
    );
    expect(terminalPadLength).toBeCloseTo(0.012, 8);
    expect(terminalPad.end).toEqual(points.at(-1));
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
    expect(parseClawLabExperiment("?experiment=oversized")).toBe("oversized");
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
    expect(evaluatePt005BlockedFinger([0.15, 0.31, 0.30], 0)).toBe(true);
    expect(evaluatePt005BlockedFinger([0.24, 0.31, 0.30], 0)).toBe(false);
    expect(evaluatePt005BlockedFinger([0.15, 0.20, 0.30], 0)).toBe(false);
    expect(evaluatePt005BlockedFinger([0.29, 0.31, 0.30], 0)).toBe(false);
  });
});


describe("M01 oversized close acceptance helper", () => {
  it("requires all three fingers to lose substantial close travel relative to control", () => {
    expect(
      evaluateOversizedClose(
        [0.24, 0.24, 0.24],
        [0.05, 0.01, 0.01],
      ),
    ).toBe(true);

    expect(
      evaluateOversizedClose(
        [0.24, 0.24, 0.24],
        [0.20, 0.20, 0.20],
      ),
    ).toBe(false);

    expect(
      evaluateOversizedClose(
        [0.15, 0.15, 0.15],
        [0.01, 0.01, 0.01],
      ),
    ).toBe(false);
  });
});
