import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  PRIZE_COLOR_PALETTE,
  PRIZE_COM_PROFILES,
  PRIZE_DEFINITIONS,
  PRIZE_MASS_PROFILES,
  PRIZE_MATERIAL_PROFILES,
  getPrizeDefinition,
} from "./catalog";
import {
  createPrize,
  enumeratePrizeVisualVariants,
  resolvePrizeSpec,
} from "./PrizeFactory";

describe("M05 PrizeFactory", () => {
  it("exposes a data-driven starter catalog with reusable profiles", () => {
    expect(PRIZE_DEFINITIONS).toHaveLength(11);
    expect(new Set(PRIZE_DEFINITIONS.map((entry) => entry.id)).size).toBe(11);
    expect(Object.keys(PRIZE_COLOR_PALETTE)).toHaveLength(8);
    expect(Object.keys(PRIZE_MATERIAL_PROFILES).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(PRIZE_MASS_PROFILES)).toEqual(
      expect.arrayContaining(["mass/light", "mass/standard", "mass/heavy"]),
    );
    expect(Object.keys(PRIZE_COM_PROFILES)).toEqual(
      expect.arrayContaining([
        "com/centered",
        "com/bottom_heavy",
        "com/top_heavy",
        "com/left_offset",
        "com/right_offset",
      ]),
    );

    expect(new Set(PRIZE_DEFINITIONS.map((entry) => entry.shapeFamily))).toEqual(
      new Set([
        "cube",
        "box",
        "tall_box",
        "flat_box",
        "sphere",
        "ellipsoid",
        "cylinder",
        "capsule",
        "pillow",
        "plush_humanoid",
        "plush_animal",
      ]),
    );

    for (const definition of PRIZE_DEFINITIONS) {
      expect(definition.dimensions.x).toBeGreaterThan(0);
      expect(definition.dimensions.y).toBeGreaterThan(0);
      expect(definition.dimensions.z).toBeGreaterThan(0);
      expect(definition.nominalMassKg).toBeGreaterThan(0);
      expect(PRIZE_MATERIAL_PROFILES[definition.materialId]).toBeDefined();
      expect(PRIZE_MASS_PROFILES[definition.massProfileId]).toBeDefined();
      expect(PRIZE_COM_PROFILES[definition.comProfileId]).toBeDefined();
    }
  });

  it("enumerates at least 100 valid visible variants without one class per variant", () => {
    const variants = enumeratePrizeVisualVariants(PRIZE_DEFINITIONS);
    const keys = variants.map(
      (variant) =>
        `${variant.definitionId}|${variant.colorId}|${variant.finishId}`,
    );

    expect(variants).toHaveLength(11 * 8 * 2);
    expect(new Set(keys).size).toBe(variants.length);
    expect(variants.length).toBeGreaterThanOrEqual(100);
  });

  it("resolves deterministic variants and applies mass/COM profiles to Rapier mass properties", async () => {
    const definition = getPrizeDefinition("prize/box_standard");
    const first = resolvePrizeSpec(definition, {
      variantSeed: "m05-profile-test",
      massProfileId: "mass/light",
      comProfileId: "com/left_offset",
    });
    const second = resolvePrizeSpec(definition, {
      variantSeed: "m05-profile-test",
      massProfileId: "mass/light",
      comProfileId: "com/left_offset",
    });

    expect(second.variant).toEqual(first.variant);
    const lightProfile = PRIZE_MASS_PROFILES["mass/light"];
    expect(lightProfile).toBeDefined();
    if (!lightProfile) {
      throw new Error("mass/light profile missing");
    }
    expect(first.massKg).toBeCloseTo(
      definition.nominalMassKg * lightProfile.multiplier,
      8,
    );
    expect(first.centerOfMass.x).toBeLessThan(0);

    const physics = await PhysicsRuntime.create();
    physics.createStaticCuboid(
      { x: 0, y: -0.02, z: 0 },
      { x: 1, y: 0.02, z: 1 },
    );
    const prize = createPrize(physics, definition, {
      position: { x: 0, y: 0.25, z: 0 },
      variantSeed: "m05-profile-test",
      massProfileId: "mass/light",
      comProfileId: "com/left_offset",
    });

    const localCom = prize.body.localCom();
    expect(prize.body.mass()).toBeCloseTo(first.massKg, 6);
    expect(localCom.x).toBeCloseTo(first.centerOfMass.x, 6);
    expect(localCom.y).toBeCloseTo(first.centerOfMass.y, 6);
    expect(localCom.z).toBeCloseTo(first.centerOfMass.z, 6);
  });

  it("spawns all starter shapes as finite dynamic bodies that remain above the floor", async () => {
    const physics = await PhysicsRuntime.create();
    physics.createStaticCuboid(
      { x: 0, y: -0.025, z: 0 },
      { x: 1.2, y: 0.025, z: 1.2 },
    );

    const prizes = PRIZE_DEFINITIONS.map((definition, index) =>
      createPrize(physics, definition, {
        position: {
          x: -0.45 + (index % 4) * 0.30,
          y: 0.34,
          z: -0.30 + Math.floor(index / 4) * 0.30,
        },
        rotationYRadians: index * 0.17,
        variantSeed: `m05-shape-${index}`,
      }),
    );

    for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
      physics.step();
    }

    const metrics = prizes.map((prize) => {
      const position = prize.body.translation();
      const velocity = prize.body.linvel();
      return {
        id: prize.resolved.definition.id,
        position: { x: position.x, y: position.y, z: position.z },
        speed: Math.hypot(velocity.x, velocity.y, velocity.z),
      };
    });

    console.log("M05 starter prize metrics", JSON.stringify(metrics));

    expect(physics.dynamicBodyCount).toBe(PRIZE_DEFINITIONS.length);
    for (const metric of metrics) {
      expect(Number.isFinite(metric.position.x)).toBe(true);
      expect(Number.isFinite(metric.position.y)).toBe(true);
      expect(Number.isFinite(metric.position.z)).toBe(true);
      expect(metric.position.y).toBeGreaterThan(0.015);
      expect(metric.position.y).toBeLessThan(0.35);
      expect(metric.speed).toBeLessThan(0.20);
    }
  });
});
