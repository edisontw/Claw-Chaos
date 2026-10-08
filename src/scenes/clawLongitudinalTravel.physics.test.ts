import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createCabinetPhysics,
  M06_CABINET_CONFIG,
} from "../cabinet/cabinetGeometry";
import {
  CABINET_GANTRY_TRAVEL_BOUNDS,
  CABINET_PLAY_TUNING,
} from "../cabinet/cabinetPlayTuning";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime, type RigidBodyHandle } from "../physics/PhysicsRuntime";
import {
  CLAW_LAB_CONFIG,
  createFingerPoints,
  createFingerSegments,
} from "./clawLab";
import { M02_FINGER_TRANSPORT_CONFIG } from "./gantryLab";

type LongitudinalEnd = "front" | "back";

interface TripodContactMetrics {
  contactTicks: number;
  maximumTipHeightSpreadMeters: number;
  finalTipHeightSpreadMeters: number;
  recoveredTipHeightSpreadMeters: number;
  recoveredWallContacts: number;
}

function worldTipHeight(body: RigidBodyHandle, theta: number): number {
  const tip = createFingerPoints(theta).at(-1)!;
  const pos = body.translation();
  const rot = body.rotation();
  return new THREE.Vector3(tip.x, tip.y, tip.z)
    .applyQuaternion(new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w))
    .add(new THREE.Vector3(pos.x, pos.y, pos.z)).y;
}

async function measureTripodAgainstWindow(
  end: LongitudinalEnd,
): Promise<TripodContactMetrics> {
  const physics = await PhysicsRuntime.create();
  const cabinet = createCabinetPhysics(physics);
  const claw = CLAW_LAB_CONFIG;
  const hubY = 0.93;
  const hub = physics.createKinematicCylinder(
    { x: 0, y: hubY, z: 0 },
    claw.hubColliderHalfHeight,
    claw.collarRadius,
    0.55,
  );

  const fingers: Array<{
    body: RigidBodyHandle;
    theta: number;
    commandOpen: () => void;
  }> = [];
  const thetas = [0, 2 * Math.PI / 3, 4 * Math.PI / 3];
  for (const theta of thetas) {
    const radialX = Math.cos(theta);
    const radialZ = Math.sin(theta);
    const pivot = {
      x: radialX * claw.fingerPivotRadius,
      y: claw.fingerPivotY - claw.hubCenterY,
      z: radialZ * claw.fingerPivotRadius,
    };
    const finger = physics.createDynamicCapsuleChain(
      {
        x: pivot.x,
        y: hubY + pivot.y,
        z: pivot.z,
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
    finger.setAngularDamping(
      M02_FINGER_TRANSPORT_CONFIG.angularDamping,
    );
    const joint = physics.createRevoluteJoint(
      hub,
      finger,
      {
        anchor1: pivot,
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
    fingers.push({
      body: finger,
      theta,
      commandOpen: () => {
        joint.configureMotorPosition(
          claw.openAngle,
          M02_FINGER_TRANSPORT_CONFIG.stiffness,
          M02_FINGER_TRANSPORT_CONFIG.damping,
        );
        joint.setMotorMaxForce(
          M02_FINGER_TRANSPORT_CONFIG.maxTorque,
        );
        finger.wakeUp();
      },
    });
  }

  const wall = end === "front"
    ? cabinet.frontGlassBody
    : cabinet.backWallBody;
  const endZ = end === "front"
    ? CABINET_GANTRY_TRAVEL_BOUNDS.zMax
    : CABINET_GANTRY_TRAVEL_BOUNDS.zMin;

  const openAndStep = (): void => {
    for (const finger of fingers) {
      finger.commandOpen();
    }
    physics.step();
  };
  const spread = (): number => {
    const heights = fingers.map((entry) =>
      worldTipHeight(entry.body, entry.theta));
    return Math.max(...heights) - Math.min(...heights);
  };
  const contacts = (): number =>
    fingers.reduce((sum, entry) =>
      sum + physics.countBodyContactPairs(entry.body, wall), 0);

  // Allow the three independent open fingers to settle in free space.
  for (let tick = 0; tick < PHYSICS_HZ; tick++) {
    openAndStep();
  }

  let contactTicks = 0;
  let maximumTipHeightSpreadMeters = 0;
  const travelTicks = PHYSICS_HZ;
  for (let tick = 0; tick < travelTicks; tick++) {
    hub.setNextKinematicTranslation({
      x: 0,
      y: hubY,
      z: endZ * (tick + 1) / travelTicks,
    });
    openAndStep();
    maximumTipHeightSpreadMeters = Math.max(
      maximumTipHeightSpreadMeters,
      spread(),
    );
    if (contacts() > 0) {
      contactTicks++;
    }
  }
  for (let tick = 0; tick < PHYSICS_HZ; tick++) {
    openAndStep();
    maximumTipHeightSpreadMeters = Math.max(
      maximumTipHeightSpreadMeters,
      spread(),
    );
    if (contacts() > 0) {
      contactTicks++;
    }
  }

  const finalTipHeightSpreadMeters = spread();
  for (let tick = 0; tick < travelTicks; tick++) {
    hub.setNextKinematicTranslation({
      x: 0,
      y: hubY,
      z: endZ * (1 - (tick + 1) / travelTicks),
    });
    openAndStep();
  }
  for (let tick = 0; tick < PHYSICS_HZ; tick++) {
    openAndStep();
  }

  return {
    contactTicks,
    maximumTipHeightSpreadMeters,
    finalTipHeightSpreadMeters,
    recoveredTipHeightSpreadMeters: spread(),
    recoveredWallContacts: contacts(),
  };
}

describe("Production three-finger glass end-stop", () => {
  it.each(["front", "back"] as const)(
    "prevents deep %s-wall overdrive without automatic finger narrowing",
    async (end) => {
      const result = await measureTripodAgainstWindow(end);
      console.log("three-finger wall contact", end, JSON.stringify(result));

      expect(result.contactTicks).toBeGreaterThan(0);
      expect(result.maximumTipHeightSpreadMeters).toBeLessThan(0.060);
      expect(result.finalTipHeightSpreadMeters).toBeLessThan(0.035);
      expect(result.recoveredTipHeightSpreadMeters).toBeLessThan(0.030);
      expect(result.recoveredWallContacts).toBe(0);
      expect(Math.abs(
        end === "front"
          ? CABINET_GANTRY_TRAVEL_BOUNDS.zMax
          : CABINET_GANTRY_TRAVEL_BOUNDS.zMin,
      )).toBeGreaterThanOrEqual(
        M06_CABINET_CONFIG.chuteCenterZ,
      );
    },
    15_000,
  );
});
