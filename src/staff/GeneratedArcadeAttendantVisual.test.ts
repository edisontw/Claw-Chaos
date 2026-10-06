import { describe, expect, it } from "vitest";
import {
  GENERATED_STAFF_ASSET_PATH,
  GENERATED_STAFF_CHARACTER_VARIANT,
  GENERATED_STAFF_OCCLUSION_POLICY,
  GENERATED_STAFF_RENDER_ORDER,
  GENERATED_STAFF_TARGET_HEIGHT_METERS,
  GeneratedArcadeAttendantVisual,
} from "./GeneratedArcadeAttendantVisual";

describe("generated arcade attendant visual", () => {
  it("uses the photorealistic camera-facing cutout at human scale", () => {
    expect(GENERATED_STAFF_CHARACTER_VARIANT).toBe(
      "adult-female-arcade-attendant-image-billboard-v1",
    );
    expect(GENERATED_STAFF_ASSET_PATH).toBe(
      "assets/staff/arcade-attendant-cutout.webp",
    );
    expect(GENERATED_STAFF_TARGET_HEIGHT_METERS).toBeCloseTo(
      1.64,
    );

    const visual = new GeneratedArcadeAttendantVisual();
    expect(visual.root.userData.visualOnly).toBe(true);
    expect(visual.root.userData.occlusionPolicy).toBe(
      GENERATED_STAFF_OCCLUSION_POLICY,
    );
    expect(GENERATED_STAFF_RENDER_ORDER).toBeGreaterThan(100);
    expect(visual.root.visible).toBe(false);
    expect(visual.status).toBe("fallback");
  });
});
