import { describe, expect, it } from "vitest";
import {
  CABINET_CLAW_PARK_POSITION,
  CABINET_PLAY_TUNING,
} from "../cabinet/cabinetPlayTuning";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "../cabinet/cabinetGeometry";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createPrize } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  createFingerPoints,
  createFingerSegments,
} from "../scenes/clawLab";
import {
  M02_FINGER_TRANSPORT_CONFIG,
  M02_GANTRY_CONFIG,
  advanceFingerCommandWithSelfContactGuard,
  updateFingerSelfContactGuard,
} from "../scenes/gantryLab";
import {
  advanceGantryMotionTowardPosition,
  isGantryAxisAtTarget,
  type GantryMotionConfig,
  type GantryMotionState,
} from "../scenes/gantryMotion";
import {
  M04_PLAY_CONFIG,
  advanceM04PlayState,
  applyM04Action,
  createM04PlayState,
  m04FingerShouldClose,
  m04ForcePhase,
  m04ReelCommand,
} from "../scenes/m04PlayCycle";
import {
  advanceReel,
  type ReelConfig,
  type ReelState,
} from "../scenes/reelMotion";
import { computeSuspensionStabilizerImpulse } from "../scenes/suspensionStabilizer";
import { createCabinetLayout } from "./cabinetLayouts";

const dt = 1 / PHYSICS_HZ;

function angularDistance(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
): number {
  const dot = Math.abs(
    a.x * b.x +
      a.y * b.y +
      a.z * b.z +
      a.w * b.w,
  );
  return 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
}

interface AttemptMetrics {
  targetX: number;
  targetZ: number;
  horizontalTravelMeters: number;
  rotationTravelRadians: number;
  peakLiftMeters: number;
  finalX: number;
  finalY: number;
  finalZ: number;
  completedCycle: boolean;
}

