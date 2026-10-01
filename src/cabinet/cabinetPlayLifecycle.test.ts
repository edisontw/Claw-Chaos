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
  m04HoldBoostActive,
  type M04PlayState,
} from "../scenes/m04PlayCycle";
import { computeSuspensionStabilizerImpulse } from "../scenes/suspensionStabilizer";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "./cabinetGeometry";
import { ChuteSensor } from "./chuteSensor";

const dt = 1 / PHYSICS_HZ;

describe("M06 carried-prize cabinet lifecycle", () => {
  it("physically returns a held prize over the chute, releases it by motor opening, then records one sensor win", async () => {
    const physics = await PhysicsRuntime.create();
    const claw = CLAW_LAB_CONFIG;
    const gantry = M02_GANTRY_CONFIG;
    createCabinetPhysics(physics);

    const startX = 0.12;
    const startZ = 0.08;
    const targetX = M06_CABINET_CONFIG.chuteCenterX;
    const targetZ = M06_CABINET_CONFIG.chuteCenterZ;
    const anchorY = gantry.carriageY - gantry.carriageHalfY;
    const initialHubY = anchorY - gantry.suspensionLength;

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
      y: anchorY,
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
    const hubToPrizeCenter =
      claw.hubCenterY - claw.pt001BallCenterY;
    const prizeCenterY =
      initialHubY - hubToPrizeCenter + 0.012;
    const pedestalTopY = prizeCenterY - radius;
    const pedestalHalfHeight =
      (pedestalTopY - M06_CABINET_CONFIG.playDeckY) * 0.5;

    physics.createStaticCylinder(
      {
        x: startX,
        y:
          M06_CABINET_CONFIG.playDeckY +
          pedestalHalfHeight,
        z: startZ,
      },
      pedestalHalfHeight,
      0.036,
      0.76,
    );

    const prize = createPrize(physics, definition, {
      position: {
        x: startX,
        y: prizeCenterY,
        z: startZ,
      },
      materialId: "material/rubber",
      massProfileId: "mass/light",
      comProfileId: "com/centered",
      variantSeed: "m06-return-release",
    });
    const sensor = new ChuteSensor();

    let fingerCommand = claw.openAngle;

    const setFingerMotor = (
      target: number,
      maxTorque: number,
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
          claw.motorStiffness,
          claw.motorDamping,
        );
        joint.setMotorMaxForce(maxTorque);
      }
      for (const finger of fingers) {
        finger.wakeUp();
      }
      hub.wakeUp();
      prize.body.wakeUp();
    };

    for (let tick = 0; tick < Math.round(PHYSICS_HZ * 1.1); tick += 1) {
      setFingerMotor(claw.closedAngle, claw.maxMotorTorque);
      physics.step();
    }

    expect(fingerCommand).toBeCloseTo(claw.closedAngle, 5);

    const startPrize = prize.body.translation();
    const startPrizePosition = {
      x: startPrize.x,
      y: startPrize.y,
      z: startPrize.z,
    };

    let motion: GantryMotionState = {
      x: { position: startX, velocity: 0 },
      z: { position: startZ, velocity: 0 },
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
    const tolerance = {
      position: gantry.homePositionTolerance,
      velocity: gantry.homeVelocityTolerance,
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
    let play: M04PlayState = {
      phase: "RETURNING",
      phaseElapsedSeconds: 0,
      closeReason: "AUTO",
      closeStartPayoutMeters: gantry.reelMaxPayout,
      pickupStartPayoutMeters: gantry.reelMaxPayout,
      retainingStartPayoutMeters: 0.20,
      holdBoostUsedSeconds: 0,
    };

    let releaseTick: number | null = null;
    let sensorTick: number | null = null;
    let readyTick: number | null = null;
    let prizeTravelAtRelease = 0;
    let maxHubLagMeters = 0;
    let maxPrizeStepMeters = 0;
    let previousPrizePosition = {
      x: startPrizePosition.x,
      y: startPrizePosition.y,
      z: startPrizePosition.z,
    };
    let sensorEvents = 0;
    let finiteAndBounded = true;

    for (let tick = 1; tick <= PHYSICS_HZ * 5; tick += 1) {
      if (play.phase === "RETURNING") {
        motion = advanceGantryMotionTowardPosition(
          motion,
          targetX,
          targetZ,
          motionConfig,
          dt,
        );
      }

      carriage.setNextKinematicTranslation({
        x: motion.x.position,
        y: gantry.carriageY,
        z: motion.z.position,
      });
      reelAnchor.setNextKinematicTranslation({
        x: motion.x.position,
        y: anchorY,
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

      const homeReached =
        isGantryAxisAtTarget(motion.x, targetX, tolerance) &&
        isGantryAxisAtTarget(motion.z, targetZ, tolerance);
      const phaseBefore = play.phase;
      play = advanceM04PlayState(
        play,
        {
          reelPayoutMeters: 0,
          fingerCommandRadians: fingerCommand,
          reelAtTop: true,
          homeReached,
          holdBoostRequested: true,
        },
        playConfig,
        0,
      );

      if (
        phaseBefore === "RETURNING" &&
        play.phase === "RELEASING" &&
        releaseTick === null
      ) {
        releaseTick = tick;
        const p = prize.body.translation();
        prizeTravelAtRelease = Math.hypot(
          p.x - startPrizePosition.x,
          p.z - startPrizePosition.z,
        );
      }

      const closing = m04FingerShouldClose(play);
      const boostActive = m04HoldBoostActive(
        play,
        true,
        playConfig,
      );
      fingerCommand = advanceMotorCommand(
        fingerCommand,
        closing ? claw.closedAngle : claw.openAngle,
        claw.motorSpeedRadiansPerSecond,
        dt,
      );

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
            ? boostActive
              ? M04_PLAY_CONFIG.holdBoostTorque
              : claw.pt002RetainingTorque
            : M02_FINGER_TRANSPORT_CONFIG.maxTorque,
        );
      }

      play = advanceM04PlayState(
        play,
        {
          reelPayoutMeters: 0,
          fingerCommandRadians: fingerCommand,
          reelAtTop: true,
          homeReached,
          holdBoostRequested: true,
        },
        playConfig,
        dt,
      );

      for (const finger of fingers) {
        finger.wakeUp();
      }
      hub.wakeUp();
      prize.body.wakeUp();

      physics.step();

      const currentHub = hub.translation();
      maxHubLagMeters = Math.max(
        maxHubLagMeters,
        Math.hypot(
          currentHub.x - motion.x.position,
          currentHub.z - motion.z.position,
        ),
      );

      const p = prize.body.translation();
      const stepDistance = Math.hypot(
        p.x - previousPrizePosition.x,
        p.y - previousPrizePosition.y,
        p.z - previousPrizePosition.z,
      );
      maxPrizeStepMeters = Math.max(maxPrizeStepMeters, stepDistance);
      previousPrizePosition = { x: p.x, y: p.y, z: p.z };

      finiteAndBounded =
        finiteAndBounded &&
        [p.x, p.y, p.z].every(Number.isFinite) &&
        Math.abs(p.x) < 0.50 &&
        Math.abs(p.z) < 0.40 &&
        p.y > -0.34 &&
        p.y < 1.0;

      const event = sensor.pollPrize("m06-carried-ball", prize.body);
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

    const finalPrize = prize.body.translation();
    const targetDistanceFromStart = Math.hypot(
      targetX - startX,
      targetZ - startZ,
    );

    console.log(
      "M06 carried-prize lifecycle metrics",
      JSON.stringify({
        startX,
        startZ,
        targetX,
        targetZ,
        targetDistanceFromStart,
        prizeTravelAtRelease,
        releaseTick,
        releaseSeconds:
          releaseTick === null ? null : releaseTick / PHYSICS_HZ,
        sensorTick,
        sensorSeconds:
          sensorTick === null ? null : sensorTick / PHYSICS_HZ,
        readyTick,
        maxHubLagMeters,
        maxPrizeStepMeters,
        holdBoostUsedSeconds: play.holdBoostUsedSeconds,
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
    expect(releaseTick).not.toBeNull();
    expect(prizeTravelAtRelease).toBeGreaterThan(0.10);
    expect(prizeTravelAtRelease).toBeGreaterThan(
      targetDistanceFromStart * 0.60,
    );
    expect(maxHubLagMeters).toBeGreaterThan(0.001);
    expect(maxHubLagMeters).toBeLessThan(0.05);
    expect(maxPrizeStepMeters).toBeLessThan(0.02);
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
        sensor.pollPrize("m06-carried-ball", prize.body),
      ).toBeNull();
    }
    expect(sensor.winCount).toBe(1);
  }, 15_000);
});
