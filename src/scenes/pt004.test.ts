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
  evaluatePt004Hook,
  quaternionAngleFromIdentity,
} from "./clawLab";
import { createPt004TeddyColliders } from "./pt004Teddy";

interface HookMetrics {
  bodyOffsetX: number;
  passiveRotation: number;
  peakLift: number;
  peakRotation: number;
  finalX: number;
  finalY: number;
  passed: boolean;
}

async function simulateTeddyOffset(bodyOffsetX: number): Promise<HookMetrics> {
  const config = CLAW_LAB_CONFIG;
  const physics = await PhysicsRuntime.create();

  physics.createStaticCuboid(
    { x: 0, y: -0.02, z: 0 },
    { x: 1, y: 0.02, z: 1 },
  );

  physics.createStaticCuboid(
    {
      x: bodyOffsetX,
      y: config.pt004SupportCenterY,
      z: 0,
    },
    {
      x: config.pt004SupportHalfX,
      y: config.pt004SupportHalfY,
      z: config.pt004SupportHalfZ,
    },
    0.9,
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

  const teddy = physics.createDynamicCompound(
    {
      x: bodyOffsetX,
      y: config.pt004BodyCenterY,
      z: 0,
    },
    createPt004TeddyColliders(),
    config.pt004TeddyMassKg,
    {
      friction: config.pt004TeddyFriction,
      restitution: config.pt004TeddyRestitution,
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

  const passiveRotation = quaternionAngleFromIdentity(teddy.rotation());
  const referenceY = teddy.translation().y;
  let peakLift = 0;
  let peakRotation = passiveRotation;

  const sample = (): void => {
    peakLift = Math.max(peakLift, teddy.translation().y - referenceY);
    peakRotation = Math.max(
      peakRotation,
      quaternionAngleFromIdentity(teddy.rotation()),
    );
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
    teddy.wakeUp();
    physics.step();
    sample();
  }

  const targetHubY = config.hubCenterY + config.pt001LiftDistance;
  while (hubY < targetHubY - 1e-6) {
    hubY = advanceLinearCommand(
      hubY,
      targetHubY,
      config.pt001LiftSpeedMetersPerSecond,
      stepSeconds,
    );
    drive(config.closedAngle);
    for (const finger of fingers) {
      finger.wakeUp();
    }
    teddy.wakeUp();
    physics.step();
    sample();
  }

  for (let tick = 0; tick < Math.ceil(0.75 * PHYSICS_HZ); tick += 1) {
    drive(config.closedAngle);
    teddy.wakeUp();
    physics.step();
    sample();
  }

  const finalPosition = teddy.translation();

  return {
    bodyOffsetX,
    passiveRotation,
    peakLift,
    peakRotation,
    finalX: finalPosition.x,
    finalY: finalPosition.y,
    passed:
      passiveRotation < 0.15 &&
      evaluatePt004Hook(peakLift, peakRotation, finalPosition.x),
  };
}

describe("PT-004 teddy limb hook calibration", () => {
  it("finds an offset where the arm enters a real claw-tip hook path", async () => {
    const candidates = [-0.11, -0.10, -0.09, -0.08, -0.07, -0.06, -0.05];
    const results: HookMetrics[] = [];

    for (const bodyOffsetX of candidates) {
      results.push(await simulateTeddyOffset(bodyOffsetX));
    }

    console.log("PT-004 offset sweep", JSON.stringify(results));
    expect(results.some((result) => result.passed)).toBe(true);
  });
});
