import { describe, expect, it } from "vitest";
import { createCabinetPhysics } from "../cabinet/cabinetGeometry";
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

describe("Cabinet physical wall-contact regression", () => {
  it("lets a fully-open real finger touch the right glass and recover when moved away", async () => {
    const physics = await PhysicsRuntime.create();
    const cabinet = createCabinetPhysics(physics);
    const claw = CLAW_LAB_CONFIG;
    const hubY = 0.93;

    // Use production collision geometry, hinge and the normal full-open
    // transport motor. No position-triggered finger opening adjustment.
    const hub = physics.createKinematicCylinder(
      { x: 0, y: hubY, z: 0 },
      claw.hubColliderHalfHeight,
      claw.collarRadius,
      0.55,
    );
    const pivotLocal = {
      x: claw.fingerPivotRadius,
      y: claw.fingerPivotY - claw.hubCenterY,
      z: 0,
    };
    const finger = physics.createDynamicCapsuleChain(
      {
        x: pivotLocal.x,
        y: hubY + pivotLocal.y,
        z: 0,
      },
      createFingerSegments(
        createFingerPoints(0),
        CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        CABINET_PLAY_TUNING.fingerLowerPadLengthMeters,
      ),
      {
        friction: CABINET_PLAY_TUNING.fingerFriction,
        restitution: claw.fingerRestitution,
        density: claw.fingerDensity,
      },
    );
    finger.setAngularDamping(
      M02_FINGER_TRANSPORT_CONFIG.angularDamping,
    );
    const hinge = physics.createRevoluteJoint(
      hub,
      finger,
      {
        anchor1: pivotLocal,
        anchor2: { x: 0, y: 0, z: 0 },
        axis: { x: 0, y: 0, z: 1 },
        minAngle: CABINET_PLAY_TUNING.closedAngleRadians,
        maxAngle: claw.openAngle,
        initialTarget: claw.openAngle,
        stiffness: claw.motorStiffness,
        damping: claw.motorDamping,
        maxTorque: CABINET_PLAY_TUNING.closePickupTorque,
        contactsEnabled: false,
      },
    );

    const applyFullOpenMotor = (): void => {
      hinge.configureMotorPosition(
        claw.openAngle,
        M02_FINGER_TRANSPORT_CONFIG.stiffness,
        M02_FINGER_TRANSPORT_CONFIG.damping,
      );
      hinge.setMotorMaxForce(
        M02_FINGER_TRANSPORT_CONFIG.maxTorque,
      );
      finger.wakeUp();
    };

    for (let tick = 0; tick < PHYSICS_HZ; tick++) {
      applyFullOpenMotor();
      physics.step();
    }

    let glassContactTicks = 0;
    const steps = PHYSICS_HZ * 3;
    for (let tick = 0; tick < steps; tick++) {
      const proportion = (tick + 1) / steps;
      hub.setNextKinematicTranslation({
        x: CABINET_GANTRY_TRAVEL_BOUNDS.xMax * proportion,
        y: hubY,
        z: 0,
      });
      applyFullOpenMotor();
      physics.step();

      if (physics.countBodyContactPairs(
        finger,
        cabinet.serviceDoorBody,
      ) > 0) {
        glassContactTicks++;
      }
    }

    expect(glassContactTicks).toBeGreaterThan(0);

    for (let tick = 0; tick < steps; tick++) {
      hub.setNextKinematicTranslation({
        x: CABINET_GANTRY_TRAVEL_BOUNDS.xMax *
          (1 - (tick + 1) / steps),
        y: hubY,
        z: 0,
      });
      applyFullOpenMotor();
      physics.step();
    }
    for (let tick = 0; tick < PHYSICS_HZ; tick++) {
      applyFullOpenMotor();
      physics.step();
    }

    expect(
      physics.countBodyContactPairs(
        finger,
        cabinet.serviceDoorBody,
      ),
    ).toBe(0);
    const recovered = finger.translation();
    expect(Number.isFinite(recovered.x)).toBe(true);
    expect(Number.isFinite(recovered.y)).toBe(true);
    expect(Number.isFinite(recovered.z)).toBe(true);
    expect(Math.abs(recovered.x)).toBeLessThan(0.25);
  }, 15_000);
});
