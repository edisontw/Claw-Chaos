import { describe, expect, it } from "vitest";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "../cabinet/cabinetGeometry";
import { isPrizeBelowChuteOpening } from "../cabinet/cabinetPlayableStock";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createCabinetLayout } from "../layouts/cabinetLayouts";
import { createPrize } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";
import { M10_STAFF_SERVICE_CONFIG } from "./staffServiceSequence";
import {
  M10_RESTOCK_CONFIG,
  createRestockPlan,
} from "./restockPlanner";

function setServiceDoorAngle(
  serviceDoorBody: ReturnType<
    typeof createCabinetPhysics
  >["serviceDoorBody"],
  closedCenter: {
    x: number;
    y: number;
    z: number;
  },
  angle: number,
): void {
  const c = M06_CABINET_CONFIG;
  const hinge = {
    x: c.interiorHalfX + c.wallHalfThickness,
    z:
      -c.interiorHalfZ -
      c.wallHalfThickness * 2,
  };
  const offsetX = closedCenter.x - hinge.x;
  const offsetZ = closedCenter.z - hinge.z;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  serviceDoorBody.setNextKinematicTranslation({
    x:
      hinge.x +
      offsetX * cos +
      offsetZ * sin,
    y: closedCenter.y,
    z:
      hinge.z -
      offsetX * sin +
      offsetZ * cos,
  });
  serviceDoorBody.setNextKinematicRotation({
    x: 0,
    y: Math.sin(angle * 0.5),
    z: 0,
    w: Math.cos(angle * 0.5),
  });
}

describe("M10 restock with the real service door", () => {
  it("keeps a full dense-layout refill inside when the door closes after insertion", async () => {
    const physics = await PhysicsRuntime.create();
    const cabinet = createCabinetPhysics(physics);
    const closedDoorCenter =
      cabinet.serviceDoorBody.translation();
    setServiceDoorAngle(
      cabinet.serviceDoorBody,
      closedDoorCenter,
      M10_STAFF_SERVICE_CONFIG.doorOpenRadians,
    );
    physics.step();

    const layout = createCabinetLayout(
      "dense",
      "m07-cabinet-lab-v1",
    );
    const prizePool = Array.from(
      new Set(
        layout.placements.map(
          (placement) => placement.prizeId,
        ),
      ),
    );
    const plan = createRestockPlan(
      layout.seed + ":service-0",
      layout.placements.length,
      prizePool,
    );

    const bodies: Array<{
      prizeId: string;
      body: ReturnType<typeof createPrize>["body"];
    }> = [];
    let nextIndex = 0;
    let sinceLastSpawn =
      M10_RESTOCK_CONFIG.insertionIntervalSeconds;
    let doorClosingSeconds = 0;

    for (
      let tick = 0;
      tick < PHYSICS_HZ * 10;
      tick += 1
    ) {
      sinceLastSpawn += 1 / PHYSICS_HZ;

      if (
        nextIndex < plan.length &&
        sinceLastSpawn >=
          M10_RESTOCK_CONFIG.insertionIntervalSeconds
      ) {
        const placement = plan[nextIndex]!;
        const prize = createPrize(
          physics,
          getPrizeDefinition(placement.prizeId),
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
            variantSeed: placement.variantSeed,
          },
        );
        bodies.push({
          prizeId: placement.prizeId,
          body: prize.body,
        });
        nextIndex += 1;
        sinceLastSpawn = 0;
      }

      if (nextIndex >= plan.length) {
        doorClosingSeconds += 1 / PHYSICS_HZ;
        const closeProgress = Math.min(
          1,
          doorClosingSeconds /
            M10_STAFF_SERVICE_CONFIG.doorClosingSeconds,
        );
        setServiceDoorAngle(
          cabinet.serviceDoorBody,
          closedDoorCenter,
          M10_STAFF_SERVICE_CONFIG.doorOpenRadians *
            (1 - closeProgress),
        );
      }

      physics.step();
    }

    expect(bodies).toHaveLength(plan.length);

    for (const entry of bodies) {
      const body = entry.body;
      const position = body.translation();
      const linear = body.linvel();
      const angular = body.angvel();

      console.log(
        "open-door restock final",
        entry.prizeId,
        position,
      );

      expect(position.x).toBeGreaterThan(
        -M06_CABINET_CONFIG.interiorHalfX + 0.01,
      );
      expect(position.x).toBeLessThan(
        M06_CABINET_CONFIG.interiorHalfX - 0.01,
      );
      expect(position.z).toBeGreaterThan(
        -M06_CABINET_CONFIG.interiorHalfZ + 0.01,
      );
      expect(position.z).toBeLessThan(
        M06_CABINET_CONFIG.interiorHalfZ - 0.01,
      );
      expect(position.y).toBeGreaterThan(
        M06_CABINET_CONFIG.playDeckY - 0.02,
      );
      expect(
        isPrizeBelowChuteOpening(position),
      ).toBe(false);
      expect(
        Math.hypot(linear.x, linear.y, linear.z),
      ).toBeLessThan(0.04);
      expect(
        Math.hypot(angular.x, angular.y, angular.z),
      ).toBeLessThan(0.45);
    }
  }, 25_000);
});
