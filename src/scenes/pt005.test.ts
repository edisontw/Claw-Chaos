import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import type { RevoluteJointHandle, RigidBodyHandle } from "../physics/PhysicsRuntime";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  createFingerPoints,
  createFingerSegments,
  evaluatePt005BlockedFinger,
  quaternionAngularDistance,
} from "./clawLab";

describe("PT-005 blocked finger", () => {
  it("physically blocks one finger while the other two keep closing independently", async () => {
    const config = CLAW_LAB_CONFIG;
    const physics = await PhysicsRuntime.create();

    physics.createStaticCuboid(
      { x: 0, y: -0.02, z: 0 },
      { x: 1, y: 0.02, z: 1 },
    );

    const hub = physics.createKinematicCylinder(
      { x: 0, y: config.hubCenterY, z: 0 },
      config.hubColliderHalfHeight,
      config.collarRadius,
      0.55,
    );

    physics.createStaticCuboid(
      {
        x: config.pt005BlockerCenterX,
        y: config.pt005BlockerCenterY,
        z: config.pt005BlockerCenterZ,
      },
      {
        x: config.pt005BlockerHalfX,
        y: config.pt005BlockerHalfY,
        z: config.pt005BlockerHalfZ,
      },
      0.85,
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

    console.log("PT-005 finger travels", JSON.stringify(travels));

    expect(travels[0]).toBeLessThanOrEqual(
      config.pt005MaxBlockedTravelRadians,
    );
    expect(travels[1]).toBeGreaterThanOrEqual(
      config.pt005MinFreeTravelRadians,
    );
    expect(travels[2]).toBeGreaterThanOrEqual(
      config.pt005MinFreeTravelRadians,
    );
    expect(evaluatePt005BlockedFinger(travels, 0)).toBe(true);
  });
});
