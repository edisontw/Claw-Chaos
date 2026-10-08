import { describe, expect, it } from "vitest";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createPrize, resolvePrizeSpec } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";
import {
  cabinetPrizeDefinition,
  STOCKED_PRIZE_SIZE_MULTIPLIER,
  STOCKED_CAN_DIAMETER_MULTIPLIER,
  STOCKED_TALL_BOX_WIDTH_MULTIPLIER,
} from "./cabinetPrizeSizing";

describe("Stocked cabinet prize size upgrade", () => {
  it("enlarges the playable body while retaining the same nominal mass", () => {
    expect(STOCKED_PRIZE_SIZE_MULTIPLIER).toBeGreaterThan(1.10);
    expect(STOCKED_PRIZE_SIZE_MULTIPLIER).toBeLessThanOrEqual(1.15);
    for (const id of [
      "prize/cube_small",
      "prize/box_standard",
      "prize/cylinder_can",
      "prize/teddy_simple",
      "prize/pillow_small",
      "prize/animal_simple",
    ]) {
      const original = getPrizeDefinition(id);
      const enlarged = cabinetPrizeDefinition(original, "stocked");
      const horizontal = STOCKED_PRIZE_SIZE_MULTIPLIER *
        (id === "prize/cylinder_can"
          ? STOCKED_CAN_DIAMETER_MULTIPLIER
          : id === "prize/box_tall"
            ? STOCKED_TALL_BOX_WIDTH_MULTIPLIER
            : 1);
      expect(enlarged.dimensions.x).toBeCloseTo(
        original.dimensions.x * horizontal,
        8,
      );
      expect(enlarged.dimensions.y).toBeCloseTo(
        original.dimensions.y * STOCKED_PRIZE_SIZE_MULTIPLIER,
        8,
      );
      expect(enlarged.dimensions.z).toBeCloseTo(
        original.dimensions.z * horizontal,
        8,
      );
      expect(enlarged.nominalMassKg).toBe(original.nominalMassKg);
      expect(resolvePrizeSpec(enlarged).massKg).toBeCloseTo(
        resolvePrizeSpec(original).massKg,
        8,
      );
    }
  });

  it("gives stocked cans a real three-part raised-rim collider at constant mass", async () => {
    const physics = await PhysicsRuntime.create();
    const original = getPrizeDefinition("prize/cylinder_can");
    const stocked = cabinetPrizeDefinition(original, "stocked");
    const normalBody = createPrize(physics, original, {
      position: { x: -0.15, y: 0.7, z: 0 },
    });
    const stockedBody = createPrize(physics, stocked, {
      position: { x: 0.15, y: 0.7, z: 0 },
    });

    expect(stocked.colliderProfileId).toBe("cylinder/rimmed_v1");
    expect(original.colliderProfileId).toBe("cylinder/basic");
    expect(normalBody.body.numColliders()).toBe(1);
    expect(stockedBody.body.numColliders()).toBe(3);
    expect(stockedBody.body.mass()).toBeCloseTo(normalBody.body.mass(), 6);
    expect(stockedBody.resolved.centerOfMass.y).toBeCloseTo(
      original.dimensions.y *
        STOCKED_PRIZE_SIZE_MULTIPLIER *
        -0.15,
      8,
    );
    expect(stocked.dimensions.x).toBeGreaterThan(
      original.dimensions.x * STOCKED_PRIZE_SIZE_MULTIPLIER,
    );
  });

  it("retains all calibrated M09 layouts and the ring geometry", () => {
    const original = getPrizeDefinition("prize/box_standard");
    expect(cabinetPrizeDefinition(original, "loose")).toBe(original);
    expect(cabinetPrizeDefinition(original, "ring")).toBe(original);
    const ring = getPrizeDefinition("prize/ring_loop");
    expect(cabinetPrizeDefinition(ring, "stocked")).toBe(ring);
  });

  it("uses identical physical mass and friction profiles for enlarged bodies", async () => {
    const physics = await PhysicsRuntime.create();
    const original = getPrizeDefinition("prize/box_standard");
    const enlarged = cabinetPrizeDefinition(original, "stocked");
    const normalPrize = createPrize(physics, original, {
      position: { x: -0.2, y: 0.4, z: 0 },
    });
    const largerPrize = createPrize(physics, enlarged, {
      position: { x: 0.2, y: 0.4, z: 0 },
    });
    expect(largerPrize.body.mass()).toBeCloseTo(normalPrize.body.mass(), 6);
    expect(largerPrize.resolved.material.dynamicFriction).toBe(
      normalPrize.resolved.material.dynamicFriction,
    );
    expect(largerPrize.resolved.definition.dimensions.x).toBeGreaterThan(
      normalPrize.resolved.definition.dimensions.x,
    );
  });
});
