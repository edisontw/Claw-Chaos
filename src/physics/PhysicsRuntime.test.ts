import { describe, expect, it } from "vitest";
import { FIXED_TIMESTEP_SECONDS, PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "./PhysicsRuntime";

describe("PhysicsRuntime", () => {
  it("initializes Rapier and lets a dynamic cube fall and settle on a static floor", async () => {
    const physics = await PhysicsRuntime.create();

    physics.createStaticCuboid(
      { x: 0, y: -0.1, z: 0 },
      { x: 5, y: 0.1, z: 5 },
    );

    const cube = physics.createDynamicCuboid(
      { x: 0, y: 3, z: 0 },
      { x: 0.5, y: 0.5, z: 0.5 },
      0,
    );

    const initialY = cube.translation().y;

    for (let tick = 0; tick < PHYSICS_HZ * 8; tick += 1) {
      physics.step();
    }

    expect(FIXED_TIMESTEP_SECONDS).toBeCloseTo(1 / 120, 12);
    expect(initialY).toBeCloseTo(3, 6);
    expect(cube.translation().y).toBeCloseTo(0.5, 2);
    expect(cube.isSleeping()).toBe(true);
    expect(physics.dynamicBodyCount).toBe(1);
  });
});
