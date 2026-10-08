import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  createPrize,
  resolvePrizeSpec,
} from "./PrizeFactory";
import { getPrizeDefinition } from "./catalog";
import {
  HIGH_FIDELITY_PRIZE_VISUAL_IDS,
  createHighFidelityPrizeVisual,
} from "./highFidelityVisuals";

function visualSize(object: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(object);
  return box.getSize(new THREE.Vector3());
}

describe("Art Slice 7 high-fidelity prize visuals", () => {
  it("builds detailed visual models for the selected common prize types", () => {
    const expectations = [
      {
        id: "prize/box_standard",
        model: "packaged-box-rounded-v1",
        minChildren: 6,
      },
      {
        id: "prize/cylinder_can",
        model: "prize-can-rim-tab-v1",
        minChildren: 7,
      },
      {
        id: "prize/teddy_simple",
        model: "teddy-detailed-face-v1",
        minChildren: 15,
      },
    ] as const;

    expect(HIGH_FIDELITY_PRIZE_VISUAL_IDS).toEqual(
      expectations.map((entry) => entry.id),
    );

    for (const entry of expectations) {
      const definition = getPrizeDefinition(entry.id);
      const spec = resolvePrizeSpec(definition, {
        variantSeed: "art-slice-7-visual",
      });
      const visual = createHighFidelityPrizeVisual(spec);

      expect(visual).not.toBeNull();
      expect(visual!.userData.prizeVisualFidelity).toBe(
        "high-v1",
      );
      expect(visual!.userData.prizeVisualModel).toBe(
        entry.model,
      );
      expect(visual!.children.length).toBeGreaterThanOrEqual(
        entry.minChildren,
      );
    }
  });

  it("keeps detailed visuals close to the existing physical prize envelope", () => {
    for (const id of HIGH_FIDELITY_PRIZE_VISUAL_IDS) {
      const definition = getPrizeDefinition(id);
      const spec = resolvePrizeSpec(definition, {
        variantSeed: "art-slice-7-bounds",
      });
      const visual = createHighFidelityPrizeVisual(spec)!;
      const size = visualSize(visual);

      const tolerance =
        id === "prize/teddy_simple" ? 1.28 : 1.08;
      expect(size.x).toBeLessThanOrEqual(
        definition.dimensions.x * tolerance,
      );
      expect(size.y).toBeLessThanOrEqual(
        definition.dimensions.y * tolerance,
      );
      expect(size.z).toBeLessThanOrEqual(
        definition.dimensions.z * tolerance,
      );
    }
  });

  it("leaves unsupported prize families on the existing visual fallback", () => {
    const definition = getPrizeDefinition(
      "prize/sphere_ball",
    );
    const spec = resolvePrizeSpec(definition, {
      variantSeed: "art-slice-7-fallback",
    });

    expect(createHighFidelityPrizeVisual(spec)).toBeNull();
  });

  it("routes PrizeFactory output through the detailed visual layer without changing physics metadata", async () => {
    const physics = await PhysicsRuntime.create();

    for (const id of HIGH_FIDELITY_PRIZE_VISUAL_IDS) {
      const definition = getPrizeDefinition(id);
      const expected = resolvePrizeSpec(definition, {
        variantSeed: "art-slice-7-integration",
      });
      const prize = createPrize(physics, definition, {
        position: { x: 0, y: 0.4, z: 0 },
        variantSeed: "art-slice-7-integration",
      });

      expect(
        prize.renderObject.userData.prizeVisualFidelity,
      ).toBe("high-v1");
      expect(prize.resolved.massKg).toBeCloseTo(
        expected.massKg,
        8,
      );
      expect(prize.resolved.centerOfMass).toEqual(
        expected.centerOfMass,
      );
      expect(prize.resolved.definition.colliderProfileId).toBe(
        definition.colliderProfileId,
      );
    }
  });
});
