import { describe, expect, it } from "vitest";
import { CABINET_PLAY_TUNING } from "../cabinet/cabinetPlayTuning";
import { PHYSICS_HZ } from "../config/simulation";
import type {
  Quaternion,
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
import {
  M02_FINGER_TRANSPORT_CONFIG,
  advanceFingerCommandWithSelfContactGuard,
  updateFingerSelfContactGuard,
} from "./gantryLab";

function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function inverseUnit(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function relativeRotation(
  parent: Quaternion,
  child: Quaternion,
): Quaternion {
  return multiply(inverseUnit(parent), child);
}

function angularDistance(a: Quaternion, b: Quaternion): number {
  const dot = Math.min(
    1,
    Math.abs(
      a.x * b.x +
        a.y * b.y +
        a.z * b.z +
        a.w * b.w,
    ),
  );
  return 2 * Math.acos(dot);
}

interface EmptyCloseMetrics {
  firstContactCommandRadians: number;
  closedCommandRadians: number;
  targetClosedAngleRadians: number;
  peakPairContacts: number[];
  contactTicks: number[];
  closedPairContacts: number[];
  reopenedPairContacts: number[];
  reopenErrorRadians: number[];
  maxReopenErrorRadians: number;
}

async function simulateGuardedEmptyClose(): Promise<EmptyCloseMetrics> {
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
        createFingerPoints(theta),
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
      minAngle: CABINET_PLAY_TUNING.closedAngleRadians,
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

  const pairs: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];
  const pairContacts = (): number[] =>
    pairs.map(([a, b]) =>
      physics.countBodyContactPairs(fingers[a]!, fingers[b]!),
    );

  let command = claw.openAngle;
  for (let tick = 0; tick < PHYSICS_HZ * 3; tick += 1) {
    for (const joint of joints) {
      joint.configureMotorPosition(
        command,
        M02_FINGER_TRANSPORT_CONFIG.stiffness,
        M02_FINGER_TRANSPORT_CONFIG.damping,
      );
      joint.setMotorMaxForce(
        M02_FINGER_TRANSPORT_CONFIG.maxTorque,
      );
    }
    for (const finger of fingers) {
      finger.wakeUp();
    }
    physics.step();
  }

  const openHubRotation = hub.rotation();
  const openFingerRotations = fingers.map((finger) =>
    relativeRotation(openHubRotation, finger.rotation()),
  );

  const peakPairContacts = [0, 0, 0];
  const contactTicks = [0, 0, 0];
  let firstContactCommandRadians = Number.NaN;
  let selfContactGuardActive = false;

  for (let tick = 0; tick < PHYSICS_HZ * 2; tick += 1) {
    const beforeContacts = pairContacts();
    const siblingFingerContact =
      beforeContacts.some((contacts) => contacts > 0);
    if (
      siblingFingerContact &&
      !Number.isFinite(firstContactCommandRadians)
    ) {
      firstContactCommandRadians = command;
    }

    selfContactGuardActive = updateFingerSelfContactGuard(
      selfContactGuardActive,
      true,
      siblingFingerContact,
    );
    command = advanceFingerCommandWithSelfContactGuard(
      command,
      CABINET_PLAY_TUNING.closedAngleRadians,
      claw.motorSpeedRadiansPerSecond,
      dt,
      true,
      selfContactGuardActive,
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

    pairContacts().forEach((contacts, index) => {
      peakPairContacts[index] = Math.max(
        peakPairContacts[index]!,
        contacts,
      );
      if (contacts > 0) {
        contactTicks[index] = contactTicks[index]! + 1;
      }
    });
  }

  const closedCommandRadians = command;
  const closedPairContacts = pairContacts();

  for (let tick = 0; tick < PHYSICS_HZ * 3; tick += 1) {
    command = advanceMotorCommand(
      command,
      claw.openAngle,
      claw.motorSpeedRadiansPerSecond,
      dt,
    );
    for (const joint of joints) {
      joint.configureMotorPosition(
        command,
        M02_FINGER_TRANSPORT_CONFIG.stiffness,
        M02_FINGER_TRANSPORT_CONFIG.damping,
      );
      joint.setMotorMaxForce(
        M02_FINGER_TRANSPORT_CONFIG.maxTorque,
      );
    }
    for (const finger of fingers) {
      finger.wakeUp();
    }
    physics.step();
  }

  const reopenedPairContacts = pairContacts();
  const reopenedHubRotation = hub.rotation();
  const reopenErrorRadians = fingers.map((finger, index) =>
    angularDistance(
      openFingerRotations[index]!,
      relativeRotation(
        reopenedHubRotation,
        finger.rotation(),
      ),
    ),
  );

  return {
    firstContactCommandRadians,
    closedCommandRadians,
    targetClosedAngleRadians:
      CABINET_PLAY_TUNING.closedAngleRadians,
    peakPairContacts,
    contactTicks,
    closedPairContacts,
    reopenedPairContacts,
    reopenErrorRadians,
    maxReopenErrorRadians: Math.max(...reopenErrorRadians),
  };
}

describe("M09 production claw empty-close self-contact guard", () => {
  it("stops closing at sibling contact and reopens without a finger jam", async () => {
    const metrics = await simulateGuardedEmptyClose();

    console.log(
      "M09 guarded empty-close metrics",
      JSON.stringify(metrics),
    );

    expect(Number.isFinite(metrics.firstContactCommandRadians)).toBe(true);
    expect(
      metrics.peakPairContacts.some((contacts) => contacts > 0),
    ).toBe(true);
    expect(metrics.closedCommandRadians).toBeGreaterThan(
      metrics.targetClosedAngleRadians + 0.12,
    );
    expect(metrics.closedCommandRadians).toBeCloseTo(
      metrics.firstContactCommandRadians,
      6,
    );
    expect(metrics.contactTicks.some((ticks) => ticks > 0)).toBe(true);

    expect(metrics.reopenedPairContacts).toEqual([0, 0, 0]);
    expect(metrics.maxReopenErrorRadians).toBeLessThan(0.03);
  }, 12_000);
});
