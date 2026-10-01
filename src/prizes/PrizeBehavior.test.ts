import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  PRIZE_DEFINITIONS,
  getPrizeDefinition,
} from "./catalog";
import { createPrize } from "./PrizeFactory";

function quaternionAngleFromIdentity(rotation: {
  x: number;
  y: number;
  z: number;
  w: number;
}): number {
  const normalizedW = Math.min(1, Math.max(-1, Math.abs(rotation.w)));
  return 2 * Math.acos(normalizedW);
}

async function simulateMaterialSlide(materialId: string): Promise<{
  distanceMeters: number;
  finalSpeedMetersPerSecond: number;
}> {
  const physics = await PhysicsRuntime.create();
  physics.createStaticCuboid(
    { x: 0, y: -0.025, z: 0 },
    { x: 1.5, y: 0.025, z: 0.5 },
    0.75,
  );

  const prize = createPrize(
    physics,
    getPrizeDefinition("prize/box_standard"),
    {
      position: { x: -0.65, y: 0.12, z: 0 },
      materialId,
      massProfileId: "mass/standard",
      comProfileId: "com/centered",
      variantSeed: `pt021-${materialId}`,
    },
  );

  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    physics.step();
  }

  const startX = prize.body.translation().x;
  prize.body.setLinvel({ x: 1.20, y: 0, z: 0 }, true);

  for (let tick = 0; tick < PHYSICS_HZ * 2; tick += 1) {
    physics.step();
  }

  const position = prize.body.translation();
  const velocity = prize.body.linvel();

  return {
    distanceMeters: position.x - startX,
    finalSpeedMetersPerSecond: Math.hypot(
      velocity.x,
      velocity.y,
      velocity.z,
    ),
  };
}

async function simulateComImpulse(comProfileId: string): Promise<{
  rotationRadians: number;
  peakAngularSpeedRadiansPerSecond: number;
  localComX: number;
}> {
  const physics = await PhysicsRuntime.create();
  const prize = createPrize(
    physics,
    getPrizeDefinition("prize/box_standard"),
    {
      position: { x: 0, y: 1.2, z: 0 },
      materialId: "material/plastic",
      massProfileId: "mass/standard",
      comProfileId,
      variantSeed: `pt022-${comProfileId}`,
    },
  );

  const point = prize.body.translation();
  prize.body.applyImpulseAtPoint(
    { x: 0, y: 0, z: 0.025 },
    { x: point.x, y: point.y, z: point.z },
    true,
  );

  let peakAngularSpeedRadiansPerSecond = 0;
  for (let tick = 0; tick < Math.round(PHYSICS_HZ * 0.25); tick += 1) {
    physics.step();
    const angularVelocity = prize.body.angvel();
    peakAngularSpeedRadiansPerSecond = Math.max(
      peakAngularSpeedRadiansPerSecond,
      Math.hypot(
        angularVelocity.x,
        angularVelocity.y,
        angularVelocity.z,
      ),
    );
  }

  return {
    rotationRadians: quaternionAngleFromIdentity(prize.body.rotation()),
    peakAngularSpeedRadiansPerSecond,
    localComX: prize.body.localCom().x,
  };
}

describe("M05 prize behavior differentiation", () => {
  it("PT-021 produces a measurable slide difference from material friction alone", async () => {
    const plastic = await simulateMaterialSlide("material/plastic");
    const rubber = await simulateMaterialSlide("material/rubber");

    console.log(
      "PT-021 material slide metrics",
      JSON.stringify({ plastic, rubber }),
    );

    expect(plastic.distanceMeters).toBeGreaterThan(rubber.distanceMeters);
    expect(
      plastic.distanceMeters - rubber.distanceMeters,
    ).toBeGreaterThan(0.02);
    expect(plastic.finalSpeedMetersPerSecond).toBeLessThan(0.05);
    expect(rubber.finalSpeedMetersPerSecond).toBeLessThan(0.05);
  });

  it("PT-022 produces rotation from an offset COM under the same center impulse", async () => {
    const centered = await simulateComImpulse("com/centered");
    const offset = await simulateComImpulse("com/left_offset");

    console.log(
      "PT-022 COM impulse metrics",
      JSON.stringify({ centered, offset }),
    );

    expect(Math.abs(centered.localComX)).toBeLessThan(1e-8);
    expect(offset.localComX).toBeLessThan(-0.01);
    expect(centered.peakAngularSpeedRadiansPerSecond).toBeLessThan(0.01);
    expect(offset.peakAngularSpeedRadiansPerSecond).toBeGreaterThan(0.50);
    expect(offset.rotationRadians).toBeGreaterThan(0.10);
    expect(
      offset.rotationRadians - centered.rotationRadians,
    ).toBeGreaterThan(0.08);
  });
});

