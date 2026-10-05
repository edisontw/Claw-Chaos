import { describe, expect, it } from "vitest";
import {
  SKINNED_STAFF_ASSET_PATH,
  SKINNED_STAFF_CHARACTER_VARIANT,
  SKINNED_STAFF_TARGET_HEIGHT_METERS,
  SKINNED_STAFF_TEXTURE_PATH,
  resolveSkinnedStaffAnimationClipName,
  resolveSkinnedStaffAnimationMode,
} from "./SkinnedArcadeStaffVisual";

describe("skinned arcade staff visual", () => {
  it("uses a local vendored character asset", () => {
    expect(SKINNED_STAFF_CHARACTER_VARIANT).toBe(
      "adult-female-arcade-attendant-v3-skinned",
    );
    expect(SKINNED_STAFF_TARGET_HEIGHT_METERS).toBeCloseTo(
      1.64,
    );
    expect(SKINNED_STAFF_ASSET_PATH).toBe(
      "assets/staff/quaternius-woman.gltf",
    );
    expect(SKINNED_STAFF_TEXTURE_PATH).toBe(
      "assets/staff/quaternius-woman.png",
    );
  });

  it("maps service phases to real skeletal animation clips", () => {
    expect(
      resolveSkinnedStaffAnimationMode("approaching"),
    ).toBe("walking");
    expect(
      resolveSkinnedStaffAnimationMode("departing"),
    ).toBe("walking");
    expect(
      resolveSkinnedStaffAnimationMode("opening_door"),
    ).toBe("service");
    expect(
      resolveSkinnedStaffAnimationMode("door_open"),
    ).toBe("service");
    expect(
      resolveSkinnedStaffAnimationMode("closing_door"),
    ).toBe("idle");
    expect(
      resolveSkinnedStaffAnimationMode("hidden"),
    ).toBe("idle");

    expect(
      resolveSkinnedStaffAnimationClipName("walking"),
    ).toBe("Walking");
    expect(
      resolveSkinnedStaffAnimationClipName("service"),
    ).toBe("PickUp");
    expect(
      resolveSkinnedStaffAnimationClipName("idle"),
    ).toBe("Idle");
  });
});
