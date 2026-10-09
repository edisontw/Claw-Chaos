import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createHighFidelityPrizeVisual } from "./highFidelityVisuals";
import { getPrizeDefinition } from "./catalog";
import { resolvePrizeSpec } from "./PrizeFactory";

describe("Everyday gift and plush merchandise", () => {
  const products = [
    { id: "prize/box_tall", model: "retail-gift-ribbon-v1", marker: "gift-bow-loop-1" },
    { id: "prize/box_flat", model: "retail-gift-ribbon-v1", marker: "gift-bow-loop-1" },
    { id: "prize/pillow_small", model: "embroidered-plush-cushion-v1", marker: "cushion-embroidered-smile" },
    { id: "prize/animal_simple", model: "soft-animal-face-paws-v1", marker: "animal-nose" },
  ] as const;

  it("provides identifiable product details instead of primitive shapes", () => {
    for (const product of products) {
      const spec = resolvePrizeSpec(getPrizeDefinition(product.id), {
        variantSeed: "merchandise-identity",
      });
      const visual = createHighFidelityPrizeVisual(spec);
      expect(visual).not.toBeNull();
      expect(visual!.userData.prizeVisualFidelity).toBe("high-v1");
      expect(visual!.userData.prizeVisualModel).toBe(product.model);
      expect(visual!.getObjectByName(product.marker)).toBeDefined();
      expect(visual!.children.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("keeps decorative visuals inside a reasonable physical envelope", () => {
    for (const product of products) {
      const spec = resolvePrizeSpec(getPrizeDefinition(product.id), {
        variantSeed: "merchandise-physical-bounds",
      });
      const visual = createHighFidelityPrizeVisual(spec)!;
      const size = new THREE.Box3().setFromObject(visual)
        .getSize(new THREE.Vector3());
      const d = spec.definition.dimensions;
      const tolerance = product.id === "prize/animal_simple" ? 1.28 : 1.14;
      expect(size.x).toBeLessThan(d.x * tolerance);
      expect(size.y).toBeLessThan(d.y * tolerance);
      expect(size.z).toBeLessThan(d.z * tolerance);
      expect(spec.massKg).toBeGreaterThan(0);
    }
  });
});
