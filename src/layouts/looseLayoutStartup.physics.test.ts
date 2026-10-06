import { describe, expect, it } from "vitest";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "../cabinet/cabinetGeometry";
import { ChuteSensor } from "../cabinet/chuteSensor";
import {
  DEFAULT_SCENE_SEED,
  PHYSICS_HZ,
} from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createPrize } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";
import { createCabinetLayout } from "./cabinetLayouts";

describe("default loose layout startup safety", () => {
  it("does not drop a prize through the chute during initial physical settling", async () => {
    const physics = await PhysicsRuntime.create();
    createCabinetPhysics(physics);

    const layout = createCabinetLayout(
      "loose",
      DEFAULT_SCENE_SEED,
    );
    const sensor = new ChuteSensor();
    const prizes = layout.placements.map(
      (placement, index) => {
        const definition = getPrizeDefinition(
          placement.prizeId,
        );
        const prize = createPrize(
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
            rotationXRadians:
              placement.rotationXRadians,
            rotationYRadians:
              placement.rotationYRadians,
            variantSeed: placement.variantSeed,
          },
        );

        return {
          id: placement.prizeId + "#" + index,
          prize,
        };
      },
    );

    const startupWins: string[] = [];

    for (
      let tick = 0;
      tick < PHYSICS_HZ * 4;
      tick += 1
    ) {
      physics.step();

      for (const entry of prizes) {
        if (
          sensor.pollPrize(
            entry.id,
            entry.prize.body,
          )
        ) {
          startupWins.push(entry.id);
        }
      }
    }

    expect(startupWins).toEqual([]);
  }, 15_000);
});
