import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  GENERATED_STAFF_ASSET_PATH,
  GENERATED_STAFF_ASSET_PATHS,
  GENERATED_STAFF_CHARACTER_VARIANT,
  GENERATED_STAFF_OCCLUSION_POLICY,
  GENERATED_STAFF_RENDER_ORDER,
  GENERATED_STAFF_TARGET_HEIGHT_METERS,
  GeneratedArcadeAttendantVisual,
  createGeneratedStaffSpriteMaterial,
  pickRandomGeneratedStaffAssetIndex,
  pickRandomGeneratedStaffLoadedIndex,
} from "./GeneratedArcadeAttendantVisual";

describe("generated arcade attendant visual", () => {
  it("uses the eight photorealistic camera-facing cutouts at human scale", () => {
    expect(GENERATED_STAFF_CHARACTER_VARIANT).toBe(
      "adult-female-arcade-attendant-image-billboard-v1",
    );
    expect(GENERATED_STAFF_ASSET_PATHS).toHaveLength(8);
    expect(GENERATED_STAFF_ASSET_PATH).toBe(
      "assets/staff/arcade-attendant-01.webp",
    );
    expect(GENERATED_STAFF_ASSET_PATHS[7]).toBe(
      "assets/staff/arcade-attendant-08.webp",
    );
    expect(GENERATED_STAFF_TARGET_HEIGHT_METERS).toBeCloseTo(
      1.64,
    );

    const visual = new GeneratedArcadeAttendantVisual();
    expect(visual.root.userData.visualOnly).toBe(true);
    expect(visual.root.userData.occlusionPolicy).toBe(
      GENERATED_STAFF_OCCLUSION_POLICY,
    );
    expect(GENERATED_STAFF_RENDER_ORDER).toBeGreaterThan(0);
    expect(GENERATED_STAFF_RENDER_ORDER).toBeLessThan(100);

    const material =
      createGeneratedStaffSpriteMaterial(
        new THREE.Texture(),
      );
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.transparent).toBe(true);
    expect(material.toneMapped).toBe(false);

    expect(visual.root.visible).toBe(false);
    expect(visual.status).toBe("fallback");
  });

  it("chooses a random staff asset without immediately repeating the active one", () => {
    expect(
      pickRandomGeneratedStaffAssetIndex(-1, () => 0),
    ).toBe(0);
    expect(
      pickRandomGeneratedStaffAssetIndex(0, () => 0),
    ).toBe(1);
    expect(
      pickRandomGeneratedStaffAssetIndex(4, () => 0.999),
    ).toBe(7);
    expect(
      pickRandomGeneratedStaffAssetIndex(7, () => 0.999),
    ).toBe(6);
  });

  it("switches only among already-loaded staff textures", () => {
    expect(
      pickRandomGeneratedStaffLoadedIndex([], 2, () => 0),
    ).toBe(-1);
    expect(
      pickRandomGeneratedStaffLoadedIndex(
        [1, 4, 6],
        4,
        () => 0,
      ),
    ).toBe(1);
    expect(
      pickRandomGeneratedStaffLoadedIndex(
        [1, 4, 6],
        4,
        () => 0.999,
      ),
    ).toBe(6);
    expect(
      pickRandomGeneratedStaffLoadedIndex(
        [4],
        4,
        () => 0.5,
      ),
    ).toBe(4);
  });
});
