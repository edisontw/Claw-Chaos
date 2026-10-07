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

describe("stocked default layout startup safety", () => {
  it("settles a full physical prize floor without startup wins or cabinet escapes", async () => {
    const physics = await PhysicsRuntime.create();
    createCabinetPhysics(physics);

    const layout = createCabinetLayout(
      "stocked",
      DEFAULT_SCENE_SEED,
    );
    expect(layout.placements.length).toBeGreaterThanOrEqual(12);

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
      tick < PHYSICS_HZ * 5;
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

    for (const entry of prizes) {
      const position = entry.prize.body.translation();
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
      expect(Number.isFinite(position.z)).toBe(true);
      expect(Math.abs(position.x)).toBeLessThanOrEqual(
        M06_CABINET_CONFIG.interiorHalfX + 0.01,
      );
      expect(Math.abs(position.z)).toBeLessThanOrEqual(
        M06_CABINET_CONFIG.interiorHalfZ + 0.01,
      );
      expect(position.y).toBeGreaterThan(
        M06_CABINET_CONFIG.playDeckY - 0.04,
      );
    }
  }, 20_000);
});
