import { describe, expect, it } from "vitest";
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
    expect(geometry.innerHalfX).toBeGreaterThan(0.05);
    expect(geometry.innerHalfZ).toBeGreaterThan(0.04);
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
