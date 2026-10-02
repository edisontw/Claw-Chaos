import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { getPrizeDefinition } from "../prizes/catalog";
import { createPrize } from "../prizes/PrizeFactory";
import { M02_GANTRY_CONFIG } from "../scenes/gantryLab";
import {
  M06_CABINET_CONFIG,
  createCabinetPartDefinitions,
  createCabinetPhysics,
} from "./cabinetGeometry";
import { ChuteSensor } from "./chuteSensor";

describe("M06 cabinet boundaries", () => {
  it("keeps the closed M02 gantry travel envelope inside the cabinet play area", () => {
    const c = M06_CABINET_CONFIG;

    expect(
      M02_GANTRY_CONFIG.xMin - M02_GANTRY_CONFIG.carriageHalfX,
    ).toBeGreaterThan(-c.interiorHalfX);
    expect(
      M02_GANTRY_CONFIG.xMax + M02_GANTRY_CONFIG.carriageHalfX,
    ).toBeLessThan(c.interiorHalfX);
    expect(
      M02_GANTRY_CONFIG.zMin - M02_GANTRY_CONFIG.carriageHalfZ,
    ).toBeGreaterThan(-c.interiorHalfZ);
    expect(
      M02_GANTRY_CONFIG.zMax + M02_GANTRY_CONFIG.carriageHalfZ,
    ).toBeLessThan(c.interiorHalfZ);

    const parts = createCabinetPartDefinitions();
    expect(parts.filter((part) => part.role === "glass")).toHaveLength(3);
    expect(parts.some((part) => part.role === "ceiling")).toBe(true);
    expect(parts.filter((part) => part.role === "floor")).toHaveLength(4);
    expect(
      parts.filter((part) => part.role === "play_deck"),
    ).toHaveLength(4);
    expect(
      parts.filter((part) => part.role === "chute_wall"),
    ).toHaveLength(4);
  });

  it("physically contains prizes pushed into the cabinet walls", async () => {
    const physics = await PhysicsRuntime.create();
    createCabinetPhysics(physics);

    const definition = getPrizeDefinition("prize/sphere_ball");
    const cases = [
      {
        position: { x: -0.10, y: M06_CABINET_CONFIG.playDeckY + 0.13, z: -0.16 },
        velocity: { x: 1.6, y: 0, z: 0 },
      },
      {
        position: { x: 0.10, y: M06_CABINET_CONFIG.playDeckY + 0.13, z: -0.08 },
        velocity: { x: -1.6, y: 0, z: 0 },
      },
      {
        position: { x: -0.20, y: M06_CABINET_CONFIG.playDeckY + 0.13, z: -0.10 },
        velocity: { x: 0, y: 0, z: 1.6 },
      },
      {
        position: { x: 0.00, y: M06_CABINET_CONFIG.playDeckY + 0.13, z: 0.00 },
        velocity: { x: 0, y: 0, z: -1.6 },
      },
    ];

    const prizes = cases.map((entry, index) => {
      const prize = createPrize(physics, definition, {
        position: entry.position,
        variantSeed: `m06-boundary-${index}`,
      });
      prize.body.setLinvel(entry.velocity, true);
      return prize;
    });

    let maxAbsX = 0;
    let maxAbsZ = 0;
    let finiteAndBounded = true;

    for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
      physics.step();
      for (const prize of prizes) {
        const position = prize.body.translation();
        maxAbsX = Math.max(maxAbsX, Math.abs(position.x));
        maxAbsZ = Math.max(maxAbsZ, Math.abs(position.z));
        finiteAndBounded =
          finiteAndBounded &&
          Number.isFinite(position.x) &&
          Number.isFinite(position.y) &&
          Number.isFinite(position.z) &&
          Math.abs(position.x) < 0.50 &&
          Math.abs(position.z) < 0.40 &&
          position.y > -0.34 &&
          position.y <
            M06_CABINET_CONFIG.playAreaHeight + 0.04;
      }
    }

    console.log(
      "M06 cabinet containment metrics",
      JSON.stringify({ maxAbsX, maxAbsZ, finiteAndBounded }),
    );

    expect(finiteAndBounded).toBe(true);
    expect(maxAbsX).toBeLessThan(
      M06_CABINET_CONFIG.interiorHalfX,
    );
    expect(maxAbsZ).toBeLessThan(
      M06_CABINET_CONFIG.interiorHalfZ,
    );
  });
});

