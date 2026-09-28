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
  quaternionAngleFromIdentity,
} from "./clawLab";

interface RotationMetrics {
  supportHalfSize: number;
  passiveRotation: number;
  peakRotation: number;
  peakLift: number;
  finalY: number;
}

async function simulateSupport(supportHalfSize: number): Promise<RotationMetrics> {
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
      x: supportHalfSize,
      y: supportHalfHeight,
      z: supportHalfSize,
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
    config.pt003BoxSizeX * config.pt003BoxSizeY * config.pt003BoxSizeZ;
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

  const sample = (): void => {
    peakRotation = Math.max(
      peakRotation,
      quaternionAngleFromIdentity(box.rotation()),
    );
    peakLift = Math.max(peakLift, box.translation().y - referenceY);
  };

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
    sample();
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
    sample();
  }

  return {
    supportHalfSize,
    passiveRotation,
    peakRotation,
    peakLift,
    finalY: box.translation().y,
  };
}

describe("PT-003 off-center box rotation", () => {
  it("stays stable at rest and rotates under off-center claw contact without tumbling off", async () => {
    expect(CLAW_LAB_CONFIG.pt003SupportHalfX).toBe(
      CLAW_LAB_CONFIG.pt003SupportHalfZ,
    );

    const result = await simulateSupport(CLAW_LAB_CONFIG.pt003SupportHalfX);
    const supportTopY = CLAW_LAB_CONFIG.pt001PedestalTopY;

    expect(result.passiveRotation).toBeLessThanOrEqual(
      CLAW_LAB_CONFIG.pt003MaxPassiveRotationRadians,
    );
    expect(result.peakRotation).toBeGreaterThanOrEqual(
      CLAW_LAB_CONFIG.pt003MinRotationRadians,
    );
    expect(result.peakRotation).toBeLessThan(1.0);
    expect(result.finalY).toBeGreaterThan(
      supportTopY + CLAW_LAB_CONFIG.pt003BoxSizeY * 0.25,
    );
  });
});
