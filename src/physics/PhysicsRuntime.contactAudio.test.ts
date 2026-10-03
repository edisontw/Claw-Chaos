import { describe, expect, it } from "vitest";
import { PhysicsRuntime } from "./PhysicsRuntime";

describe("M08 contact audio events", () => {
  it("emits one material impact when a tagged prize lands", async () => {
    const physics = await PhysicsRuntime.create();

    physics.createStaticCuboid(
      { x: 0, y: -0.025, z: 0 },
      { x: 0.5, y: 0.025, z: 0.5 },
    );

    physics.createDynamicBodyWithMassProperties(
      { x: 0, y: 0.30, z: 0 },
      [
        {
          shape: "sphere",
          radius: 0.05,
        },
      ],
      {
        massKg: 0.10,
        centerOfMass: { x: 0, y: 0, z: 0 },
        principalAngularInertia: {
          x: 0.0001,
          y: 0.0001,
          z: 0.0001,
        },
      },
      {
        friction: 0.6,
        restitution: 0.03,
        contactAudioProfileId: "audio/plush",
      },
    );

    for (let index = 0; index < 180; index += 1) {
      physics.step();
    }

    const impacts = physics.consumeContactAudioImpacts();
    expect(impacts.length).toBeGreaterThan(0);
    expect(
      impacts.some(
        (impact) =>
          impact.audioProfileId === "audio/plush" &&
          impact.forceNewtons >= 1.5,
      ),
    ).toBe(true);

    expect(physics.consumeContactAudioImpacts()).toEqual([]);
  });

  it("does not emit contact audio for untagged dynamic bodies", async () => {
    const physics = await PhysicsRuntime.create();

    physics.createStaticCuboid(
      { x: 0, y: -0.025, z: 0 },
      { x: 0.5, y: 0.025, z: 0.5 },
    );

    physics.createDynamicSphere(
      { x: 0, y: 0.30, z: 0 },
      0.05,
      0.10,
    );

    for (let index = 0; index < 180; index += 1) {
      physics.step();
    }

    expect(physics.consumeContactAudioImpacts()).toEqual([]);
  });
});
