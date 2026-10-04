import { describe, expect, it } from "vitest";
import { CABINET_PLAY_TUNING } from "../cabinet/cabinetPlayTuning";
import { createCabinetLayout } from "../layouts/cabinetLayouts";
import {
  CLAW_LAB_CONFIG,
  computeFingerTipSpan,
} from "../scenes/clawLab";
import { M02_GANTRY_CONFIG } from "../scenes/gantryLab";
import {
  createRingLoopGeometry,
  RING_LOOP_PROFILE,
} from "./ringProfile";

describe("M09 ring loop geometry", () => {
  it("creates a closed 12-segment capsule loop with a true center opening", () => {
    const geometry = createRingLoopGeometry();

    expect(geometry.colliders).toHaveLength(
      RING_LOOP_PROFILE.segmentCount,
    );
    expect(geometry.points).toHaveLength(
      RING_LOOP_PROFILE.segmentCount,
    );
    expect(geometry.innerHalfX).toBeGreaterThan(0.07);
    expect(geometry.innerHalfZ).toBeGreaterThan(0.06);
  });

  it("gives the production open claw a practical one-finger entry window", () => {
    const geometry = createRingLoopGeometry();
    const layout = createCabinetLayout(
      "ring",
      "production-claw-entry",
    );
    const target = layout.placements.find(
      (placement) => placement.role === "ring_target",
    )!;
    const padRadius =
      CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters;

    // A tilted loop looks narrower from above. This is the available
    // centerline corridor for a vertical 20 mm production finger pad
    // after subtracting the real pad radius on both sides.
    const projectedMinorHalf =
      geometry.innerHalfZ *
      Math.cos(Math.abs(target.rotationXRadians));
    const usableProjectedMinorWidth =
      2 * (projectedMinorHalf - padRadius);

    expect(usableProjectedMinorWidth).toBeGreaterThanOrEqual(
      0.080,
    );

    // The player hooks with one open prong, not by fitting all three
    // prongs through the loop. Verify that at least two real 120-degree
    // prong approach positions can place a tip over the target while
    // keeping the carriage inside the production gantry envelope.
    const openTipRadius =
      computeFingerTipSpan(CLAW_LAB_CONFIG.openAngle) * 0.5;
    const viableApproaches = [0, 1, 2].filter((index) => {
      const theta = index * (Math.PI * 2 / 3);
      const carriageX =
        target.x - Math.cos(theta) * openTipRadius;
      const carriageZ =
        target.z - Math.sin(theta) * openTipRadius;

      return (
        carriageX >= M02_GANTRY_CONFIG.xMin &&
        carriageX <= M02_GANTRY_CONFIG.xMax &&
        carriageZ >= M02_GANTRY_CONFIG.zMin &&
        carriageZ <= M02_GANTRY_CONFIG.zMax
      );
    });

    expect(viableApproaches.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the physical outer bounds aligned with the catalog dimensions", () => {
    const geometry = createRingLoopGeometry();

    expect(
      geometry.centerlineRadiusX + RING_LOOP_PROFILE.tubeRadius,
    ).toBeCloseTo(RING_LOOP_PROFILE.outerHalfX, 10);
    expect(
      geometry.centerlineRadiusZ + RING_LOOP_PROFILE.tubeRadius,
    ).toBeCloseTo(RING_LOOP_PROFILE.outerHalfZ, 10);
  });

  it("leaves enough central clearance for an existing claw finger pad", () => {
    const geometry = createRingLoopGeometry();
    const clawPadRadiusMeters = 0.010;

    expect(geometry.innerHalfX).toBeGreaterThan(
      clawPadRadiusMeters * 4,
    );
    expect(geometry.innerHalfZ).toBeGreaterThan(
      clawPadRadiusMeters * 3,
    );
  });
});
