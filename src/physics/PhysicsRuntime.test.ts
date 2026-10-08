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

  it("removes an awarded dynamic body cleanly from the world", async () => {
    const physics = await PhysicsRuntime.create();
    const body = physics.createDynamicCuboid(
      { x: 0, y: 1, z: 0 },
      { x: 0.1, y: 0.1, z: 0.1 },
      0,
    );
    expect(physics.dynamicBodyCount).toBe(1);

    physics.removeRigidBody(body);

    expect(physics.dynamicBodyCount).toBe(0);
    // The removed body no longer contributes to the world; stepping remains valid.
    for (let tick = 0; tick < 4; tick += 1) {
      physics.step();
    }
    expect(physics.dynamicBodyCount).toBe(0);
  });

  it("drives one revolute finger independently without moving two idle fingers", async () => {
    const physics = await PhysicsRuntime.create();
    const hub = physics.createStaticCuboid(
      { x: 0, y: 1, z: 0 },
      { x: 0.35, y: 0.04, z: 0.08 },
    );

    const joints = [];
    const fingers = [];

    for (let index = 0; index < 3; index += 1) {
      const x = (index - 1) * 0.22;
      const finger = physics.createDynamicCuboid(
        { x, y: 0.82, z: 0 },
        { x: 0.02, y: 0.14, z: 0.02 },
        0,
        { density: 120 },
      );
      const joint = physics.createRevoluteJoint(hub, finger, {
        anchor1: { x, y: -0.04, z: 0 },
        anchor2: { x: 0, y: 0.14, z: 0 },
        axis: { x: 0, y: 0, z: 1 },
        minAngle: -0.6,
        maxAngle: 0.4,
        initialTarget: 0,
        stiffness: 180,
        damping: 18,
        maxTorque: 2.5,
        contactsEnabled: false,
      });
      fingers.push(finger);
      joints.push(joint);
    }

    const drivenJoint = joints[0]!;
    const drivenFinger = fingers[0]!;
    const idleFingerA = fingers[1]!;
    const idleFingerB = fingers[2]!;

    for (let tick = 0; tick < PHYSICS_HZ * 2; tick += 1) {
      drivenJoint.configureMotorPosition(-0.45, 180, 18);
      drivenJoint.setMotorMaxForce(2.5);
      drivenFinger.wakeUp();
      physics.step();
    }

    expect(drivenJoint.limitsEnabled()).toBe(true);
    expect(drivenJoint.limitsMin()).toBeCloseTo(-0.6, 5);
    expect(drivenJoint.limitsMax()).toBeCloseTo(0.4, 5);
    expect(Math.abs(drivenFinger.rotation().z)).toBeGreaterThan(0.08);
    expect(Math.abs(idleFingerA.rotation().z)).toBeLessThan(0.03);
    expect(Math.abs(idleFingerB.rotation().z)).toBeLessThan(0.03);
    expect(physics.dynamicBodyCount).toBe(3);
  });
});
