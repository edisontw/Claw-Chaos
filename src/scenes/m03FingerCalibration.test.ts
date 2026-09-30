import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import type {
  Quaternion,
  RevoluteJointHandle,
  RigidBodyHandle,
} from "../physics/PhysicsRuntime";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  CLAW_LAB_CONFIG,
  createFingerPoints,
  createFingerSegments,
} from "./clawLab";
import { M02_GANTRY_CONFIG } from "./gantryLab";
import { advanceGantryAxis } from "./gantryMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

interface HoldCandidate {
  stiffness: number;
  damping: number;
  maxTorque: number;
}

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

function relativeRotation(parent: Quaternion, child: Quaternion): Quaternion {
  return multiply(inverseUnit(parent), child);
}

function angularDistance(a: Quaternion, b: Quaternion): number {
  const dot = Math.min(
    1,
    Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w),
  );
  return 2 * Math.acos(dot);
}

async function measure(candidate: HoldCandidate) {
  const claw = CLAW_LAB_CONFIG;
  const gantry = M02_GANTRY_CONFIG;
  const physics = await PhysicsRuntime.create();
  const dt = 1 / PHYSICS_HZ;
  const anchorY = gantry.carriageY - gantry.carriageHalfY;

  const reelAnchor = physics.createKinematicBody({ x: 0, y: anchorY, z: 0 });
  const hub = physics.createDynamicCylinder(
    { x: 0, y: anchorY - gantry.suspensionLength, z: 0 },
    claw.hubColliderHalfHeight,
    claw.collarRadius,
    gantry.hubMassKg,
    { friction: 0.55, restitution: 0.02 },
  );
  hub.setAngularDamping(gantry.suspensionAngularDamping);
  hub.setLinearDamping(gantry.suspensionLinearDamping);
  physics.createSphericalJoint(
    reelAnchor,
    hub,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: gantry.suspensionLength, z: 0 },
    false,
  );

  const fingers: RigidBodyHandle[] = [];
  const joints: RevoluteJointHandle[] = [];
  const fingerPivotLocalY = claw.fingerPivotY - claw.hubCenterY;

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
      y: anchorY - gantry.suspensionLength + pivotLocal.y,
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
        friction: claw.fingerFriction,
        restitution: claw.fingerRestitution,
        density: claw.fingerDensity,
      },
    );
    finger.setAngularDamping(8.0);
    const joint = physics.createRevoluteJoint(hub, finger, {
      anchor1: pivotLocal,
      anchor2: { x: 0, y: 0, z: 0 },
      axis: tangent,
      minAngle: claw.closedAngle,
      maxAngle: claw.openAngle,
      initialTarget: claw.openAngle,
      stiffness: candidate.stiffness,
      damping: candidate.damping,
      maxTorque: candidate.maxTorque,
      contactsEnabled: false,
    });
    fingers.push(finger);
    joints.push(joint);
  }

  let gantryState = { position: 0, velocity: 0 };
  const axisConfig = {
    minPosition: gantry.xMin,
    maxPosition: gantry.xMax,
    maxSpeed: gantry.maxSpeed,
    acceleration: gantry.acceleration,
    braking: gantry.braking,
  };

  const drive = (input: number) => {
    gantryState = advanceGantryAxis(gantryState, input, axisConfig, dt);
    reelAnchor.setNextKinematicTranslation({
      x: gantryState.position,
      y: anchorY,
      z: 0,
    });
    const hubPosition = hub.translation();
    const hubVelocity = hub.linvel();
    const impulse = computeSuspensionStabilizerImpulse(
      {
        anchorX: gantryState.position,
        anchorZ: 0,
        anchorVelocityX: gantryState.velocity,
        anchorVelocityZ: 0,
        hubX: hubPosition.x,
        hubZ: hubPosition.z,
        hubVelocityX: hubVelocity.x,
        hubVelocityZ: hubVelocity.z,
      },
      {
        stiffness: 170,
        damping: 1.0,
        maxForce: gantry.suspensionSpringMaxForce,
      },
      dt,
    );
    hub.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);

    for (const joint of joints) {
      joint.configureMotorPosition(
        claw.openAngle,
        candidate.stiffness,
        candidate.damping,
      );
      joint.setMotorMaxForce(candidate.maxTorque);
    }
    for (const finger of fingers) finger.wakeUp();
    hub.wakeUp();
    physics.step();
  };

  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) drive(0);

  const referenceHubRotation = hub.rotation();
  const references = fingers.map((finger) =>
    relativeRotation(referenceHubRotation, finger.rotation()),
  );
  const maxDeflections = [0, 0, 0];

  const sample = () => {
    const hubRotation = hub.rotation();
    fingers.forEach((finger, index) => {
      const relative = relativeRotation(hubRotation, finger.rotation());
      maxDeflections[index] = Math.max(
        maxDeflections[index]!,
        angularDistance(references[index]!, relative),
      );
    });
  };

  for (let tick = 0; tick < Math.ceil(0.8 * PHYSICS_HZ); tick += 1) {
    drive(1);
    sample();
  }
  for (let tick = 0; tick < Math.ceil(0.8 * PHYSICS_HZ); tick += 1) {
    drive(0);
    sample();
  }

  return maxDeflections;
}

describe("M03 finger-hold calibration exploration", () => {
  it("finds a transport-only hold that stays rigid with the livelier suspension", async () => {
    const candidates: HoldCandidate[] = [
      { stiffness: 2400, damping: 160, maxTorque: 20 },
      { stiffness: 3600, damping: 220, maxTorque: 30 },
      { stiffness: 4800, damping: 280, maxTorque: 40 },
      { stiffness: 6000, damping: 340, maxTorque: 50 },
      { stiffness: 8000, damping: 450, maxTorque: 60 },
    ];
    const results = [];

    for (const candidate of candidates) {
      results.push({
        ...candidate,
        maxDeflections: await measure(candidate),
      });
    }

    console.log("M03 finger-hold sweep", JSON.stringify(results));
    expect(results.every((result) =>
      result.maxDeflections.every(Number.isFinite),
    )).toBe(true);
  });
});
