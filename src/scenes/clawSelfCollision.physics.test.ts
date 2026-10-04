import { describe, expect, it } from "vitest";
import { CABINET_PLAY_TUNING } from "../cabinet/cabinetPlayTuning";
import { PHYSICS_HZ } from "../config/simulation";
import type {
  RevoluteJointHandle,
  RigidBodyHandle,
} from "../physics/PhysicsRuntime";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  createFingerPoints,
  createFingerSegments,
} from "./clawLab";

interface EmptyCloseMetrics {
  closedAngleRadians: number;
  peakPairContacts: number[];
  contactTicks: number[];
  finalPairContacts: number[];
  commandRadians: number;
}

function createTangentialTipOffsetPoints(
  theta: number,
  offsetMeters: number,
) {
  const points = createFingerPoints(theta).map((point) => ({ ...point }));
  const tip = points.at(-1);
  if (tip) {
    tip.x += -Math.sin(theta) * offsetMeters;
    tip.z += Math.cos(theta) * offsetMeters;
  }
  return points;
}

async function simulateEmptyClose(
  closedAngleRadians: number,
  tipTangentialOffsetMeters: number,
): Promise<EmptyCloseMetrics & {
  tipTangentialOffsetMeters: number;
}> {
  const claw = CLAW_LAB_CONFIG;
  const physics = await PhysicsRuntime.create();
  const dt = 1 / PHYSICS_HZ;

  const hub = physics.createKinematicCylinder(
    { x: 0, y: claw.hubCenterY, z: 0 },
    claw.hubColliderHalfHeight,
    claw.collarRadius,
    0.55,
  );

  const fingers: RigidBodyHandle[] = [];
  const joints: RevoluteJointHandle[] = [];
  const fingerPivotLocalY =
    claw.fingerPivotY - claw.hubCenterY;

  for (let index = 0; index < 3; index += 1) {
    const theta = index * (Math.PI * 2 / 3);
    const radialX = Math.cos(theta);
    const radialZ = Math.sin(theta);
    const pivotLocal = {
      x: radialX * claw.fingerPivotRadius,
      y: fingerPivotLocalY,
      z: radialZ * claw.fingerPivotRadius,
    };
    const pivotWorld = {
      x: pivotLocal.x,
      y: claw.hubCenterY + pivotLocal.y,
      z: pivotLocal.z,
    };
    const tangent = {
      x: -Math.sin(theta),
      y: 0,
      z: Math.cos(theta),
    };
    const finger = physics.createDynamicCapsuleChain(
      pivotWorld,
      createFingerSegments(
        createTangentialTipOffsetPoints(
          theta,
          tipTangentialOffsetMeters,
        ),
        CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        CABINET_PLAY_TUNING.fingerLowerPadLengthMeters,
      ),
      {
        friction: CABINET_PLAY_TUNING.fingerFriction,
        restitution: claw.fingerRestitution,
        density: claw.fingerDensity,
      },
    );
    const joint = physics.createRevoluteJoint(hub, finger, {
      anchor1: pivotLocal,
      anchor2: { x: 0, y: 0, z: 0 },
      axis: tangent,
      minAngle: closedAngleRadians,
      maxAngle: claw.openAngle,
      initialTarget: claw.openAngle,
      stiffness: claw.motorStiffness,
      damping: claw.motorDamping,
      maxTorque: CABINET_PLAY_TUNING.closePickupTorque,
      contactsEnabled: false,
    });

    fingers.push(finger);
    joints.push(joint);
  }

  let command = 0;
  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    command = advanceMotorCommand(
      command,
      claw.openAngle,
      claw.motorSpeedRadiansPerSecond,
      dt,
    );
    for (const joint of joints) {
      joint.configureMotorPosition(
        command,
        claw.motorStiffness,
        claw.motorDamping,
      );
      joint.setMotorMaxForce(
        CABINET_PLAY_TUNING.closePickupTorque,
      );
    }
    for (const finger of fingers) {
      finger.wakeUp();
    }
    physics.step();
  }

  const pairs: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];
  const peakPairContacts = [0, 0, 0];
  const contactTicks = [0, 0, 0];

  for (let tick = 0; tick < PHYSICS_HZ * 2; tick += 1) {
    command = advanceMotorCommand(
      command,
      closedAngleRadians,
      claw.motorSpeedRadiansPerSecond,
      dt,
    );
    for (const joint of joints) {
      joint.configureMotorPosition(
        command,
        claw.motorStiffness,
        claw.motorDamping,
      );
      joint.setMotorMaxForce(
        CABINET_PLAY_TUNING.closePickupTorque,
      );
    }
    for (const finger of fingers) {
      finger.wakeUp();
    }
    physics.step();

    pairs.forEach(([a, b], index) => {
      const contacts = physics.countBodyContactPairs(
        fingers[a]!,
        fingers[b]!,
      );
      peakPairContacts[index] = Math.max(
        peakPairContacts[index]!,
        contacts,
      );
      if (contacts > 0) {
        contactTicks[index] = contactTicks[index]! + 1;
      }
    });
  }

  const finalPairContacts = pairs.map(([a, b]) =>
    physics.countBodyContactPairs(fingers[a]!, fingers[b]!),
  );

  return {
    closedAngleRadians,
    peakPairContacts,
    contactTicks,
    finalPairContacts,
    commandRadians: command,
    tipTangentialOffsetMeters,
  };
}

describe("M09 production claw empty-close self contact", () => {
  it("diagnoses a tangential tip offset that prevents sibling binding", async () => {
    const angles = [-0.63, -0.45];
    const offsetsMeters = [0.005, 0.010, 0.015, 0.020, 0.025];
    const metrics = [];

    for (const tipTangentialOffsetMeters of offsetsMeters) {
      for (const angle of angles) {
        metrics.push(
          await simulateEmptyClose(
            angle,
            tipTangentialOffsetMeters,
          ),
        );
      }
    }

    const clean = metrics.filter((result) =>
      result.finalPairContacts.every((value) => value === 0),
    );

    console.log(
      "M09 empty-close tangential-tip sweep",
      JSON.stringify({ metrics, clean }),
    );

    expect(metrics).toHaveLength(
      angles.length * offsetsMeters.length,
    );
  }, 20_000);
});
