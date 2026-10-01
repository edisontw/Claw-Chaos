import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import type {
  RevoluteJointHandle,
  RigidBodyHandle,
} from "../physics/PhysicsRuntime";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { getPrizeDefinition } from "../prizes/catalog";
import { createPrize } from "../prizes/PrizeFactory";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  createFingerPoints,
  createFingerSegments,
} from "../scenes/clawLab";
import {
  M02_FINGER_TRANSPORT_CONFIG,
  M02_GANTRY_CONFIG,
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
  m04FingerShouldClose,
  m04ForcePhase,
  m04HoldBoostActive,
  m04ReelCommand,
  type M04PlayState,
} from "../scenes/m04PlayCycle";
import {
  advanceReel,
  type ReelConfig,
  type ReelState,
} from "../scenes/reelMotion";
import { computeSuspensionStabilizerImpulse } from "../scenes/suspensionStabilizer";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "./cabinetGeometry";
import { ChuteSensor } from "./chuteSensor";

const dt = 1 / PHYSICS_HZ;

describe("M06 carried-prize cabinet lifecycle", () => {
  it("physically hooks, lifts, returns, motor-releases and senses a PrizeFactory Teddy without teleport", async () => {
    const physics = await PhysicsRuntime.create();
    const claw = CLAW_LAB_CONFIG;
    const gantry = M02_GANTRY_CONFIG;
    createCabinetPhysics(physics);

    const startX = 0.145;
    const startZ = 0.13;
    const targetX = M06_CABINET_CONFIG.chuteCenterX;
    const targetZ = M06_CABINET_CONFIG.chuteCenterZ;
    const initialPayout = 0.18;
    const anchorY = gantry.carriageY - gantry.carriageHalfY;
    const initialAnchorY = anchorY - initialPayout;
    const initialHubY = initialAnchorY - gantry.suspensionLength;

    const carriage = physics.createKinematicCuboid(
      { x: startX, y: gantry.carriageY, z: startZ },
      {
        x: gantry.carriageHalfX,
        y: gantry.carriageHalfY,
        z: gantry.carriageHalfZ,
      },
      0.45,
    );
    const reelAnchor = physics.createKinematicBody({
      x: startX,
      y: initialAnchorY,
      z: startZ,
    });
    const hub = physics.createDynamicCylinder(
      { x: startX, y: initialHubY, z: startZ },
      claw.hubColliderHalfHeight,
      claw.collarRadius,
      gantry.hubMassKg,
      {
        friction: 0.55,
        restitution: 0.02,
      },
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
        x: startX + pivotLocal.x,
        y: initialHubY + pivotLocal.y,
        z: startZ + pivotLocal.z,
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
      finger.setAngularDamping(
        M02_FINGER_TRANSPORT_CONFIG.angularDamping,
      );
      const joint: RevoluteJointHandle =
        physics.createRevoluteJoint(hub, finger, {
          anchor1: pivotLocal,
          anchor2: { x: 0, y: 0, z: 0 },
          axis: tangent,
          minAngle: claw.closedAngle,
          maxAngle: claw.openAngle,
          initialTarget: 0,
          stiffness: claw.motorStiffness,
          damping: claw.motorDamping,
          maxTorque: claw.maxMotorTorque,
          contactsEnabled: false,
        });
      fingers.push(finger);
      joints.push(joint);
    }

    // Reuse the proven PT-004 hook geometry in the cabinet coordinate frame.
    const verticalOffset = initialHubY - claw.hubCenterY;
    const teddyCenterX = startX + claw.pt004BodyOffsetX;
    const teddyCenterY = claw.pt004BodyCenterY + verticalOffset;
    const supportTopY =
      claw.pt004SupportCenterY +
      claw.pt004SupportHalfY +
      verticalOffset;
    const supportHalfY =
      (supportTopY - M06_CABINET_CONFIG.playDeckY) * 0.5;

    expect(supportHalfY).toBeGreaterThan(0.02);

    physics.createStaticCuboid(
      {
        x: teddyCenterX,
        y:
          M06_CABINET_CONFIG.playDeckY +
          supportHalfY,
        z: startZ,
      },
      {
        x: claw.pt004SupportHalfX,
        y: supportHalfY,
        z: claw.pt004SupportHalfZ,
      },
      0.90,
    );

    const halfRotation = claw.pt004InitialRotationX * 0.5;
    const teddy = createPrize(
      physics,
      getPrizeDefinition("prize/teddy_simple"),
      {
        position: {
          x: teddyCenterX,
          y: teddyCenterY,
          z: startZ,
        },
        rotation: {
          x: Math.sin(halfRotation),
          y: 0,
          z: 0,
          w: Math.cos(halfRotation),
        },
        materialId: "material/plush",
        massProfileId: "mass/standard",
        comProfileId: "com/centered",
        variantSeed: "m06-return-release-teddy",
      },
    );
    const sensor = new ChuteSensor();

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
      autoClosePayoutMeters: M04_PLAY_CONFIG.autoClosePayoutMeters,
      closedAngleRadians: claw.closedAngle,
      openAngleRadians: claw.openAngle,
      closeCompletionToleranceRadians:
        M04_PLAY_CONFIG.closeCompletionToleranceRadians,
      releaseCompletionToleranceRadians:
        M04_PLAY_CONFIG.releaseCompletionToleranceRadians,
      closeSettleSeconds: M04_PLAY_CONFIG.closeSettleSeconds,
      pickupLiftDistanceMeters:
        M04_PLAY_CONFIG.pickupLiftDistanceMeters,
      holdBoostDurationSeconds:
        M04_PLAY_CONFIG.holdBoostDurationSeconds,
    };

    let motion: GantryMotionState = {
      x: { position: startX, velocity: 0 },
      z: { position: startZ, velocity: 0 },
    };
    let reel: ReelState = {
      payout: initialPayout,
      velocity: 0,
    };
    let fingerCommand = 0;

    const driveFinger = (
      target: number,
      maxTorque: number,
      transport = false,
    ): void => {
      fingerCommand = advanceMotorCommand(
        fingerCommand,
        target,
        claw.motorSpeedRadiansPerSecond,
        dt,
      );
      for (const joint of joints) {
        joint.configureMotorPosition(
          fingerCommand,
          transport
            ? M02_FINGER_TRANSPORT_CONFIG.stiffness
            : claw.motorStiffness,
          transport
            ? M02_FINGER_TRANSPORT_CONFIG.damping
            : claw.motorDamping,
        );
        joint.setMotorMaxForce(
          transport
            ? M02_FINGER_TRANSPORT_CONFIG.maxTorque
            : maxTorque,
        );
      }
      for (const finger of fingers) {
        finger.wakeUp();
      }
      hub.wakeUp();
      teddy.body.wakeUp();
    };

    // Let the lying Teddy settle while the claw reaches its open pose.
    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      driveFinger(
        claw.openAngle,
        M02_FINGER_TRANSPORT_CONFIG.maxTorque,
        true,
      );
      physics.step();
    }

    const teddyReferenceY = teddy.body.translation().y;

    // Follow the production M04 contact timing before pickup:
    // fully close under the strong contact profile, then settle for 0.90 s.
    while (
      fingerCommand >
      claw.closedAngle +
        M04_PLAY_CONFIG.closeCompletionToleranceRadians
    ) {
      driveFinger(claw.closedAngle, claw.maxMotorTorque);
      physics.step();
    }

    for (
      let tick = 0;
      tick < Math.ceil(M04_PLAY_CONFIG.closeSettleSeconds * PHYSICS_HZ);
      tick += 1
    ) {
      driveFinger(claw.closedAngle, claw.maxMotorTorque);
      physics.step();
    }

    let play: M04PlayState = {
      phase: "PICKUP",
      phaseElapsedSeconds: 0,
      closeReason: "AUTO",
      closeStartPayoutMeters: initialPayout,
      pickupStartPayoutMeters: initialPayout,
      retainingStartPayoutMeters: null,
      holdBoostUsedSeconds: 0,
    };

    const tolerance = {
      position: gantry.homePositionTolerance,
      velocity: gantry.homeVelocityTolerance,
    };

    let returningTick: number | null = null;
    let releaseTick: number | null = null;
    let sensorTick: number | null = null;
    let readyTick: number | null = null;
    let maxLiftMeters = 0;
    let liftAtReturnMeters = Number.NaN;
    let returnStartPrizePosition: {
      x: number;
      y: number;
      z: number;
    } | null = null;
    let prizeTravelAtRelease = Number.NaN;
    let maxHubLagMeters = 0;
    let maxPrizeStepMeters = 0;
    let maxBoostUsedSeconds = 0;
    let sensorEvents = 0;
    let finiteAndBounded = true;
    let previousPrizePosition = {
      x: teddy.body.translation().x,
      y: teddy.body.translation().y,
      z: teddy.body.translation().z,
    };

    for (let tick = 1; tick <= PHYSICS_HZ * 8; tick += 1) {
      const phaseAtTickStart = play.phase;
      const reelCommand = m04ReelCommand(play);

      if (phaseAtTickStart === "RETURNING") {
        motion = advanceGantryMotionTowardPosition(
          motion,
          targetX,
          targetZ,
          motionConfig,
          dt,
        );
      }

      reel = advanceReel(
        reel,
        reelCommand,
        reelConfig,
        dt,
      );

      const reelAtTop =
        reel.payout <= gantry.reelMinPayout + 1e-5 &&
        Math.abs(reel.velocity) < 1e-4;
      const homeReached =
        isGantryAxisAtTarget(motion.x, targetX, tolerance) &&
        isGantryAxisAtTarget(motion.z, targetZ, tolerance);
      const boostRequested =
        phaseAtTickStart === "RETURNING";

      const beforeImmediate = play.phase;
      play = advanceM04PlayState(
        play,
        {
          reelPayoutMeters: reel.payout,
          fingerCommandRadians: fingerCommand,
          reelAtTop,
          homeReached,
          holdBoostRequested: boostRequested,
        },
        playConfig,
        0,
      );

      if (
        beforeImmediate !== "RETURNING" &&
        play.phase === "RETURNING" &&
        returningTick === null
      ) {
        returningTick = tick;
        const p = teddy.body.translation();
        returnStartPrizePosition = {
          x: p.x,
          y: p.y,
          z: p.z,
        };
        liftAtReturnMeters = p.y - teddyReferenceY;
      }

      if (
        beforeImmediate === "RETURNING" &&
        play.phase === "RELEASING" &&
        releaseTick === null
      ) {
        releaseTick = tick;
        const p = teddy.body.translation();
        if (returnStartPrizePosition) {
          prizeTravelAtRelease = Math.hypot(
            p.x - returnStartPrizePosition.x,
            p.z - returnStartPrizePosition.z,
          );
        }
      }

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

      const hubPosition = hub.translation();
      const hubVelocity = hub.linvel();
      const stabilizerImpulse = computeSuspensionStabilizerImpulse(
        {
          anchorX: motion.x.position,
          anchorZ: motion.z.position,
          anchorVelocityX: motion.x.velocity,
          anchorVelocityZ: motion.z.velocity,
          hubX: hubPosition.x,
          hubZ: hubPosition.z,
          hubVelocityX: hubVelocity.x,
          hubVelocityZ: hubVelocity.z,
        },
        {
          stiffness: gantry.suspensionSpringStiffness,
          damping: gantry.suspensionSpringDamping,
          maxForce: gantry.suspensionSpringMaxForce,
        },
        dt,
      );
      hub.applyImpulse(
        { x: stabilizerImpulse.x, y: 0, z: stabilizerImpulse.z },
        true,
      );

      const closing = m04FingerShouldClose(play);
      const holdBoostActive = m04HoldBoostActive(
        play,
        play.phase === "RETURNING",
        playConfig,
      );
      fingerCommand = advanceMotorCommand(
        fingerCommand,
        closing ? claw.closedAngle : claw.openAngle,
        claw.motorSpeedRadiansPerSecond,
        dt,
      );

      const forcePhase = m04ForcePhase(play);
      const activeTorque =
        forcePhase === "RETAINING"
          ? holdBoostActive
            ? M04_PLAY_CONFIG.holdBoostTorque
            : claw.pt002RetainingTorque
          : claw.maxMotorTorque;

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
            ? activeTorque
            : M02_FINGER_TRANSPORT_CONFIG.maxTorque,
        );
      }

      play = advanceM04PlayState(
        play,
        {
          reelPayoutMeters: reel.payout,
          fingerCommandRadians: fingerCommand,
          reelAtTop,
          homeReached,
          holdBoostRequested: play.phase === "RETURNING",
        },
        playConfig,
        dt,
      );
      maxBoostUsedSeconds = Math.max(
        maxBoostUsedSeconds,
        play.holdBoostUsedSeconds,
      );

      for (const finger of fingers) {
        finger.wakeUp();
      }
      hub.wakeUp();
      teddy.body.wakeUp();
      physics.step();

      const currentHub = hub.translation();
      maxHubLagMeters = Math.max(
        maxHubLagMeters,
        Math.hypot(
          currentHub.x - motion.x.position,
          currentHub.z - motion.z.position,
        ),
      );

      const p = teddy.body.translation();
      const lift = p.y - teddyReferenceY;
      maxLiftMeters = Math.max(maxLiftMeters, lift);
      maxPrizeStepMeters = Math.max(
        maxPrizeStepMeters,
        Math.hypot(
          p.x - previousPrizePosition.x,
          p.y - previousPrizePosition.y,
          p.z - previousPrizePosition.z,
        ),
      );
      previousPrizePosition = { x: p.x, y: p.y, z: p.z };

      finiteAndBounded =
        finiteAndBounded &&
        [p.x, p.y, p.z].every(Number.isFinite) &&
        Math.abs(p.x) < 0.50 &&
        Math.abs(p.z) < 0.40 &&
        p.y > -0.34 &&
        p.y < 1.20;

      const event = sensor.pollPrize(
        "m06-carried-teddy",
        teddy.body,
      );
      if (event) {
        sensorEvents += 1;
        sensorTick ??= tick;
      }

      if (play.phase === "READY") {
        readyTick ??= tick;
      }

      if (
        sensorTick !== null &&
        readyTick !== null &&
        tick > sensorTick + PHYSICS_HZ / 2
      ) {
        break;
      }
    }

    const finalPrize = teddy.body.translation();
    const returnDistance = Math.hypot(
      targetX - startX,
      targetZ - startZ,
    );

    console.log(
      "M06 Teddy hook lifecycle metrics",
      JSON.stringify({
        initialPayout,
        startX,
        startZ,
        targetX,
        targetZ,
        returnDistance,
        maxLiftMeters,
        liftAtReturnMeters,
        returningTick,
        releaseTick,
        sensorTick,
        readyTick,
        prizeTravelAtRelease,
        maxHubLagMeters,
        maxPrizeStepMeters,
        maxBoostUsedSeconds,
        sensorEvents,
        sensorWins: sensor.winCount,
        finalPrize: {
          x: finalPrize.x,
          y: finalPrize.y,
          z: finalPrize.z,
        },
        finiteAndBounded,
      }),
    );

    expect(finiteAndBounded).toBe(true);
    expect(maxLiftMeters).toBeGreaterThanOrEqual(
      claw.pt004MinPeakLift,
    );
    expect(returningTick).not.toBeNull();
    expect(liftAtReturnMeters).toBeGreaterThan(0.02);
    expect(releaseTick).not.toBeNull();
    expect(releaseTick!).toBeGreaterThan(returningTick!);
    expect(prizeTravelAtRelease).toBeGreaterThan(0.05);
    expect(maxHubLagMeters).toBeGreaterThan(0.001);
    expect(maxHubLagMeters).toBeLessThan(0.05);
    expect(maxPrizeStepMeters).toBeLessThan(0.025);
    expect(maxBoostUsedSeconds).toBeGreaterThan(0);
    expect(maxBoostUsedSeconds).toBeLessThanOrEqual(
      M04_PLAY_CONFIG.holdBoostDurationSeconds + 1e-8,
    );
    expect(sensorTick).not.toBeNull();
    expect(sensorTick!).toBeGreaterThan(releaseTick!);
    expect(sensorEvents).toBe(1);
    expect(sensor.winCount).toBe(1);
    expect(readyTick).not.toBeNull();
    expect(finalPrize.y).toBeLessThan(
      M06_CABINET_CONFIG.playDeckY - 0.10,
    );

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      physics.step();
      expect(
        sensor.pollPrize("m06-carried-teddy", teddy.body),
      ).toBeNull();
    }
    expect(sensor.winCount).toBe(1);
  }, 15_000);
});
