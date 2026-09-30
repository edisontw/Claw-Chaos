import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import type { Quaternion, RevoluteJointHandle, RigidBodyHandle } from "../physics/PhysicsRuntime";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  CLAW_LAB_CONFIG,
  createFingerPoints,
  createFingerSegments,
} from "./clawLab";
import {
  M02_FINGER_TRANSPORT_CONFIG,
  M02_GANTRY_CONFIG,
} from "./gantryLab";
import { advanceGantryAxis } from "./gantryMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

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

describe("M02 open-finger transport rigidity", () => {
  it("keeps all three open fingers mechanically stiff during movement and hard braking", async () => {
    const claw = CLAW_LAB_CONFIG;
    const gantry = M02_GANTRY_CONFIG;
    const hold = M02_FINGER_TRANSPORT_CONFIG;
    const physics = await PhysicsRuntime.create();
    const dt = 1 / PHYSICS_HZ;
    const anchorY = gantry.carriageY - gantry.carriageHalfY;

    const reelAnchor = physics.createKinematicBody({
      x: 0,
      y: anchorY,
      z: 0,
    });
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
      finger.setAngularDamping(hold.angularDamping);
      const joint = physics.createRevoluteJoint(hub, finger, {
        anchor1: pivotLocal,
        anchor2: { x: 0, y: 0, z: 0 },
        axis: tangent,
        minAngle: claw.closedAngle,
        maxAngle: claw.openAngle,
        initialTarget: claw.openAngle,
        stiffness: hold.stiffness,
        damping: hold.damping,
        maxTorque: hold.maxTorque,
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

    const drive = (input: number): void => {
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
          stiffness: gantry.suspensionSpringStiffness,
          damping: gantry.suspensionSpringDamping,
          maxForce: gantry.suspensionSpringMaxForce,
          maxDampingForce: gantry.suspensionDampingForceLimit,
        },
        dt,
      );
      hub.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);

      for (const joint of joints) {
        joint.configureMotorPosition(
          claw.openAngle,
          hold.stiffness,
          hold.damping,
        );
        joint.setMotorMaxForce(hold.maxTorque);
      }
      for (const finger of fingers) {
        finger.wakeUp();
      }
      hub.wakeUp();
      physics.step();
    };

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      drive(0);
    }

    const referenceHubRotation = hub.rotation();
    const references = fingers.map((finger) =>
      relativeRotation(referenceHubRotation, finger.rotation()),
    );
    const maxDeflections = [0, 0, 0];

    const sample = (): void => {
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

    console.log(
      "M02 finger transport deflections",
      JSON.stringify(maxDeflections),
    );

    for (const deflection of maxDeflections) {
      expect(deflection).toBeLessThanOrEqual(hold.maxRelativeDeflectionRadians);
    }
  });
});