describe("Cabinet realism geometry", () => {
  it("uses the common left-side enlarged prize chute layout", () => {
    const c = M06_CABINET_CONFIG;

    expect(c.chuteCenterX).toBeLessThan(0);
    expect(c.chuteOpeningHalfX * 2).toBeGreaterThanOrEqual(0.24);
    expect(c.chuteOpeningHalfZ * 2).toBeGreaterThanOrEqual(0.18);
    expect(
      c.chuteCenterX - c.chuteOpeningHalfX,
    ).toBeGreaterThan(-c.interiorHalfX);
    expect(
      c.chuteCenterX + c.chuteOpeningHalfX,
    ).toBeLessThan(c.interiorHalfX);
  });
});

describe("M06 chute sensor", () => {
  it("PT-017 does not award a prize resting across the chute lip", async () => {
    const physics = await PhysicsRuntime.create();
    createCabinetPhysics(physics);
    const sensor = new ChuteSensor();

    const prize = createPrize(
      physics,
      getPrizeDefinition("prize/box_flat"),
      {
        position: {
          x:
            M06_CABINET_CONFIG.chuteCenterX +
            M06_CABINET_CONFIG.chuteOpeningHalfX +
            0.04,
          y: M06_CABINET_CONFIG.playDeckY + 0.09,
          z: M06_CABINET_CONFIG.chuteCenterZ,
        },
        rotationYRadians: 0,
        variantSeed: "pt017-lip",
      },
    );

    let eventCount = 0;
    let minCenterOfMassY = Number.POSITIVE_INFINITY;

    for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
      physics.step();
      const event = sensor.pollPrize("pt017-flat-box", prize.body);
      if (event) {
        eventCount += 1;
      }
      minCenterOfMassY = Math.min(
        minCenterOfMassY,
        prize.body.worldCom().y,
      );
    }

    const finalPosition = prize.body.translation();
    console.log(
      "PT-017 chute-lip metrics",
      JSON.stringify({
        eventCount,
        sensorWins: sensor.winCount,
        minCenterOfMassY,
        finalPosition: {
          x: finalPosition.x,
          y: finalPosition.y,
          z: finalPosition.z,
        },
      }),
    );

    expect(eventCount).toBe(0);
    expect(sensor.winCount).toBe(0);
    expect(sensor.hasRecordedPrize("pt017-flat-box")).toBe(false);
    expect(minCenterOfMassY).toBeGreaterThan(
      M06_CABINET_CONFIG.chuteSensorCenterY +
        M06_CABINET_CONFIG.chuteSensorHalfY,
    );
    expect(finalPosition.y).toBeGreaterThan(
      M06_CABINET_CONFIG.playDeckY + 0.015,
    );
  });

  it("PT-018 awards exactly once after a prize physically falls through the chute sensor", async () => {
    const physics = await PhysicsRuntime.create();
    createCabinetPhysics(physics);
    const sensor = new ChuteSensor();

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
        variantSeed: "pt018-win",
      },
    );

    const events = [];
    let firstEventTick: number | null = null;

    for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
      physics.step();
      const event = sensor.pollPrize("pt018-cube", prize.body);
      if (event) {
        events.push(event);
        firstEventTick ??= tick;
      }
    }

    const finalPosition = prize.body.translation();
    console.log(
      "PT-018 chute-win metrics",
      JSON.stringify({
        eventCount: events.length,
        sensorWins: sensor.winCount,
        firstEventTick,
        firstEventSeconds:
          firstEventTick === null ? null : firstEventTick / PHYSICS_HZ,
        finalPosition: {
          x: finalPosition.x,
          y: finalPosition.y,
          z: finalPosition.z,
        },
      }),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      prizeId: "pt018-cube",
      sequence: 1,
    });
    expect(sensor.winCount).toBe(1);
    expect(sensor.hasRecordedPrize("pt018-cube")).toBe(true);
    expect(firstEventTick).not.toBeNull();
    expect(finalPosition.y).toBeLessThan(-0.20);

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      physics.step();
      expect(sensor.pollPrize("pt018-cube", prize.body)).toBeNull();
    }
    expect(sensor.winCount).toBe(1);
  });
});
