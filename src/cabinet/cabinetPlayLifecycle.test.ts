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
  it("physically lifts a high-stack ball, returns it over the chute, motor-releases it, then records one win", async () => {
    const physics = await PhysicsRuntime.create();
    const claw = CLAW_LAB_CONFIG;
    const gantry = M02_GANTRY_CONFIG;
    createCabinetPhysics(physics);

    const startX = -0.155;
    const startZ = 0.20;
    const targetX = M06_CABINET_CONFIG.chuteCenterX;
    const targetZ = M06_CABINET_CONFIG.chuteCenterZ;
    const initialPayout = 0.07;
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
          initialTarget: claw.openAngle,
          stiffness: claw.motorStiffness,
          damping: claw.motorDamping,
          maxTorque: claw.maxMotorTorque,
          contactsEnabled: false,
        });

      fingers.push(finger);
      joints.push(joint);
    }

    const definition = getPrizeDefinition("prize/sphere_ball");
    const radius = definition.dimensions.x * 0.5;
    const hubToBallCenter =
      claw.hubCenterY - claw.pt001BallCenterY;
    const ballCenterY =
      initialHubY -
      hubToBallCenter +
      0.015;
    const pedestalTopY = ballCenterY - radius;
    const pedestalHalfHeight =
      (pedestalTopY - M06_CABINET_CONFIG.playDeckY) * 0.5;

    expect(pedestalHalfHeight).toBeGreaterThan(0.07);

    physics.createStaticCylinder(
      {
        x: startX,
        y:
          M06_CABINET_CONFIG.playDeckY +
          pedestalHalfHeight,
        z: startZ,
      },
      pedestalHalfHeight,
      claw.pt001PedestalRadius,
      0.75,
    );

    const ball = createPrize(physics, definition, {
      position: {
        x: startX,
        y: ballCenterY,
        z: startZ,
      },
      materialId: "material/rubber",
      massProfileId: "mass/light",
      comProfileId: "com/centered",
      variantSeed: "m06-high-stack-return-ball",
    });
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
      ball.body.wakeUp();
    };

    // Settle the high-stack prize with the claw fully open.
    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      driveFinger(
        claw.openAngle,
        M02_FINGER_TRANSPORT_CONFIG.maxTorque,
        true,
      );
      physics.step();
    }

    const baselineBallY = ball.body.translation().y;

    // Match production M04: finish the close, then hold the 0.90 s settle window.
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

    let retainingTick: number | null = null;
    let returningTick: number | null = null;
    let releaseTick: number | null = null;
    let sensorTick: number | null = null;
    let readyTick: number | null = null;
    let liftAtRetainingMeters = Number.NaN;
    let liftAtReturnMeters = Number.NaN;
    let maxLiftMeters = 0;
    let returnStartBallPosition: {
      x: number;
      y: number;
      z: number;
    } | null = null;
    let ballTravelAtRelease = Number.NaN;
    let maxHubLagMeters = 0;
    let maxBallStepMeters = 0;
    let maxBoostUsedSeconds = 0;
    let sensorEvents = 0;
    let finiteAndBounded = true;
    let previousBallPosition = {
      x: ball.body.translation().x,
      y: ball.body.translation().y,
      z: ball.body.translation().z,
    };

    for (let tick = 1; tick <= PHYSICS_HZ * 6; tick += 1) {
      const phaseAtTickStart = play.phase;

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
        m04ReelCommand(play),
        reelConfig,
        dt,
      );

      const reelAtTop =
        reel.payout <= gantry.reelMinPayout + 1e-5 &&
        Math.abs(reel.velocity) < 1e-4;
      const homeReached =
        isGantryAxisAtTarget(motion.x, targetX, tolerance) &&
        isGantryAxisAtTarget(motion.z, targetZ, tolerance);

      const beforeImmediate = play.phase;
      play = advanceM04PlayState(
        play,
        {
          reelPayoutMeters: reel.payout,
          fingerCommandRadians: fingerCommand,
          reelAtTop,
          homeReached,
          holdBoostRequested:
            play.phase === "RETAINING" ||
            play.phase === "RETURNING",
        },
        playConfig,
        0,
      );

      if (
        beforeImmediate === "PICKUP" &&
        play.phase === "RETAINING" &&
        retainingTick === null
      ) {
        retainingTick = tick;
        liftAtRetainingMeters =
          ball.body.translation().y - baselineBallY;
      }

      if (
        beforeImmediate !== "RETURNING" &&
        play.phase === "RETURNING" &&
        returningTick === null
      ) {
        returningTick = tick;
        const p = ball.body.translation();
        returnStartBallPosition = {
          x: p.x,
          y: p.y,
          z: p.z,
        };
        liftAtReturnMeters = p.y - baselineBallY;
      }

      if (
        beforeImmediate === "RETURNING" &&
        play.phase === "RELEASING" &&
        releaseTick === null
      ) {
        releaseTick = tick;
        const p = ball.body.translation();
        if (returnStartBallPosition) {
          ballTravelAtRelease = Math.hypot(
            p.x - returnStartBallPosition.x,
            p.z - returnStartBallPosition.z,
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
      const boostRequested =
        play.phase === "RETAINING" ||
        play.phase === "RETURNING";
      const boostActive = m04HoldBoostActive(
        play,
        boostRequested,
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
          ? boostActive
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
          holdBoostRequested: boostRequested,
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
      ball.body.wakeUp();

      physics.step();

      const currentHub = hub.translation();
      maxHubLagMeters = Math.max(
        maxHubLagMeters,
        Math.hypot(
          currentHub.x - motion.x.position,
          currentHub.z - motion.z.position,
        ),
      );

      const p = ball.body.translation();
      maxLiftMeters = Math.max(
        maxLiftMeters,
        p.y - baselineBallY,
      );
      maxBallStepMeters = Math.max(
        maxBallStepMeters,
        Math.hypot(
          p.x - previousBallPosition.x,
          p.y - previousBallPosition.y,
          p.z - previousBallPosition.z,
        ),
      );
      previousBallPosition = { x: p.x, y: p.y, z: p.z };

      finiteAndBounded =
        finiteAndBounded &&
        [p.x, p.y, p.z].every(Number.isFinite) &&
        Math.abs(p.x) < 0.50 &&
        Math.abs(p.z) < 0.40 &&
        p.y > -0.34 &&
        p.y < 1.20;

      const event = sensor.pollPrize(
        "m06-carried-ball",
        ball.body,
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

    const finalBall = ball.body.translation();
    const returnDistance = Math.hypot(
      targetX - startX,
      targetZ - startZ,
    );

    console.log(
      "M06 high-stack ball lifecycle metrics",
      JSON.stringify({
        initialPayout,
        startX,
        startZ,
        targetX,
        targetZ,
        returnDistance,
        retainingTick,
        returningTick,
        releaseTick,
        sensorTick,
        readyTick,
        liftAtRetainingMeters,
        liftAtReturnMeters,
        maxLiftMeters,
        ballTravelAtRelease,
        maxHubLagMeters,
        maxBallStepMeters,
        maxBoostUsedSeconds,
        sensorEvents,
        sensorWins: sensor.winCount,
        finalBall: {
          x: finalBall.x,
          y: finalBall.y,
          z: finalBall.z,
        },
        finiteAndBounded,
      }),
    );

    expect(finiteAndBounded).toBe(true);
    expect(retainingTick).not.toBeNull();
    expect(liftAtRetainingMeters).toBeGreaterThan(0.015);
    expect(maxLiftMeters).toBeGreaterThan(0.025);
    expect(returningTick).not.toBeNull();
    expect(liftAtReturnMeters).toBeGreaterThan(0.010);
    expect(releaseTick).not.toBeNull();
    expect(releaseTick!).toBeGreaterThan(returningTick!);
    expect(ballTravelAtRelease).toBeGreaterThan(0.05);
    expect(maxHubLagMeters).toBeGreaterThan(0.001);
    expect(maxHubLagMeters).toBeLessThan(0.05);
    expect(maxBallStepMeters).toBeLessThan(0.020);
    expect(maxBoostUsedSeconds).toBeGreaterThan(0);
    expect(maxBoostUsedSeconds).toBeLessThanOrEqual(
      M04_PLAY_CONFIG.holdBoostDurationSeconds + 1e-8,
    );
    expect(sensorTick).not.toBeNull();
    expect(sensorTick!).toBeGreaterThan(releaseTick!);
    expect(sensorEvents).toBe(1);
    expect(sensor.winCount).toBe(1);
    expect(readyTick).not.toBeNull();
    expect(finalBall.y).toBeLessThan(
      M06_CABINET_CONFIG.playDeckY - 0.10,
    );

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      physics.step();
      expect(
        sensor.pollPrize("m06-carried-ball", ball.body),
      ).toBeNull();
    }
    expect(sensor.winCount).toBe(1);
  }, 15_000);
});
