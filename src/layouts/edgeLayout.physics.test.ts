import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "../cabinet/cabinetGeometry";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createPrize } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";
import { M02_GANTRY_CONFIG } from "../scenes/gantryLab";
import { createCabinetLayout } from "./cabinetLayouts";

describe("M09 edge layout physics", () => {
  it("settles outside direct carriage-center reach and can be nudged back into the playable interior", async () => {
    const physics = await PhysicsRuntime.create();
    createCabinetPhysics(physics);

    const layout = createCabinetLayout(
      "edge",
      "physics-regression",
    );

    const spawned = layout.placements.map((placement) => {
      const definition = getPrizeDefinition(placement.prizeId);
      return {
        placement,
        prize: createPrize(
          physics,
          definition,
          {
            position: {
              x: placement.x,
              y:
                M06_CABINET_CONFIG.playDeckY +
                definition.dimensions.y * 0.5 +
                placement.yOffsetMeters,
              z: placement.z,
            },
            rotationYRadians: placement.rotationYRadians,
            variantSeed: placement.variantSeed,
          },
        ),
      };
    });

    for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
      physics.step();
    }

    const sideTarget = spawned.find(
      (entry) =>
        entry.placement.role === "edge_target" &&
        entry.placement.prizeId === "prize/box_standard",
    );
    const backTarget = spawned.find(
      (entry) =>
        entry.placement.role === "edge_target" &&
        entry.placement.prizeId === "prize/cylinder_can",
    );

    expect(sideTarget).toBeDefined();
    expect(backTarget).toBeDefined();

    const sideBefore = sideTarget!.prize.body.translation();
    const backBefore = backTarget!.prize.body.translation();

    expect(sideBefore.x).toBeGreaterThan(
      M02_GANTRY_CONFIG.xMax + 0.045,
    );
    expect(backBefore.z).toBeLessThan(
      M02_GANTRY_CONFIG.zMin - 0.035,
    );
    expect(sideBefore.x).toBeLessThan(
      M06_CABINET_CONFIG.interiorHalfX,
    );
    expect(backBefore.z).toBeGreaterThan(
      -M06_CABINET_CONFIG.interiorHalfZ,
    );

    sideTarget!.prize.body.applyImpulse(
      { x: -0.050, y: 0, z: 0 },
      true,
    );
    backTarget!.prize.body.applyImpulse(
      { x: 0, y: 0, z: 0.040 },
      true,
    );

    for (let tick = 0; tick < PHYSICS_HZ * 2; tick += 1) {
      physics.step();
    }

    const sideAfter = sideTarget!.prize.body.translation();
    const backAfter = backTarget!.prize.body.translation();
    const sideInwardTravel = sideBefore.x - sideAfter.x;
    const backInwardTravel = backAfter.z - backBefore.z;

    console.log(
      "M09 edge manipulation",
      JSON.stringify({
        sideBeforeX: sideBefore.x,
        sideAfterX: sideAfter.x,
        sideInwardTravelMeters: sideInwardTravel,
        backBeforeZ: backBefore.z,
        backAfterZ: backAfter.z,
        backInwardTravelMeters: backInwardTravel,
      }),
    );

    expect(sideInwardTravel).toBeGreaterThan(0.006);
    expect(backInwardTravel).toBeGreaterThan(0.006);
  });
});
