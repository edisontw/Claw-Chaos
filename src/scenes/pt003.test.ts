import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import type { RevoluteJointHandle, RigidBodyHandle } from "../physics/PhysicsRuntime";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  CLAW_LAB_CONFIG,
  advanceLinearCommand,
  advanceMotorCommand,
  createFingerPoints,
  createFingerSegments,
  evaluatePt003Rotation,
  quaternionAngleFromIdentity,
} from "./clawLab";

describe("PT-003 off-center box rotation", () => {
  it("keeps the box stable at rest, then rotates it through off-center claw contact", async () => {
    const config = CLAW_LAB_CONFIG;
    const physics = await PhysicsRuntime.create();

    physics.createStaticCuboid(
      { x: 0, y: -0.02, z: 0 },
      { x: 1, y: 0.02, z: 1 },
    );

    const supportTopY = config.pt001PedestalTopY;
    const supportHalfHeight = supportTopY * 0.5;
    physics.createStaticCuboid(
      {
        x: config.pt003BoxCenterOffsetX,
        y: supportHalfHeight,
        z: 0,
      },
      {
        x: config.pt003SupportHalfX,
        y: supportHalfHeight,
        z: config.pt003SupportHalfZ,
      },
      0.8,
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

    const boxCenterY =
      supportTopY + config.pt003BoxSizeY * 0.5 + 0.001;
    const boxVolume =
      config.pt003BoxSizeX *
      config.pt003BoxSizeY *
      config.pt003BoxSizeZ;
    const box = physics.createDynamicCuboid(
      {
        x: config.pt003BoxCenterOffsetX,
        y: boxCenterY,
        z: 0,
      },
      {
        x: config.pt003BoxSizeX * 0.5,
        y: config.pt003BoxSizeY * 0.5,
        z: config.pt003BoxSizeZ * 0.5,
      },
      0,
      {
        friction: config.pt003BoxFriction,
        restitution: config.pt003BoxRestitution,
        density: config.pt003BoxMassKg / boxVolume,
      },
    );

    let motorAngle = 0;
    let hubY: number = config.hubCenterY;
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
      hub.setNextKinematicTranslation({ x: 0, y: hubY, z: 0 });
    };

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      drive(config.openAngle);
      physics.step();
    }

    const passiveRotation = quaternionAngleFromIdentity(box.rotation());
    const referenceY = box.translation().y;

    let peakRotation = passiveRotation;
    let peakLift = 0;

    for (
      let tick = 0;
      tick < Math.ceil(config.pt001CloseSettleSeconds * PHYSICS_HZ);
      tick += 1
    ) {
      drive(config.closedAngle);
      for (const finger of fingers) {
        finger.wakeUp();
      }
      box.wakeUp();
      physics.step();
      peakRotation = Math.max(
        peakRotation,
        quaternionAngleFromIdentity(box.rotation()),
      );
      peakLift = Math.max(peakLift, box.translation().y - referenceY);
    }

    const liftTargetY = config.hubCenterY + config.pt001LiftDistance;
    while (hubY < liftTargetY - 1e-6) {
      hubY = advanceLinearCommand(
        hubY,
        liftTargetY,
        config.pt001LiftSpeedMetersPerSecond,
        stepSeconds,
      );
      drive(config.closedAngle);
      for (const finger of fingers) {
        finger.wakeUp();
      }
      box.wakeUp();
      physics.step();
      peakRotation = Math.max(
        peakRotation,
        quaternionAngleFromIdentity(box.rotation()),
      );
      peakLift = Math.max(peakLift, box.translation().y - referenceY);
    }

    console.log("PT-003 metrics", JSON.stringify({
      passiveRotation,
      peakRotation,
      peakLift,
      finalPosition: box.translation(),
      finalRotation: box.rotation(),
    }));

    expect(passiveRotation).toBeLessThanOrEqual(
      config.pt003MaxPassiveRotationRadians,
    );
    expect(peakRotation).toBeGreaterThanOrEqual(
      config.pt003MinRotationRadians,
    );
    expect(evaluatePt003Rotation(peakRotation)).toBe(true);
    expect(peakLift).toBeGreaterThan(0.005);
  });
});
