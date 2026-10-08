import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "../cabinet/cabinetGeometry";
import {
  CABINET_GANTRY_TRAVEL_BOUNDS,
  CABINET_PLAY_TUNING,
} from "../cabinet/cabinetPlayTuning";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  CLAW_LAB_CONFIG,
  createFingerPoints,
  createFingerSegments,
} from "./clawLab";
import { M02_FINGER_TRANSPORT_CONFIG } from "./gantryLab";

type Edge = "right" | "front";

interface EdgeContactResult {
  contactTicks: number;
  finalContactTicks: number;
  recoveredContactPairs: number;
  farTipCoordinate: number;
  farFingerCoordinate: number;
  recoveredFingerCoordinate: number;
  commandRadians: number;
}

async function simulateOpenClawWallContact(
  edge: Edge,
): Promise<EdgeContactResult> {
  const physics = await PhysicsRuntime.create();
  const cabinet = createCabinetPhysics(physics);
  const claw = CLAW_LAB_CONFIG;
  const hubY = 0.93;
  const theta = edge === "right" ? 0 : Math.PI / 2;
  const radialX = Math.cos(theta);
  const radialZ = Math.sin(theta);

  // The actual physical finger/glass shapes, production pivot joint and
  // fully-open transport motor. No proximity-based angle correction.
  const hub = physics.createKinematicCylinder(
    { x: 0, y: hubY, z: 0 },
    claw.hubColliderHalfHeight,
    claw.collarRadius,
    0.55,
  );
  const pivotLocal = {
    x: radialX * claw.fingerPivotRadius,
    y: claw.fingerPivotY - claw.hubCenterY,
    z: radialZ * claw.fingerPivotRadius,
  };
  const finger = physics.createDynamicCapsuleChain(
    {
      x: pivotLocal.x,
      y: hubY + pivotLocal.y,
      z: pivotLocal.z,
    },
    createFingerSegments(
      createFingerPoints(theta),
      CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
      CABINET_PLAY_TUNING.fingerLowerPadLengthMeters,
    ),
    {
      friction: CABINET_PLAY_TUNING.fingerFriction,
      restitution: claw.fingerRestitution,
      density: claw.fingerDensity,
      enableCcd: true,
    },
  );
  expect(finger.isCcdEnabled()).toBe(true);
  finger.setAngularDamping(
    M02_FINGER_TRANSPORT_CONFIG.angularDamping,
  );
  const joint = physics.createRevoluteJoint(
    hub,
    finger,
    {
      anchor1: pivotLocal,
      anchor2: { x: 0, y: 0, z: 0 },
      axis: { x: -radialZ, y: 0, z: radialX },
      minAngle: CABINET_PLAY_TUNING.closedAngleRadians,
      maxAngle: claw.openAngle,
      initialTarget: claw.openAngle,
      stiffness: claw.motorStiffness,
      damping: claw.motorDamping,
      maxTorque: CABINET_PLAY_TUNING.closePickupTorque,
      contactsEnabled: false,
    },
  );
  const glass = edge === "right"
    ? cabinet.serviceDoorBody
    : cabinet.frontGlassBody;
  const limit = edge === "right"
    ? CABINET_GANTRY_TRAVEL_BOUNDS.xMax
    : CABINET_GANTRY_TRAVEL_BOUNDS.zMax;

  const applyFullOpenMotor = (): void => {
    joint.configureMotorPosition(
      claw.openAngle,
      M02_FINGER_TRANSPORT_CONFIG.stiffness,
      M02_FINGER_TRANSPORT_CONFIG.damping,
    );
    joint.setMotorMaxForce(
      M02_FINGER_TRANSPORT_CONFIG.maxTorque,
    );
    finger.wakeUp();
  };
  const fingerTip = createFingerPoints(theta).at(-1)!;
  const tipPosition = (): THREE.Vector3 => {
    const p = finger.translation();
    const r = finger.rotation();
    return new THREE.Vector3(
      fingerTip.x,
      fingerTip.y,
      fingerTip.z,
    )
      .applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w))
      .add(new THREE.Vector3(p.x, p.y, p.z));
  };

  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    applyFullOpenMotor();
    physics.step();
  }

  let contactTicks = 0;
  let finalContactTicks = 0;
  const steps = PHYSICS_HZ * 3;
  for (let tick = 0; tick < steps; tick += 1) {
    const step = limit * (tick + 1) / steps;
    hub.setNextKinematicTranslation({
      x: edge === "right" ? step : 0,
      y: hubY,
      z: edge === "front" ? step : 0,
    });
    applyFullOpenMotor();
    physics.step();
    if (physics.countBodyContactPairs(finger, glass) > 0) {
      contactTicks++;
    }
  }

  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    applyFullOpenMotor();
    physics.step();
    if (physics.countBodyContactPairs(finger, glass) > 0) {
      finalContactTicks++;
    }
  }

  const tip = tipPosition();
  const farPosition = finger.translation();
  const farTipCoordinate = edge === "right" ? tip.x : tip.z;
  const farFingerCoordinate = edge === "right"
    ? farPosition.x : farPosition.z;

  for (let tick = 0; tick < steps; tick += 1) {
    const step = limit * (1 - (tick + 1) / steps);
    hub.setNextKinematicTranslation({
      x: edge === "right" ? step : 0,
      y: hubY,
      z: edge === "front" ? step : 0,
    });
    applyFullOpenMotor();
    physics.step();
  }
  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    applyFullOpenMotor();
    physics.step();
  }

  const recoveredPosition = finger.translation();
  return {
    contactTicks,
    finalContactTicks,
    recoveredContactPairs: physics.countBodyContactPairs(
      finger,
      glass,
    ),
    farTipCoordinate,
    farFingerCoordinate,
    recoveredFingerCoordinate: edge === "right"
      ? recoveredPosition.x : recoveredPosition.z,
    commandRadians: claw.openAngle,
  };
}

describe("Cabinet physical wall-contact regression", () => {
  it.each(["right", "front"] as const)(
    "keeps an open finger physical against %s glass and allows recovery",
    async (edge) => {
      const result = await simulateOpenClawWallContact(edge);
      console.log("Cabinet glass contact", edge, result);

      expect(result.contactTicks).toBeGreaterThan(0);
      expect(result.finalContactTicks).toBeGreaterThan(0);
      expect(result.recoveredContactPairs).toBe(0);
      expect(result.commandRadians).toBe(CLAW_LAB_CONFIG.openAngle);
      expect(Number.isFinite(result.farTipCoordinate)).toBe(true);
      expect(Number.isFinite(result.recoveredFingerCoordinate)).toBe(true);
      expect(Math.abs(result.recoveredFingerCoordinate)).toBeLessThan(0.25);

      // Must remain behind the *outer* glass surface, not visibly pass
      // through to the other side while the transport motor keeps opening.
      const outerSurface = edge === "right"
        ? M06_CABINET_CONFIG.interiorHalfX +
          M06_CABINET_CONFIG.wallHalfThickness * 2
        : M06_CABINET_CONFIG.interiorHalfZ +
          M06_CABINET_CONFIG.wallHalfThickness * 2;
      expect(result.farTipCoordinate).toBeLessThan(
        outerSurface + 0.006,
      );
    },
    15_000,
  );
});
