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
  evaluatePt002Slip,
} from "./clawLab";

interface SlipMetrics {
  retainingTorque: number;
  peakLift: number;
  finalLift: number;
  slipLoss: number;
  passed: boolean;
}

async function simulateRetainingTorque(
  retainingTorque: number,
): Promise<SlipMetrics> {
  const config = CLAW_LAB_CONFIG;
  const physics = await PhysicsRuntime.create();

  physics.createStaticCuboid(
    { x: 0, y: -0.02, z: 0 },
    { x: 1, y: 0.02, z: 1 },
  );

  const pedestalHalfHeight = config.pt001PedestalTopY * 0.5;
  physics.createStaticCylinder(
    { x: 0, y: pedestalHalfHeight, z: 0 },
    pedestalHalfHeight,
    config.pt001PedestalRadius,
    0.75,
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
      z: radialZ * config.fingerPivotRadius,
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

  const ball = physics.createDynamicSphere(
    { x: 0, y: config.pt001BallCenterY, z: 0 },
    config.pt001BallRadius,
    config.pt001BallMassKg,
    {
      friction: config.pt001BallFriction,
      restitution: config.pt001BallRestitution,
    },
  );

  let motorAngle = 0;
  let hubY: number = config.hubCenterY;
  const stepSeconds = 1 / PHYSICS_HZ;

  const drive = (targetAngle: number, maxTorque: number): void => {
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
      joint.setMotorMaxForce(maxTorque);
    }

    hub.setNextKinematicTranslation({ x: 0, y: hubY, z: 0 });
  };

  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    drive(config.openAngle, config.maxMotorTorque);
    physics.step();
  }

  const baselineY = ball.translation().y;

  for (
    let tick = 0;
    tick < Math.ceil(config.pt001CloseSettleSeconds * PHYSICS_HZ);
    tick += 1
  ) {
    drive(config.closedAngle, config.maxMotorTorque);
    for (const finger of fingers) {
      finger.wakeUp();
    }
    ball.wakeUp();
    physics.step();
  }

  let peakLift = Math.max(0, ball.translation().y - baselineY);
  const liftTargetY = config.hubCenterY + config.pt001LiftDistance;

  while (hubY < liftTargetY - 1e-6) {
    hubY = advanceLinearCommand(
      hubY,
      liftTargetY,
      config.pt001LiftSpeedMetersPerSecond,
      stepSeconds,
    );
    drive(config.closedAngle, retainingTorque);
    for (const finger of fingers) {
      finger.wakeUp();
    }
    ball.wakeUp();
    physics.step();
    peakLift = Math.max(peakLift, ball.translation().y - baselineY);
  }

  for (let tick = 0; tick < Math.ceil(0.5 * PHYSICS_HZ); tick += 1) {
    drive(config.closedAngle, retainingTorque);
    for (const finger of fingers) {
      finger.wakeUp();
    }
    ball.wakeUp();
    physics.step();
    peakLift = Math.max(peakLift, ball.translation().y - baselineY);
  }

  const finalLift = ball.translation().y - baselineY;
  const slipLoss = peakLift - finalLift;

  return {
    retainingTorque,
    peakLift,
    finalLift,
    slipLoss,
    passed: evaluatePt002Slip(peakLift, finalLift),
  };
}

describe("PT-002 retaining-force slip calibration", () => {
  it("finds a retaining torque that first lifts and then slips", async () => {
    const candidates = [0.00655, 0.0066, 0.00665, 0.0067, 0.00675, 0.0068, 0.00685, 0.0069, 0.00695];
    const results: SlipMetrics[] = [];

    for (const retainingTorque of candidates) {
      results.push(await simulateRetainingTorque(retainingTorque));
    }

    console.log("PT-002 retaining sweep", JSON.stringify(results));
    expect(results.some((result) => result.passed)).toBe(true);
  });
});
