import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  ARCADE_CEILING_FIXTURES,
  ARCADE_CEILING_HEIGHT_METERS,
  ARCADE_ENVIRONMENT_VARIANT,
  ARCADE_ENVIRONMENT_VISUAL_ONLY,
  ARCADE_NEIGHBOR_MACHINE_PLACEMENTS,
  addArcadeEnvironment,
  applyArcadeEnvironmentDetail,
  arcadeEnvironmentId,
} from "./arcadeEnvironment";
import { DEFAULT_VISUAL_THEME } from "../theme/visualTheme";

describe("Art Slice 3 arcade environment", () => {
  it("is explicitly visual-only", () => {
    expect(ARCADE_ENVIRONMENT_VISUAL_ONLY).toBe(true);
    expect(ARCADE_ENVIRONMENT_VARIANT).toBe(
      "prize-center-room-v1",
    );
    expect(
      arcadeEnvironmentId(DEFAULT_VISUAL_THEME),
    ).toBe(
      "modern-japanese-arcade:prize-center-room-v1",
    );
  });

  it("builds a visual-only room graph without physics dependencies", () => {
    const scene = new THREE.Scene();
    const root = addArcadeEnvironment(
      scene,
      DEFAULT_VISUAL_THEME,
    );
    expect(root.name).toBe(
      "modern-japanese-arcade:prize-center-room-v1",
    );
    expect(root.userData.visualOnly).toBe(true);
    expect(scene.children).toContain(root);
    expect(root.children.length).toBeGreaterThan(10);
  });

  it("can reduce and restore decorative background detail at runtime", () => {
    const scene = new THREE.Scene();
    const root = addArcadeEnvironment(
      scene,
      DEFAULT_VISUAL_THEME,
      "full",
    );

    applyArcadeEnvironmentDetail(root, "reduced");
    expect(root.userData.backgroundDetail).toBe("reduced");
    expect(
      root.getObjectByName("theme-a-neighbor-left-near")
        ?.visible,
    ).toBe(true);
    expect(
      root.getObjectByName("theme-a-neighbor-left-far")
        ?.visible,
    ).toBe(false);
    expect(
      root.getObjectByName("theme-a-prize-display-left")
        ?.visible,
    ).toBe(false);

    applyArcadeEnvironmentDetail(root, "full");
    expect(
      root.getObjectByName("theme-a-neighbor-left-far")
        ?.visible,
    ).toBe(true);
    expect(
      root.getObjectByName("theme-a-prize-display-left")
        ?.visible,
    ).toBe(true);
  });

  it("uses a minimal background tier for weak GPUs", () => {
    const scene = new THREE.Scene();
    const root = addArcadeEnvironment(
      scene,
      DEFAULT_VISUAL_THEME,
      "minimal",
    );

    expect(
      root.getObjectByName("theme-a-neighbor-left-near")
        ?.visible,
    ).toBe(false);
    expect(
      root.getObjectByName("theme-a-prize-display-right")
        ?.visible,
    ).toBe(false);

    for (const fixture of ARCADE_CEILING_FIXTURES) {
      expect(
        root.getObjectByName(
          `theme-a-${fixture.id}-shell`,
        )?.visible,
      ).toBe(false);
      expect(
        root.getObjectByName(
          `theme-a-${fixture.id}-diffuser`,
        )?.visible,
      ).toBe(false);
    }
  });

  it("keeps neighboring machines outside the player movement lane", () => {
    for (const machine of ARCADE_NEIGHBOR_MACHINE_PLACEMENTS) {
      expect(Math.abs(machine.x)).toBeGreaterThanOrEqual(1.0);
      expect(machine.scale).toBeGreaterThanOrEqual(0.85);
      expect(machine.scale).toBeLessThanOrEqual(1.05);
    }
  });

  it("keeps ceiling fixtures above the adjustable player eye height", () => {
    expect(ARCADE_CEILING_HEIGHT_METERS).toBeGreaterThan(1.10);
    expect(ARCADE_CEILING_FIXTURES.length).toBeGreaterThanOrEqual(6);
  });
});
