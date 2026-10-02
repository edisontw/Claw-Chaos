import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { getPrizeDefinition } from "../prizes/catalog";
import { createPrize } from "../prizes/PrizeFactory";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "./cabinetGeometry";
import { CabinetResultInventoryState } from "./cabinetResultState";
import { ChuteSensor } from "./chuteSensor";

describe("M06 cabinet result/inventory handoff", () => {
  it("consumes the same sensor event and prize exactly once", () => {
    const state = new CabinetResultInventoryState();
    const event = {
      prizeId: "prize/sphere_ball#1",
      sequence: 7,
    };

    expect(state.consume(event)).toEqual({
      prizeId: "prize/sphere_ball#1",
      sensorSequence: 7,
      resultSequence: 1,
      inventoryCount: 1,
    });
    expect(state.consume(event)).toBeNull();
    expect(
      state.consume({
        prizeId: "prize/sphere_ball#1",
        sequence: 8,
      }),
    ).toBeNull();

    expect(state.resultCount).toBe(1);
    expect(state.inventoryCount).toBe(1);
    expect(state.hasPrize("prize/sphere_ball#1")).toBe(true);
    expect(state.lastResult?.prizeId).toBe("prize/sphere_ball#1");
  });

  it("hands a physical PT-018 chute event into result/inventory state once", async () => {
    const physics = await PhysicsRuntime.create();
    createCabinetPhysics(physics);

    const sensor = new ChuteSensor();
    const state = new CabinetResultInventoryState();
    const prize = createPrize(
      physics,
      getPrizeDefinition("prize/cube_small"),
      {
        position: {
          x: M06_CABINET_CONFIG.chuteCenterX,
          y: M06_CABINET_CONFIG.playDeckY + 0.30,
          z: M06_CABINET_CONFIG.chuteCenterZ,
        },
        rotationYRadians: 0,
        variantSeed: "m06-result-handoff",
      },
    );

    let emittedEvents = 0;
    let acceptedResults = 0;

    for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
      physics.step();
      const event = sensor.pollPrize("m06-result-cube", prize.body);
      if (!event) {
        continue;
      }

      emittedEvents += 1;
      if (state.consume(event)) {
        acceptedResults += 1;
      }
      expect(state.consume(event)).toBeNull();
    }

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      physics.step();
      const event = sensor.pollPrize("m06-result-cube", prize.body);
      if (event && state.consume(event)) {
        acceptedResults += 1;
      }
    }

    expect(emittedEvents).toBe(1);
    expect(acceptedResults).toBe(1);
    expect(sensor.winCount).toBe(1);
    expect(state.resultCount).toBe(1);
    expect(state.inventoryCount).toBe(1);
    expect(state.hasPrize("m06-result-cube")).toBe(true);
    expect(state.lastResult).toEqual({
      prizeId: "m06-result-cube",
      sensorSequence: 1,
      resultSequence: 1,
      inventoryCount: 1,
    });
  });
});
