import { describe, expect, it } from "vitest";
import {
  REALISTIC_STAFF_ASSET_PATH,
  REALISTIC_STAFF_CHARACTER_VARIANT,
  REALISTIC_STAFF_DRACO_PATH,
  REALISTIC_STAFF_TARGET_HEIGHT_METERS,
  RealisticArcadeStaffVisual,
} from "./RealisticArcadeStaffVisual";

describe("realistic arcade staff visual", () => {
  it("targets the optimized local desktop asset", () => {
    expect(REALISTIC_STAFF_CHARACTER_VARIANT).toBe(
      "adult-female-arcade-attendant-v4-realistic-rigged",
    );
    expect(
      REALISTIC_STAFF_TARGET_HEIGHT_METERS,
    ).toBeCloseTo(1.64);
    expect(REALISTIC_STAFF_ASSET_PATH).toBe(
      "assets/staff/arcade-attendant-realistic.glb",
    );
    expect(REALISTIC_STAFF_DRACO_PATH).toBe(
      "assets/draco/",
    );
  });

  it("stays visual-only and supports an explicit lightweight fallback", () => {
    const visual =
      new RealisticArcadeStaffVisual(false);

    expect(visual.root.name).toBe(
      REALISTIC_STAFF_CHARACTER_VARIANT,
    );
    expect(visual.root.userData.visualOnly).toBe(
      true,
    );
    expect(visual.status).toBe("fallback");
  });
});
