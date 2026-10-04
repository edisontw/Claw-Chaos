import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createPrize } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";

describe("M09 ring hook physics", () => {
  it("allows a finger-sized probe through the hole, then catches the inner rim on lateral motion", async () => {
    const physics = await PhysicsRuntime.create();

    physics.createStaticCuboid(
      { x: 0, y: -0.02, z: 0 },
      { x: 0.35, y: 0.02, z: 0.30 },
      0.82,
    );

    const definition = getPrizeDefinition("prize/ring_loop");
    const ring = createPrize(
      physics,
      definition,
      {
        position: {
          x: 0,
          y: definition.dimensions.y * 0.5 + 0.002,
          z: 0,
        },
        rotationYRadians: 0,
        variantSeed: "ring-hook-physics",
      },
    );

    const probe = physics.createKinematicCylinder(
      { x: 0, y: 0.060, z: 0 },
      0.055,
      0.009,
      0.55,
    );

    for (let tick = 0; tick < PHYSICS_HZ * 2; tick += 1) {
      physics.step();
    }

    const settled = ring.body.translation();
    const centeredOffset = Math.hypot(settled.x, settled.z);

    expect(centeredOffset).toBeLessThan(0.004);
    expect(settled.y).toBeGreaterThan(0.008);
    expect(settled.y).toBeLessThan(0.018);

    const travelTargetX = 0.060;
    const moveTicks = 60;
    for (let tick = 1; tick <= moveTicks; tick += 1) {
      const fraction = tick / moveTicks;
      probe.setNextKinematicTranslation({
        x: travelTargetX * fraction,
        y: 0.060,
        z: 0,
      });
      physics.step();
    }

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      physics.step();
    }

    const afterHook = ring.body.translation();
    const ringTravel = afterHook.x - settled.x;

    console.log(
      "M09 ring hook",
      JSON.stringify({
        centeredOffsetMeters: centeredOffset,
        settledHeightMeters: settled.y,
        probeTravelMeters: travelTargetX,
        ringTravelMeters: ringTravel,
      }),
    );

    expect(ringTravel).toBeGreaterThan(0.006);
  });
});
