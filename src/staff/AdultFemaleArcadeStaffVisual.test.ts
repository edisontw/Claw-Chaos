import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DEFAULT_VISUAL_THEME } from "../theme/visualTheme";
import {
  STAFF_CHARACTER_HEIGHT_METERS,
  STAFF_CHARACTER_VARIANT,
  STAFF_CHARACTER_VISUAL_ONLY,
  createAdultFemaleArcadeStaffVisual,
} from "./AdultFemaleArcadeStaffVisual";

describe("Art Slice 4 adult female arcade staff visual", () => {
  it("is explicitly visual-only and replaceable by variant", () => {
    expect(STAFF_CHARACTER_VISUAL_ONLY).toBe(true);
    expect(STAFF_CHARACTER_VARIANT).toBe(
      "adult-female-arcade-attendant-v1",
    );
    expect(STAFF_CHARACTER_HEIGHT_METERS).toBeGreaterThan(1.5);
    expect(STAFF_CHARACTER_HEIGHT_METERS).toBeLessThan(1.8);
  });

  it("builds a named articulated rig without physics dependencies", () => {
    const rig = createAdultFemaleArcadeStaffVisual(
      DEFAULT_VISUAL_THEME.staff,
    );

    expect(rig.root).toBeInstanceOf(THREE.Group);
    expect(rig.root.userData.visualOnly).toBe(true);
    expect(rig.root.userData.characterVariant).toBe(
      STAFF_CHARACTER_VARIANT,
    );
    expect(rig.leftShoulder.name).toBe("staff-left-shoulder");
    expect(rig.rightShoulder.name).toBe("staff-right-shoulder");
    expect(rig.leftForearm.name).toBe("staff-left-forearm");
    expect(rig.rightForearm.name).toBe("staff-right-forearm");
    expect(rig.leftLeg.name).toBe("staff-left-leg");
    expect(rig.rightLeg.name).toBe("staff-right-leg");
    expect(rig.head.name).toBe("staff-head-rig");
  });

  it("contains recognizable professional uniform and face details", () => {
    const rig = createAdultFemaleArcadeStaffVisual(
      DEFAULT_VISUAL_THEME.staff,
    );
    const names: string[] = [];

    rig.root.traverse((object) => {
      if (object.name) {
        names.push(object.name);
      }
    });

    expect(names).toContain("staff-uniform-torso");
    expect(names).toContain("staff-blouse-front");
    expect(names).toContain("staff-apron-front");
    expect(names).toContain("staff-name-badge");
    expect(names).toContain("staff-neck-ribbon");
    expect(names).toContain("staff-hair-cap");
    expect(names).toContain("staff-ponytail");
    expect(names).toContain("staff-eye-left");
    expect(names).toContain("staff-eye-right");
    expect(names).toContain("staff-left-hand");
    expect(names).toContain("staff-right-hand");
  });

  it("keeps all rendered descendants tagged as visual-only", () => {
    const rig = createAdultFemaleArcadeStaffVisual(
      DEFAULT_VISUAL_THEME.staff,
    );
    const rendered: THREE.Object3D[] = [];
    rig.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        rendered.push(object);
      }
    });

    expect(rendered.length).toBeGreaterThan(20);
    expect(
      rendered.every(
        (object) => object.userData.visualOnly === true,
      ),
    ).toBe(true);
  });
});