describe("M09 bridge production-claw manipulation", () => {
  it("diagnoses repeated bridge manipulation using the real production claw", async () => {
    const physics = await PhysicsRuntime.create();
    createCabinetPhysics(physics);

    const layout = createCabinetLayout(
      "bridge",
      "production-claw-closure",
    );
    const spawned = layout.placements.map((placement) => {
      const definition = getPrizeDefinition(placement.prizeId);
      return {
        placement,
        prize: createPrize(
          physics,
          definition,
          {
            position: {
              x: placement.x,
              y:
                M06_CABINET_CONFIG.playDeckY +
                definition.dimensions.y * 0.5 +
                placement.yOffsetMeters,
              z: placement.z,
            },
            rotationXRadians: placement.rotationXRadians,
            rotationYRadians: placement.rotationYRadians,
            variantSeed: placement.variantSeed,
          },
        ),
      };
    });

    for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
      physics.step();
    }

    const beam = spawned.find(
      (entry) => entry.placement.role === "bridge",
    );
    expect(beam).toBeDefined();

    const initialBeamPosition = beam!.prize.body.translation();
    const initialBeamRotation = beam!.prize.body.rotation();
    expect(initialBeamPosition.y).toBeGreaterThan(
      M06_CABINET_CONFIG.playDeckY + 0.095,
    );

    const claw = CLAW_LAB_CONFIG;
    const verticalHomeOffset =
      CABINET_PLAY_TUNING.verticalHomeOffsetMeters;
    const gantry = {
      ...M02_GANTRY_CONFIG,
      carriageY:
        M02_GANTRY_CONFIG.carriageY + verticalHomeOffset,
      reelMaxPayout:
        M02_GANTRY_CONFIG.reelMaxPayout +
        verticalHomeOffset,
    };
    const anchorY =
      gantry.carriageY - gantry.carriageHalfY;
    const initialHubY =
      anchorY - gantry.suspensionLength;

    const carriage = physics.createKinematicCuboid(
      {
        x: CABINET_CLAW_PARK_POSITION.x,
        y: gantry.carriageY,
        z: CABINET_CLAW_PARK_POSITION.z,
      },
      {
        x: gantry.carriageHalfX,
        y: gantry.carriageHalfY,
        z: gantry.carriageHalfZ,
      },
      0.45,
    );
    const reelAnchor = physics.createKinematicBody({
      x: CABINET_CLAW_PARK_POSITION.x,
      y: anchorY,
      z: CABINET_CLAW_PARK_POSITION.z,
    });
    const hub = physics.createDynamicCylinder(
      {
        x: CABINET_CLAW_PARK_POSITION.x,
        y: initialHubY,
        z: CABINET_CLAW_PARK_POSITION.z,
      },
      claw.hubColliderHalfHeight,
      claw.collarRadius,
      gantry.hubMassKg,
      {
        friction: 0.55,
        restitution: 0.02,
      },
    );
    hub.setAngularDamping(
      gantry.suspensionAngularDamping,
    );
    hub.setLinearDamping(
      gantry.suspensionLinearDamping,
    );
    physics.createSphericalJoint(
      reelAnchor,
      hub,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: gantry.suspensionLength, z: 0 },
      false,
    );

    const fingers = [];
    const joints = [];
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
        x: CABINET_CLAW_PARK_POSITION.x + pivotLocal.x,
        y: initialHubY + pivotLocal.y,
        z: CABINET_CLAW_PARK_POSITION.z + pivotLocal.z,
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
      finger.setAngularDamping(
        M02_FINGER_TRANSPORT_CONFIG.angularDamping,
      );
      const joint = physics.createRevoluteJoint(
        hub,
        finger,
        {
          anchor1: pivotLocal,
          anchor2: { x: 0, y: 0, z: 0 },
          axis: tangent,
          minAngle:
            CABINET_PLAY_TUNING.closedAngleRadians,
          maxAngle: claw.openAngle,
          initialTarget: claw.openAngle,
          stiffness: claw.motorStiffness,
          damping: claw.motorDamping,
          maxTorque:
            CABINET_PLAY_TUNING.closePickupTorque,
          contactsEnabled: false,
        },
      );

      fingers.push(finger);
      joints.push(joint);
    }

    const reelConfig: ReelConfig = {
      minPayout: gantry.reelMinPayout,
      maxPayout: gantry.reelMaxPayout,
      maxSpeed: gantry.reelMaxSpeed,
      acceleration: gantry.reelAcceleration,
      braking: gantry.reelBraking,
    };
    const motionConfig: GantryMotionConfig = {
      x: {
        minPosition: gantry.xMin,
        maxPosition: gantry.xMax,
        maxSpeed: gantry.maxSpeed,
        acceleration: gantry.acceleration,
        braking: gantry.braking,
      },
      z: {
        minPosition: gantry.zMin,
        maxPosition: gantry.zMax,
        maxSpeed: gantry.maxSpeed,
        acceleration: gantry.acceleration,
        braking: gantry.braking,
      },
    };
    const playConfig = {
      autoClosePayoutMeters:
        M04_PLAY_CONFIG.autoClosePayoutMeters +
        verticalHomeOffset,
      closedAngleRadians:
        CABINET_PLAY_TUNING.closedAngleRadians,
      openAngleRadians: claw.openAngle,
      closeCompletionToleranceRadians:
        M04_PLAY_CONFIG.closeCompletionToleranceRadians,
      releaseCompletionToleranceRadians:
        M04_PLAY_CONFIG.releaseCompletionToleranceRadians,
      closeSettleSeconds:
        M04_PLAY_CONFIG.closeSettleSeconds,
      pickupLiftDistanceMeters:
        CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
      holdBoostDurationSeconds:
        M04_PLAY_CONFIG.holdBoostDurationSeconds,
    };

    let motion: GantryMotionState = {
      x: {
        position: CABINET_CLAW_PARK_POSITION.x,
        velocity: 0,
      },
      z: {
        position: CABINET_CLAW_PARK_POSITION.z,
        velocity: 0,
      },
    };
    let reel: ReelState = { payout: 0, velocity: 0 };
    let fingerCommand = 0;
    let selfContactGuardActive = false;

    const applyStabilizer = (): void => {
      const position = hub.translation();
      const velocity = hub.linvel();
      const impulse =
        computeSuspensionStabilizerImpulse(
          {
            anchorX: motion.x.position,
            anchorZ: motion.z.position,
            anchorVelocityX: motion.x.velocity,
            anchorVelocityZ: motion.z.velocity,
            hubX: position.x,
            hubZ: position.z,
            hubVelocityX: velocity.x,
            hubVelocityZ: velocity.z,
          },
          {
            stiffness:
              gantry.suspensionSpringStiffness,
            damping:
              gantry.suspensionSpringDamping,
            maxForce:
              gantry.suspensionSpringMaxForce,
          },
          dt,
        );
      hub.applyImpulse(
        { x: impulse.x, y: 0, z: impulse.z },
        true,
      );
    };

    const updateKinematics = (): void => {
      carriage.setNextKinematicTranslation({
        x: motion.x.position,
        y: gantry.carriageY,
        z: motion.z.position,
      });
      reelAnchor.setNextKinematicTranslation({
        x: motion.x.position,
        y: anchorY - reel.payout,
        z: motion.z.position,
      });
    };

    const holdOpen = (): void => {
      for (const joint of joints) {
        joint.configureMotorPosition(
          fingerCommand,
          M02_FINGER_TRANSPORT_CONFIG.stiffness,
          M02_FINGER_TRANSPORT_CONFIG.damping,
        );
        joint.setMotorMaxForce(
          M02_FINGER_TRANSPORT_CONFIG.maxTorque,
        );
      }
    };

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      fingerCommand = advanceMotorCommand(
        fingerCommand,
        claw.openAngle,
        claw.motorSpeedRadiansPerSecond,
        dt,
      );
      holdOpen();
      updateKinematics();
      applyStabilizer();
      for (const finger of fingers) {
        finger.wakeUp();
      }
      hub.wakeUp();
      physics.step();
    }

    const tolerance = {
      position: gantry.homePositionTolerance,
      velocity: gantry.homeVelocityTolerance,
    };

    const moveOpenClawTo = (
      targetX: number,
      targetZ: number,
    ): void => {
      for (
        let tick = 0;
        tick < PHYSICS_HZ * 5;
        tick += 1
      ) {
        motion = advanceGantryMotionTowardPosition(
          motion,
          targetX,
          targetZ,
          motionConfig,
          dt,
        );
        updateKinematics();
        applyStabilizer();
        holdOpen();
        for (const finger of fingers) {
          finger.wakeUp();
        }
        hub.wakeUp();
        physics.step();

        if (
          isGantryAxisAtTarget(
            motion.x,
            targetX,
            tolerance,
          ) &&
          isGantryAxisAtTarget(
            motion.z,
            targetZ,
            tolerance,
          )
        ) {
          break;
        }
      }

      for (
        let tick = 0;
        tick < PHYSICS_HZ * 0.5;
        tick += 1
      ) {
        updateKinematics();
        applyStabilizer();
        holdOpen();
        physics.step();
      }
    };

    const runPlay = (
      targetX: number,
      targetZ: number,
    ): AttemptMetrics => {
      moveOpenClawTo(targetX, targetZ);

      const baselinePosition =
        beam!.prize.body.translation();
      const baselineRotation =
        beam!.prize.body.rotation();
      let peakBeamY = baselinePosition.y;

      let play = applyM04Action(
        createM04PlayState(),
        reel.payout,
      );
      let completedCycle = false;

      for (
        let tick = 0;
        tick < PHYSICS_HZ * 12;
        tick += 1
      ) {
        if (play.phase === "RETURNING") {
          motion = advanceGantryMotionTowardPosition(
            motion,
            CABINET_CLAW_PARK_POSITION.x,
            CABINET_CLAW_PARK_POSITION.z,
            motionConfig,
            dt,
          );
        }

        reel = advanceReel(
          reel,
          m04ReelCommand(play),
          reelConfig,
          dt,
        );

        const reelAtTop =
          reel.payout <=
            gantry.reelMinPayout + 1e-5 &&
          Math.abs(reel.velocity) < 1e-4;
        const homeReached =
          isGantryAxisAtTarget(
            motion.x,
            CABINET_CLAW_PARK_POSITION.x,
            tolerance,
          ) &&
          isGantryAxisAtTarget(
            motion.z,
            CABINET_CLAW_PARK_POSITION.z,
            tolerance,
          );

        play = advanceM04PlayState(
          play,
          {
            reelPayoutMeters: reel.payout,
            fingerCommandRadians: fingerCommand,
            fingerClosedByContact:
              selfContactGuardActive,
            reelAtTop,
            homeReached,
            holdBoostRequested: false,
          },
          playConfig,
          0,
        );

        updateKinematics();
        applyStabilizer();

        const closing =
          m04FingerShouldClose(play);
        const siblingFingerContact =
          closing &&
          (
            physics.countBodyContactPairs(
              fingers[0]!,
              fingers[1]!,
            ) > 0 ||
            physics.countBodyContactPairs(
              fingers[1]!,
              fingers[2]!,
            ) > 0 ||
            physics.countBodyContactPairs(
              fingers[2]!,
              fingers[0]!,
            ) > 0
          );
        selfContactGuardActive =
          updateFingerSelfContactGuard(
            selfContactGuardActive,
            closing,
            siblingFingerContact,
          );
        fingerCommand =
          advanceFingerCommandWithSelfContactGuard(
            fingerCommand,
            closing
              ? CABINET_PLAY_TUNING.closedAngleRadians
              : claw.openAngle,
            claw.motorSpeedRadiansPerSecond,
            dt,
            closing,
            selfContactGuardActive,
          );

        play = advanceM04PlayState(
          play,
          {
            reelPayoutMeters: reel.payout,
            fingerCommandRadians: fingerCommand,
            fingerClosedByContact:
              selfContactGuardActive,
            reelAtTop,
            homeReached,
            holdBoostRequested: false,
          },
          playConfig,
          dt,
        );

        const forcePhase = m04ForcePhase(play);
        const torque =
          forcePhase === "RETAINING"
            ? CABINET_PLAY_TUNING.retainingTorque
            : CABINET_PLAY_TUNING.closePickupTorque;

        for (const joint of joints) {
          joint.configureMotorPosition(
            fingerCommand,
            closing
              ? claw.motorStiffness
              : M02_FINGER_TRANSPORT_CONFIG.stiffness,
            closing
              ? claw.motorDamping
              : M02_FINGER_TRANSPORT_CONFIG.damping,
          );
          joint.setMotorMaxForce(
            closing
              ? torque
              : M02_FINGER_TRANSPORT_CONFIG.maxTorque,
          );
        }

        for (const finger of fingers) {
          finger.wakeUp();
        }
        hub.wakeUp();
        physics.step();

        peakBeamY = Math.max(
          peakBeamY,
          beam!.prize.body.translation().y,
        );

        if (play.phase === "READY") {
          completedCycle = true;
          break;
        }
      }

      for (
        let tick = 0;
        tick < PHYSICS_HZ;
        tick += 1
      ) {
        updateKinematics();
        applyStabilizer();
        holdOpen();
        physics.step();
      }

      const finalPosition =
        beam!.prize.body.translation();
      const finalRotation =
        beam!.prize.body.rotation();

      return {
        targetX,
        targetZ,
        horizontalTravelMeters: Math.hypot(
          finalPosition.x - baselinePosition.x,
          finalPosition.z - baselinePosition.z,
        ),
        rotationTravelRadians: angularDistance(
          baselineRotation,
          finalRotation,
        ),
        peakLiftMeters:
          peakBeamY - baselinePosition.y,
        finalX: finalPosition.x,
        finalY: finalPosition.y,
        finalZ: finalPosition.z,
        completedCycle,
      };
    };

    const approaches = [
      { x: 0.10, z: -0.02 },
      { x: -0.10, z: -0.02 },
      { x: 0.06, z: 0.07 },
    ];
    const attempts = approaches.map((approach) =>
      runPlay(approach.x, approach.z),
    );

    const finalBeamPosition =
      beam!.prize.body.translation();
    const finalBeamRotation =
      beam!.prize.body.rotation();
    const cumulativeTravel = Math.hypot(
      finalBeamPosition.x - initialBeamPosition.x,
      finalBeamPosition.z - initialBeamPosition.z,
    );
    const cumulativeRotation = angularDistance(
      initialBeamRotation,
      finalBeamRotation,
    );

    console.log(
      "M09 bridge production-claw repeated manipulation",
      JSON.stringify({
        attempts,
        initial: {
          x: initialBeamPosition.x,
          y: initialBeamPosition.y,
          z: initialBeamPosition.z,
        },
        final: {
          x: finalBeamPosition.x,
          y: finalBeamPosition.y,
          z: finalBeamPosition.z,
        },
        cumulativeTravelMeters: cumulativeTravel,
        cumulativeRotationRadians: cumulativeRotation,
      }),
    );

    expect(
      attempts.every(
        (attempt) => attempt.completedCycle,
      ),
    ).toBe(true);
    expect(Number.isFinite(cumulativeTravel)).toBe(true);
    expect(Number.isFinite(cumulativeRotation)).toBe(true);
  }, 30_000);
});
