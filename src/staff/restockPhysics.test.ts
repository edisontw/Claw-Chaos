import { describe, expect, it } from "vitest";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "../cabinet/cabinetGeometry";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { getPrizeDefinition } from "../prizes/catalog";
import { createPrize } from "../prizes/PrizeFactory";
import {
  M10_RESTOCK_CONFIG,
  createRestockPlan,
} from "./restockPlanner";

describe("M10 physical restock settle", () => {
  it("drops seeded replacement stock into a stable non-chute pile", async () => {
    const physics = await PhysicsRuntime.create();
    createCabinetPhysics(physics);

    const plan = createRestockPlan(
      "physics-settle",
      4,
      [
        "prize/cube_small",
        "prize/teddy_simple",
        "prize/pillow_small",
        "prize/sphere_ball",
      ],
    );
    const bodies: ReturnType<
      typeof createPrize
    >["body"][] = [];
    let nextIndex = 0;
    let sinceLastSpawn: number =
      M10_RESTOCK_CONFIG.insertionIntervalSeconds;

    for (
      let tick = 0;
      tick < PHYSICS_HZ * 6;
      tick += 1
    ) {
      sinceLastSpawn += 1 / PHYSICS_HZ;
      if (
        nextIndex < plan.length &&
        sinceLastSpawn >=
          M10_RESTOCK_CONFIG.insertionIntervalSeconds
      ) {
        const placement = plan[nextIndex];
        if (placement) {
          const prize = createPrize(
            physics,
            getPrizeDefinition(
              placement.prizeId,
            ),
            {
              position: {
                x: placement.x,
                y: placement.y,
                z: placement.z,
              },
              rotationXRadians:
                placement.rotationXRadians,
              rotationYRadians:
                placement.rotationYRadians,
              variantSeed:
                placement.variantSeed,
            },
          );
          bodies.push(prize.body);
        }
        nextIndex += 1;
        sinceLastSpawn = 0;
      }

      physics.step();
    }

    expect(bodies).toHaveLength(plan.length);

    for (const body of bodies) {
      const position = body.translation();
      const linear = body.linvel();
      const angular = body.angvel();

      expect(position.x).toBeGreaterThan(
        -M06_CABINET_CONFIG.interiorHalfX,
      );
      expect(position.x).toBeLessThan(
        M06_CABINET_CONFIG.interiorHalfX,
      );
      expect(position.z).toBeGreaterThan(
        -M06_CABINET_CONFIG.interiorHalfZ,
      );
      expect(position.z).toBeLessThan(
        M06_CABINET_CONFIG.interiorHalfZ,
      );
      expect(position.y).toBeGreaterThan(
        M06_CABINET_CONFIG.playDeckY - 0.02,
      );
      expect(
        Math.hypot(
          linear.x,
          linear.y,
          linear.z,
        ),
      ).toBeLessThan(0.03);
      expect(
        Math.hypot(
          angular.x,
          angular.y,
          angular.z,
        ),
      ).toBeLessThan(0.35);
    }
  }, 20_000);
});