describe("M05 dense pile stability", () => {
  it("PT-015 settles a 12-prize contact pile and remains stable for 60 simulated seconds", async () => {
    const physics = await PhysicsRuntime.create();
    physics.createStaticCuboid(
      { x: 0, y: -0.025, z: 0 },
      { x: 0.42, y: 0.025, z: 0.34 },
      0.82,
    );
    physics.createStaticCuboid(
      { x: -0.43, y: 0.18, z: 0 },
      { x: 0.01, y: 0.20, z: 0.35 },
      0.75,
    );
    physics.createStaticCuboid(
      { x: 0.43, y: 0.18, z: 0 },
      { x: 0.01, y: 0.20, z: 0.35 },
      0.75,
    );
    physics.createStaticCuboid(
      { x: 0, y: 0.18, z: -0.35 },
      { x: 0.44, y: 0.20, z: 0.01 },
      0.75,
    );
    physics.createStaticCuboid(
      { x: 0, y: 0.18, z: 0.35 },
      { x: 0.44, y: 0.20, z: 0.01 },
      0.75,
    );

    const definitions = [
      ...PRIZE_DEFINITIONS,
      getPrizeDefinition("prize/box_standard"),
    ];
    const positions = [
      { x: -0.17, y: 0.13, z: -0.08 },
      { x: -0.06, y: 0.15, z: 0.07 },
      { x: 0.06, y: 0.14, z: -0.07 },
      { x: 0.17, y: 0.16, z: 0.08 },
      { x: -0.14, y: 0.31, z: 0.06 },
      { x: -0.04, y: 0.33, z: -0.06 },
      { x: 0.07, y: 0.32, z: 0.05 },
      { x: 0.16, y: 0.34, z: -0.05 },
      { x: -0.10, y: 0.49, z: -0.03 },
      { x: 0.00, y: 0.51, z: 0.04 },
      { x: 0.11, y: 0.50, z: -0.04 },
      { x: 0.02, y: 0.66, z: 0.01 },
    ];

    const prizes = definitions.map((definition, index) =>
      createPrize(physics, definition, {
        position: positions[index]!,
        rotationYRadians: index * 0.31,
        variantSeed: `pt015-${index}`,
      }),
    );

    let settledTick: number | null = null;
    for (let tick = 0; tick < PHYSICS_HZ * 20; tick += 1) {
      physics.step();
      if (
        tick > PHYSICS_HZ * 2 &&
        prizes.every((prize) => prize.body.isSleeping())
      ) {
        settledTick = tick;
        break;
      }
    }

    expect(settledTick).not.toBeNull();
    if (settledTick === null) {
      throw new Error("12-prize pile did not reach sleep");
    }

    const settledPositions = prizes.map((prize) => {
      const position = prize.body.translation();
      return { x: position.x, y: position.y, z: position.z };
    });

    let maxPostSettleDriftMeters = 0;
    let maxPostSettleSpeedMetersPerSecond = 0;
    let finiteAndBounded = true;

    for (let tick = 0; tick < PHYSICS_HZ * 60; tick += 1) {
      physics.step();

      for (let index = 0; index < prizes.length; index += 1) {
        const prize = prizes[index]!;
        const baseline = settledPositions[index]!;
        const position = prize.body.translation();
        const velocity = prize.body.linvel();

        finiteAndBounded =
          finiteAndBounded &&
          Number.isFinite(position.x) &&
          Number.isFinite(position.y) &&
          Number.isFinite(position.z) &&
          Math.abs(position.x) < 1 &&
          position.y > -0.1 &&
          position.y < 1 &&
          Math.abs(position.z) < 1;

        maxPostSettleDriftMeters = Math.max(
          maxPostSettleDriftMeters,
          Math.hypot(
            position.x - baseline.x,
            position.y - baseline.y,
            position.z - baseline.z,
          ),
        );
        maxPostSettleSpeedMetersPerSecond = Math.max(
          maxPostSettleSpeedMetersPerSecond,
          Math.hypot(velocity.x, velocity.y, velocity.z),
        );
      }
    }

    const finalSleeping = prizes.filter(
      (prize) => prize.body.isSleeping(),
    ).length;

    console.log(
      "PT-015 dense pile metrics",
      JSON.stringify({
        prizeCount: prizes.length,
        settleSeconds: settledTick / PHYSICS_HZ,
        maxPostSettleDriftMeters,
        maxPostSettleSpeedMetersPerSecond,
        finalSleeping,
        finiteAndBounded,
      }),
    );

    expect(finiteAndBounded).toBe(true);
    expect(maxPostSettleDriftMeters).toBeLessThan(0.002);
    expect(maxPostSettleSpeedMetersPerSecond).toBeLessThan(0.02);
    expect(finalSleeping).toBe(prizes.length);
  }, 15_000);
});
