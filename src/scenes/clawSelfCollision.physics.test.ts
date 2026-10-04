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
import { M02_FINGER_TRANSPORT_CONFIG } from "./gantryLab";

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

function signedAngleAroundAxis(
  rotation: Quaternion,
  axis: { x: number; y: number; z: number },
): number {
  const projected =
    rotation.x * axis.x +
    rotation.y * axis.y +
    rotation.z * axis.z;
  let angle = 2 * Math.atan2(projected, rotation.w);
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2;
  }
  return angle;
}

interface EmptyCloseMetrics {
  closedAngleRadians: number;
  peakPairContacts: number[];
  contactTicks: number[];
  finalPairContacts: number[];
  commandRadians: number;
  fingerTravelRadians: number[];
  travelSpreadRadians: number;
  reopenedPairContacts: number[];
  reopenErrorRadians: number[];
  maxReopenErrorRadians: number;
  openJointAngles: number[];
  closedJointAngles: number[];
  reopenedJointAngles: number[];
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
  const fingerAxes: Array<{ x: number; y: number; z: number }> = [];
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
    fingerAxes.push(tangent);
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

  const openHubRotation = hub.rotation();
  const openFingerRotations = fingers.map((finger) =>
    relativeRotation(openHubRotation, finger.rotation()),
  );
  const physicalFingerAngles = (): number[] =>
    fingers.map((finger, index) =>
      signedAngleAroundAxis(
        finger.rotation(),
        fingerAxes[index]!,
      ),
    );
  const openJointAngles = physicalFingerAngles();

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
  const closedJointAngles = physicalFingerAngles();
  const finalHubRotation = hub.rotation();
  const fingerTravelRadians = fingers.map((finger, index) =>
    angularDistance(
      openFingerRotations[index]!,
      relativeRotation(finalHubRotation, finger.rotation()),
    ),
  );
  const travelSpreadRadians =
    Math.max(...fingerTravelRadians) -
    Math.min(...fingerTravelRadians);

  for (let tick = 0; tick < PHYSICS_HZ * 2; tick += 1) {
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

  const reopenedPairContacts = pairs.map(([a, b]) =>
    physics.countBodyContactPairs(fingers[a]!, fingers[b]!),
  );
  const reopenedJointAngles = physicalFingerAngles();
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
  const maxReopenErrorRadians = Math.max(...reopenErrorRadians);

  return {
    closedAngleRadians,
    peakPairContacts,
    contactTicks,
    finalPairContacts,
    commandRadians: command,
    fingerTravelRadians,
    travelSpreadRadians,
    reopenedPairContacts,
    reopenErrorRadians,
    maxReopenErrorRadians,
    openJointAngles,
    closedJointAngles,
    reopenedJointAngles,
    tipTangentialOffsetMeters,
  };
}

describe("M09 production claw empty-close self contact", () => {
  it("measures close contact and reliable reopening after sibling-finger contact", async () => {
    const angles = [
      -0.63,
      -0.55,
      -0.50,
      -0.45,
      -0.42,
      -0.40,
      -0.38,
      -0.36,
    ];
    const metrics = [];

    for (const angle of angles) {
      metrics.push(await simulateEmptyClose(angle, 0));
    }

    console.log(
      "M09 empty-close symmetry sweep",
      JSON.stringify(metrics),
    );

    expect(metrics).toHaveLength(angles.length);
  }, 20_000);
});
