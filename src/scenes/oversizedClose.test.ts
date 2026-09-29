import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import type { RevoluteJointHandle, RigidBodyHandle } from "../physics/PhysicsRuntime";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  createFingerPoints,
  createFingerSegments,
  evaluateOversizedClose,
  quaternionAngularDistance,
} from "./clawLab";

interface CloseMetrics {
  travels: number[];
  objectPosition?: { x: number; y: number; z: number };
}

async function simulateClose(withOversizedPrize: boolean): Promise<CloseMetrics> {
  const config = CLAW_LAB_CONFIG;
  const physics = await PhysicsRuntime.create();

  physics.createStaticCuboid(
    { x: 0, y: -0.02, z: 0 },
    { x: 1, y: 0.02, z: 1 },
  );

  const pedestalHalfHeight = config.oversizedPedestalTopY * 0.5;
  physics.createStaticCylinder(
    { x: 0, y: pedestalHalfHeight, z: 0 },
    pedestalHalfHeight,
    config.oversizedPedestalRadius,
    0.85,
  );

  const hub = physics.createKinematicCylinder(
    { x: 0, y: config.hubCenterY, z: 0 },
    config.hubColliderHalfHeight,
    config.collarRadius,
    0.55,
  );

  const fingers: RigidBodyHandle[] = [];
  const joints: RevoluteJointHandle[] = [];

  for (let index = 0; index < 3; index += 1) {
    const theta = index * (Math.PI * 2 / 3);
    const radialX = Math.cos(theta);
    const radialZ = Math.sin(theta);
    const pivotLocal = {
      x: radialX * config.fingerPivotRadius,
      y: config.fingerPivotY - config.hubCenterY,
      z: radialZ * config.fingerPivotRadius,
    };
    const pivotWorld = {
      x: pivotLocal.x,
      y: config.hubCenterY + pivotLocal.y,
      z: pivotLocal.z,
    };
    const tangent = {
      x: -Math.sin(theta),
      y: 0,
      z: Math.cos(theta),
    };

    const finger = physics.createDynamicCapsuleChain(
      pivotWorld,
      createFingerSegments(createFingerPoints(theta)),
      {
        friction: config.fingerFriction,
        restitution: config.fingerRestitution,
        density: config.fingerDensity,
      },
    );

    const joint = physics.createRevoluteJoint(hub, finger, {
      anchor1: pivotLocal,
      anchor2: { x: 0, y: 0, z: 0 },
      axis: tangent,
      minAngle: config.closedAngle,
      maxAngle: config.openAngle,
      initialTarget: 0,
      stiffness: config.motorStiffness,
      damping: config.motorDamping,
      maxTorque: config.maxMotorTorque,
      contactsEnabled: false,
    });

    fingers.push(finger);
    joints.push(joint);
  }

  let oversizedPrize: RigidBodyHandle | undefined;
  if (withOversizedPrize) {
    const halfExtents = {
      x: config.oversizedBoxSizeX * 0.5,
      y: config.oversizedBoxSizeY * 0.5,
      z: config.oversizedBoxSizeZ * 0.5,
    };
    const volume =
      config.oversizedBoxSizeX *
      config.oversizedBoxSizeY *
      config.oversizedBoxSizeZ;

    oversizedPrize = physics.createDynamicCuboid(
      {
        x: 0,
        y:
          config.oversizedPedestalTopY +
          config.oversizedBoxSizeY * 0.5 +
          0.001,
        z: 0,
      },
      halfExtents,
      0,
      {
        friction: config.oversizedBoxFriction,
        restitution: config.oversizedBoxRestitution,
        density: config.oversizedBoxMassKg / volume,
      },
    );
  }

  let motorAngle = 0;
  const stepSeconds = 1 / PHYSICS_HZ;

  const drive = (targetAngle: number): void => {
    motorAngle = advanceMotorCommand(
      motorAngle,
      targetAngle,
      config.motorSpeedRadiansPerSecond,
      stepSeconds,
    );

    for (const joint of joints) {
      joint.configureMotorPosition(
        motorAngle,
        config.motorStiffness,
        config.motorDamping,
      );
      joint.setMotorMaxForce(config.maxMotorTorque);
    }

    for (const finger of fingers) {
      finger.wakeUp();
    }
    oversizedPrize?.wakeUp();
  };

  for (let tick = 0; tick < Math.ceil(1.0 * PHYSICS_HZ); tick += 1) {
    drive(config.openAngle);
    physics.step();
  }

  const openRotations = fingers.map((finger) => finger.rotation());

  for (let tick = 0; tick < Math.ceil(1.2 * PHYSICS_HZ); tick += 1) {
    drive(config.closedAngle);
    physics.step();
  }

  const travels = fingers.map((finger, index) =>
    quaternionAngularDistance(openRotations[index]!, finger.rotation()),
  );

  return {
    travels,
    objectPosition: oversizedPrize?.translation(),
  };
}

describe("M01 oversized-object close regression", () => {
  it("prevents nominal full closure through contact alone", async () => {
    const control = await simulateClose(false);
    const oversized = await simulateClose(true);

    console.log(
      "oversized-close metrics",
      JSON.stringify({
        controlTravels: control.travels,
        blockedTravels: oversized.travels,
        objectPosition: oversized.objectPosition,
      }),
    );

    expect(evaluateOversizedClose(control.travels, oversized.travels)).toBe(
      true,
    );

    expect(oversized.objectPosition).toBeDefined();
    expect(Math.abs(oversized.objectPosition!.x)).toBeLessThan(0.04);
    expect(Math.abs(oversized.objectPosition!.z)).toBeLessThan(0.04);
  });
});
