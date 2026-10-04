import { describe, expect, it } from "vitest";
import { M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";
import { CABINET_PLAY_TUNING } from "../cabinet/cabinetPlayTuning";
import { PHYSICS_HZ } from "../config/simulation";
import { getPrizeDefinition } from "../prizes/catalog";
import { createPrize } from "../prizes/PrizeFactory";
import type {
  RevoluteJointHandle,
  RigidBodyHandle,
} from "../physics/PhysicsRuntime";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  createFingerPoints,
  createFingerSegments,
  computeFingerTipSpan,
  evaluatePt002Slip,
} from "./clawLab";
import {
  M02_FINGER_TRANSPORT_CONFIG,
  M02_GANTRY_CONFIG,
} from "./gantryLab";
import {
  M04_PLAY_CONFIG,
  advanceM04PlayState,
  applyM04Action,
  createM04PlayState,
  m04FingerShouldClose,
  m04ForcePhase,
  m04HoldBoostActive,
  m04ReelCommand,
} from "./m04PlayCycle";
import { advanceReel, type ReelState } from "./reelMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

const M04_TEST_BALL_HEIGHT_OFFSET_METERS = 0.015;

interface PickupRetentionProfile {
  holdBoostTorque?: number;
  fingerFriction?: number;
  closePickupTorque?: number;
  retainingTorque?: number;
  ballMassKg?: number;
  ballFriction?: number;
  ballRestitution?: number;
  ballRadiusMeters?: number;
  prizeShape?: "sphere" | "cuboid";
  prizeDefinitionId?: string;
  prizeMaterialId?: string;
  prizeHalfExtents?: { x: number; y: number; z: number };
  prizeRotationXRadians?: number;
  prizeRotationYRadians?: number;
  prizeVerticalOffsetMeters?: number;
  prizeOffsetX?: number;
  prizeOffsetZ?: number;
  supportPrizeDefinitionId?: string;
  supportOffsetX?: number;
  supportOffsetZ?: number;
  fingerLowerPadRadiusMeters?: number;
  fingerLowerPadSegmentCount?: number;
  fingerNodes?: readonly { radial: number; down: number }[];
  closedAngleRadians?: number;
  autoClosePayoutMeters?: number;
  pickupLiftDistanceMeters?: number;
  topHoldSeconds?: number;
  supportMode?: "pedestal" | "flat-deck";
}

interface PickupRetentionMetrics {
  peakLiftMeters: number;
  liftAtRetainingStartMeters: number;
  liftAfterRetaining0p4sMeters: number;
  liftAfterRetaining0p8sMeters: number;
  liftAfterRetaining1p2sMeters: number;
  finalLiftMeters: number;
  slipLossMeters: number;
  pickupStartPayoutMeters: number;
  retainingStartPayoutMeters: number;
  finalPayoutMeters: number;
  maxSuspensionErrorMeters: number;
  maxPlanarDisplacementMeters: number;
  retainingReached: boolean;
  topReached: boolean;
  boostUsedSeconds: number;
  retainingTransitionSpeedBeforeMetersPerSecond: number;
  retainingTransitionSpeedAfterMetersPerSecond: number;
  finiteAndBounded: boolean;
}

async function simulateM04PickupRetention(
  profile: PickupRetentionProfile = {},
): Promise<PickupRetentionMetrics> {
  const claw = CLAW_LAB_CONFIG;
  const holdBoostTorque = profile.holdBoostTorque ?? 0;
  const fingerFriction =
    profile.fingerFriction ?? claw.fingerFriction;
  const closePickupTorque =
    profile.closePickupTorque ?? claw.maxMotorTorque;
  const retainingTorque =
    profile.retainingTorque ?? claw.pt002RetainingTorque;
  const ballMassKg = profile.ballMassKg ?? claw.pt001BallMassKg;
  const ballFriction =
    profile.ballFriction ?? claw.pt001BallFriction;
  const ballRadiusMeters =
    profile.ballRadiusMeters ?? claw.pt001BallRadius;
  const ballRestitution =
    profile.ballRestitution ?? claw.pt001BallRestitution;
  const prizeShape = profile.prizeShape ?? "sphere";
  const prizeDefinition = profile.prizeDefinitionId
    ? getPrizeDefinition(profile.prizeDefinitionId)
    : null;
  const prizeHalfExtents =
    profile.prizeHalfExtents ?? {
      x: ballRadiusMeters,
      y: ballRadiusMeters,
      z: ballRadiusMeters,
    };
  const prizeRotationXRadians =
    profile.prizeRotationXRadians ?? 0;
  const prizeRotationYRadians =
    profile.prizeRotationYRadians ?? 0;
  const prizeVerticalOffsetMeters =
    profile.prizeVerticalOffsetMeters ?? 0;
  const prizeOffsetX = profile.prizeOffsetX ?? 0;
  const prizeOffsetZ = profile.prizeOffsetZ ?? 0;
  const supportDefinition = profile.supportPrizeDefinitionId
    ? getPrizeDefinition(profile.supportPrizeDefinitionId)
    : null;
  const supportOffsetX = profile.supportOffsetX ?? prizeOffsetX;
  const supportOffsetZ = profile.supportOffsetZ ?? prizeOffsetZ;
  const fingerLowerPadRadiusMeters =
    profile.fingerLowerPadRadiusMeters ??
    CLAW_LAB_CONFIG.fingerRodRadius;
  const fingerLowerPadSegmentCount =
    profile.fingerLowerPadSegmentCount ?? 1;
  const fingerNodes =
    profile.fingerNodes ?? CLAW_LAB_CONFIG.fingerNodes;
  const closedAngleRadians =
    profile.closedAngleRadians ?? claw.closedAngle;
  const autoClosePayoutMeters =
    profile.autoClosePayoutMeters ??
    M04_PLAY_CONFIG.autoClosePayoutMeters;
  const pickupLiftDistanceMeters =
    profile.pickupLiftDistanceMeters ??
    M04_PLAY_CONFIG.pickupLiftDistanceMeters;
  const topHoldSeconds = profile.topHoldSeconds ?? 0.6;
  const supportMode = profile.supportMode ?? "pedestal";
  const gantry = M02_GANTRY_CONFIG;
  const physics = await PhysicsRuntime.create();
  const dt = 1 / PHYSICS_HZ;
  const anchorY = gantry.carriageY - gantry.carriageHalfY;
  const initialHubY = anchorY - gantry.suspensionLength;

  physics.createStaticCuboid(
    { x: 0, y: -0.02, z: 0 },
    { x: 1, y: 0.02, z: 1 },
  );

  const bottomHubY =
    initialHubY - gantry.reelMaxPayout;
  const m01HubToBallCenter =
    claw.hubCenterY - claw.pt001BallCenterY;
  const supportHalfHeight =
    prizeDefinition
      ? prizeDefinition.dimensions.y * 0.5
      : prizeShape === "cuboid"
        ? prizeHalfExtents.y
        : ballRadiusMeters;
  const ballCenterY =
    supportMode === "flat-deck"
      ? M06_CABINET_CONFIG.playDeckY +
        supportHalfHeight +
        0.002 +
        prizeVerticalOffsetMeters
      : bottomHubY -
        m01HubToBallCenter +
        M04_TEST_BALL_HEIGHT_OFFSET_METERS;

  if (supportMode === "flat-deck") {
    physics.createStaticCuboid(
      {
        x: 0,
        y:
          M06_CABINET_CONFIG.playDeckY -
          M06_CABINET_CONFIG.playDeckHalfThickness,
        z: 0,
      },
      {
        x: M06_CABINET_CONFIG.interiorHalfX,
        y: M06_CABINET_CONFIG.playDeckHalfThickness,
        z: M06_CABINET_CONFIG.interiorHalfZ,
      },
      M06_CABINET_CONFIG.floorFriction,
    );
  } else {
    const pedestalTopY =
      ballCenterY - ballRadiusMeters;
    const pedestalHalfHeight = pedestalTopY * 0.5;

    physics.createStaticCylinder(
      { x: 0, y: pedestalHalfHeight, z: 0 },
      pedestalHalfHeight,
      claw.pt001PedestalRadius,
      0.75,
    );
  }

  if (supportMode === "flat-deck" && supportDefinition) {
    createPrize(
      physics,
      supportDefinition,
      {
        position: {
          x: supportOffsetX,
          y:
            M06_CABINET_CONFIG.playDeckY +
            supportDefinition.dimensions.y * 0.5 +
            0.002,
          z: supportOffsetZ,
        },
        variantSeed: "m04-ring-support-regression",
      },
    );
  }

  const reelAnchor = physics.createKinematicBody({
    x: 0,
    y: anchorY,
    z: 0,
  });
  const hub = physics.createDynamicCylinder(
    { x: 0, y: initialHubY, z: 0 },
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
      x: pivotLocal.x,
      y: initialHubY + pivotLocal.y,
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
        createFingerPoints(theta, fingerNodes),
        fingerLowerPadRadiusMeters,
        fingerLowerPadSegmentCount,
      ),
      {
        friction: fingerFriction,
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
        minAngle: closedAngleRadians,
        maxAngle: claw.openAngle,
        initialTarget: claw.openAngle,
        stiffness: claw.motorStiffness,
        damping: claw.motorDamping,
        maxTorque: closePickupTorque,
        contactsEnabled: false,
      },
    );

    fingers.push(finger);
    joints.push(joint);
  }

  const ball = prizeDefinition
    ? createPrize(
        physics,
        prizeDefinition,
        {
          position: {
            x: prizeOffsetX,
            y: ballCenterY,
            z: prizeOffsetZ,
          },
          rotationXRadians: prizeRotationXRadians,
          rotationYRadians: prizeRotationYRadians,
          materialId: profile.prizeMaterialId,
          variantSeed: "m04-flat-deck-regression",
        },
      ).body
    : prizeShape === "cuboid"
      ? physics.createDynamicCuboid(
          { x: prizeOffsetX, y: ballCenterY, z: prizeOffsetZ },
          prizeHalfExtents,
          prizeRotationYRadians,
          {
            friction: ballFriction,
            restitution: ballRestitution,
            density:
              ballMassKg /
              (
                prizeHalfExtents.x *
                prizeHalfExtents.y *
                prizeHalfExtents.z *
                8
              ),
          },
        )
      : physics.createDynamicSphere(
          { x: prizeOffsetX, y: ballCenterY, z: prizeOffsetZ },
          ballRadiusMeters,
          ballMassKg,
          {
            friction: ballFriction,
            restitution: ballRestitution,
          },
        );

  const reelConfig = {
    minPayout: gantry.reelMinPayout,
    maxPayout: gantry.reelMaxPayout,
    maxSpeed: gantry.reelMaxSpeed,
    acceleration: gantry.reelAcceleration,
    braking: gantry.reelBraking,
  };
  const playConfig = {
    autoClosePayoutMeters,
    closedAngleRadians,
    openAngleRadians: claw.openAngle,
    closeCompletionToleranceRadians:
      M04_PLAY_CONFIG.closeCompletionToleranceRadians,
    closeSettleSeconds: M04_PLAY_CONFIG.closeSettleSeconds,
    pickupLiftDistanceMeters,
    holdBoostDurationSeconds:
      M04_PLAY_CONFIG.holdBoostDurationSeconds,
    releaseCompletionToleranceRadians:
      M04_PLAY_CONFIG.releaseCompletionToleranceRadians,
  };

  let play = createM04PlayState();
  let reel: ReelState = { payout: 0, velocity: 0 };
  let fingerCommand = 0;
  let maxSuspensionErrorMeters = 0;
  let finiteAndBounded = true;
  let retainingTransitionSpeedBeforeMetersPerSecond = Number.NaN;
  let retainingTransitionSpeedAfterMetersPerSecond = Number.NaN;

  const step = (): void => {
    const reelCommand = m04ReelCommand(play);
    reel = advanceReel(
      reel,
      reelCommand,
      reelConfig,
      dt,
    );

    reelAnchor.setNextKinematicTranslation({
      x: 0,
      y: anchorY - reel.payout,
      z: 0,
    });

    const hubPosition = hub.translation();
    const hubVelocity = hub.linvel();
    const impulse = computeSuspensionStabilizerImpulse(
      {
        anchorX: 0,
        anchorZ: 0,
        anchorVelocityX: 0,
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
      },
      dt,
    );
    hub.applyImpulse(
      { x: impulse.x, y: 0, z: impulse.z },
      true,
    );

    const phaseBeforeImmediateAdvance = play.phase;
    play = advanceM04PlayState(
      play,
      {
        reelPayoutMeters: reel.payout,
        fingerCommandRadians: fingerCommand,
      },
      playConfig,
      0,
    );
    const enteredRetaining =
      phaseBeforeImmediateAdvance === "PICKUP" &&
      play.phase === "RETAINING";
    if (enteredRetaining) {
      const velocity = ball.linvel();
      retainingTransitionSpeedBeforeMetersPerSecond = Math.hypot(
        velocity.x,
        velocity.y,
        velocity.z,
      );
    }

    const closing = m04FingerShouldClose(play);
    fingerCommand = advanceMotorCommand(
      fingerCommand,
      closing ? closedAngleRadians : claw.openAngle,
      claw.motorSpeedRadiansPerSecond,
      dt,
    );

    const forcePhase = m04ForcePhase(play);
    const boostRequested =
      holdBoostTorque > 0 &&
      (play.phase === "RETAINING" || play.phase === "RETURNING");
    const boostActive = m04HoldBoostActive(
      play,
      boostRequested,
      playConfig,
    );

    play = advanceM04PlayState(
      play,
      {
        reelPayoutMeters: reel.payout,
        fingerCommandRadians: fingerCommand,
        holdBoostRequested: boostRequested,
      },
      playConfig,
      dt,
    );
    const torque =
      forcePhase === "RETAINING"
        ? boostActive
          ? holdBoostTorque
          : retainingTorque
        : closePickupTorque;

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
    ball.wakeUp();
    physics.step();

    if (enteredRetaining) {
      const velocity = ball.linvel();
      retainingTransitionSpeedAfterMetersPerSecond = Math.hypot(
        velocity.x,
        velocity.y,
        velocity.z,
      );
    }

    const currentHub = hub.translation();
    const currentAnchor = reelAnchor.translation();
    const suspensionDistance = Math.hypot(
      currentHub.x - currentAnchor.x,
      currentHub.y - currentAnchor.y,
      currentHub.z - currentAnchor.z,
    );
    maxSuspensionErrorMeters = Math.max(
      maxSuspensionErrorMeters,
      Math.abs(
        suspensionDistance - gantry.suspensionLength,
      ),
    );

    const values = [
      currentHub.x,
      currentHub.y,
      currentHub.z,
      ball.translation().x,
      ball.translation().y,
      ball.translation().z,
      reel.payout,
      reel.velocity,
      fingerCommand,
    ];
    finiteAndBounded =
      finiteAndBounded &&
      values.every(Number.isFinite) &&
      currentHub.y > 0.1 &&
      currentHub.y < 1.2 &&
      Math.abs(ball.translation().x) < 0.5 &&
      Math.abs(ball.translation().z) < 0.5;
  };

  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    step();
  }

  const baselineBall = ball.translation();
  const baselineBallY = baselineBall.y;
  const baselineBallX = baselineBall.x;
  const baselineBallZ = baselineBall.z;
  play = applyM04Action(play, reel.payout);

  let peakLiftMeters = 0;
  let maxPlanarDisplacementMeters = 0;
  let liftAtRetainingStartMeters = 0;
  let retainingReached = false;
  let topReached = false;
  let retainingHoldTicks = 0;
  let retainingTicks = 0;
  let liftAfterRetaining0p4sMeters = Number.NaN;
  let liftAfterRetaining0p8sMeters = Number.NaN;
  let liftAfterRetaining1p2sMeters = Number.NaN;

  for (let tick = 0; tick < PHYSICS_HZ * 8; tick += 1) {
    const previousPhase = play.phase;
    step();

    const ballPosition = ball.translation();
    const lift = ballPosition.y - baselineBallY;
    peakLiftMeters = Math.max(peakLiftMeters, lift);
    maxPlanarDisplacementMeters = Math.max(
      maxPlanarDisplacementMeters,
      Math.hypot(
        ballPosition.x - baselineBallX,
        ballPosition.z - baselineBallZ,
      ),
    );

    if (
      !retainingReached &&
      previousPhase !== "RETAINING" &&
      play.phase === "RETAINING"
    ) {
      retainingReached = true;
      liftAtRetainingStartMeters = lift;
    }

    if (play.phase === "RETAINING" && retainingReached) {
      retainingTicks += 1;
      if (retainingTicks === Math.round(0.4 * PHYSICS_HZ)) {
        liftAfterRetaining0p4sMeters = lift;
      }
      if (retainingTicks === Math.round(0.8 * PHYSICS_HZ)) {
        liftAfterRetaining0p8sMeters = lift;
      }
      if (retainingTicks === Math.round(1.2 * PHYSICS_HZ)) {
        liftAfterRetaining1p2sMeters = lift;
      }
    }

    if (
      play.phase === "RETAINING" &&
      reel.payout <= gantry.reelMinPayout + 1e-5 &&
      Math.abs(reel.velocity) < 1e-4
    ) {
      topReached = true;
      retainingHoldTicks += 1;
      if (
        retainingHoldTicks >=
        Math.ceil(topHoldSeconds * PHYSICS_HZ)
      ) {
        break;
      }
    }
  }

  const finalLiftMeters =
    ball.translation().y - baselineBallY;
  const slipLossMeters =
    peakLiftMeters - finalLiftMeters;

  return {
    peakLiftMeters,
    liftAtRetainingStartMeters,
    liftAfterRetaining0p4sMeters,
    liftAfterRetaining0p8sMeters,
    liftAfterRetaining1p2sMeters,
    finalLiftMeters,
    slipLossMeters,
    pickupStartPayoutMeters:
      play.pickupStartPayoutMeters ?? Number.NaN,
    retainingStartPayoutMeters:
      play.retainingStartPayoutMeters ?? Number.NaN,
    finalPayoutMeters: reel.payout,
    maxSuspensionErrorMeters,
    maxPlanarDisplacementMeters,
    retainingReached,
    topReached,
    boostUsedSeconds: play.holdBoostUsedSeconds,
    retainingTransitionSpeedBeforeMetersPerSecond,
    retainingTransitionSpeedAfterMetersPerSecond,
    finiteAndBounded,
  };
}

describe("M04 physical pickup-to-retaining force transition", () => {
  it("physically lifts the ball, then allows delayed slip under weak retaining torque", async () => {
    const metrics = await simulateM04PickupRetention();

    console.log(
      "M04 physical pickup-retaining metrics",
      JSON.stringify({
        testBallHeightOffsetMeters:
          M04_TEST_BALL_HEIGHT_OFFSET_METERS,
        ...metrics,
      }),
    );

    expect(metrics.finiteAndBounded).toBe(true);
    expect(metrics.retainingReached).toBe(true);
    expect(metrics.topReached).toBe(true);
    expect(metrics.pickupStartPayoutMeters).toBeGreaterThan(0.25);
    expect(
      metrics.pickupStartPayoutMeters -
        metrics.retainingStartPayoutMeters,
    ).toBeGreaterThanOrEqual(
      M04_PLAY_CONFIG.pickupLiftDistanceMeters,
    );

    expect(metrics.peakLiftMeters).toBeGreaterThanOrEqual(
      CLAW_LAB_CONFIG.pt002MinPeakLift,
    );
    expect(metrics.liftAtRetainingStartMeters).toBeGreaterThan(
      0.015,
    );
    expect(
      metrics.retainingTransitionSpeedBeforeMetersPerSecond,
    ).toBeGreaterThan(0.01);
    expect(
      metrics.retainingTransitionSpeedAfterMetersPerSecond,
    ).toBeGreaterThan(0.01);
    expect(metrics.slipLossMeters).toBeGreaterThanOrEqual(
      CLAW_LAB_CONFIG.pt002MinSlipLoss,
    );
    expect(metrics.finalLiftMeters).toBeLessThanOrEqual(
      CLAW_LAB_CONFIG.pt002MaxFinalLift,
    );
    expect(metrics.finalLiftMeters).toBeGreaterThan(-0.01);
    expect(
      evaluatePt002Slip(
        metrics.peakLiftMeters,
        metrics.finalLiftMeters,
      ),
    ).toBe(true);

    expect(metrics.finalPayoutMeters).toBeCloseTo(
      M02_GANTRY_CONFIG.reelMinPayout,
      4,
    );
    expect(metrics.maxSuspensionErrorMeters).toBeLessThan(
      0.002,
    );
  });

  it("temporarily delays slip with the calibrated HOLD BOOST, then returns to weak retaining force", async () => {
    const baseline = await simulateM04PickupRetention();
    const boosted = await simulateM04PickupRetention({
      holdBoostTorque: M04_PLAY_CONFIG.holdBoostTorque,
    });

    console.log(
      "M04 calibrated hold-boost metrics",
      JSON.stringify({
        torque: M04_PLAY_CONFIG.holdBoostTorque,
        durationSeconds: M04_PLAY_CONFIG.holdBoostDurationSeconds,
        baselineLiftAt0p4s:
          baseline.liftAfterRetaining0p4sMeters,
        boostedLiftAt0p4s:
          boosted.liftAfterRetaining0p4sMeters,
        boostedLiftAt0p8s:
          boosted.liftAfterRetaining0p8sMeters,
        boostedLiftAt1p2s:
          boosted.liftAfterRetaining1p2sMeters,
        boostUsedSeconds: boosted.boostUsedSeconds,
        baselineFinalLift: baseline.finalLiftMeters,
        boostedFinalLift: boosted.finalLiftMeters,
      }),
    );

    expect(baseline.finiteAndBounded).toBe(true);
    expect(boosted.finiteAndBounded).toBe(true);
    expect(baseline.liftAfterRetaining0p4sMeters).toBeLessThan(
      0.005,
    );
    expect(boosted.liftAfterRetaining0p4sMeters).toBeGreaterThan(
      0.015,
    );
    expect(
      boosted.liftAfterRetaining0p4sMeters -
        baseline.liftAfterRetaining0p4sMeters,
    ).toBeGreaterThan(0.015);
    expect(boosted.boostUsedSeconds).toBeCloseTo(
      M04_PLAY_CONFIG.holdBoostDurationSeconds,
      8,
    );
    expect(boosted.liftAfterRetaining0p8sMeters).toBeLessThan(
      0.005,
    );
    expect(
      boosted.liftAfterRetaining0p4sMeters -
        boosted.liftAfterRetaining0p8sMeters,
    ).toBeGreaterThan(0.015);
    expect(boosted.finalLiftMeters).toBeLessThan(-0.05);
  });

  it("production cabinet grip physically retains the five intended starter grab paths", async () => {
    const common = {
      fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
      closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
      retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
      pickupLiftDistanceMeters:
        CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
      closedAngleRadians:
        CABINET_PLAY_TUNING.closedAngleRadians,
      fingerLowerPadRadiusMeters:
        CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
      topHoldSeconds: 1.3,
      supportMode: "flat-deck" as const,
    };

    const cases = [
      {
        label: "Rubber Ball centered",
        prizeDefinitionId: "prize/sphere_ball",
        prizeRotationYRadians: 0,
        prizeOffsetX: 0,
        prizeOffsetZ: 0,
      },
      {
        label: "Foam Cube centered",
        prizeDefinitionId: "prize/cube_small",
        prizeRotationYRadians: 0.18,
        prizeOffsetX: 0,
        prizeOffsetZ: 0,
      },
      {
        label: "Small Pillow centered",
        prizeDefinitionId: "prize/pillow_small",
        prizeRotationYRadians: 0.28,
        prizeOffsetX: 0,
        prizeOffsetZ: 0,
      },
      {
        label: "Simple Animal centered",
        prizeDefinitionId: "prize/animal_simple",
        prizeRotationYRadians: -0.12,
        prizeOffsetX: 0,
        prizeOffsetZ: 0,
      },
      {
        label: "Simple Teddy offset torso grab",
        prizeDefinitionId: "prize/teddy_simple",
        prizeRotationYRadians: -0.22,
        prizeOffsetX: 0.02,
        prizeOffsetZ: -0.03,
      },
    ] as const;

    const results = [];

    for (const testCase of cases) {
      const metrics = await simulateM04PickupRetention({
        ...common,
        prizeDefinitionId: testCase.prizeDefinitionId,
        prizeRotationYRadians:
          testCase.prizeRotationYRadians,
        prizeOffsetX: testCase.prizeOffsetX,
        prizeOffsetZ: testCase.prizeOffsetZ,
      });

      results.push({
        label: testCase.label,
        peak: metrics.peakLiftMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        final: metrics.finalLiftMeters,
        topReached: metrics.topReached,
        finiteAndBounded: metrics.finiteAndBounded,
      });

      expect(metrics.finiteAndBounded).toBe(true);
      expect(metrics.retainingReached).toBe(true);
      expect(metrics.topReached).toBe(true);
      expect(
        metrics.liftAfterRetaining1p2sMeters,
      ).toBeGreaterThanOrEqual(0.08);
      expect(metrics.finalLiftMeters).toBeGreaterThanOrEqual(
        0.08,
      );
    }

    console.log(
      "Cabinet plush-capable production grip metrics",
      JSON.stringify({
        profile: {
          fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
          closePickupTorque:
            CABINET_PLAY_TUNING.closePickupTorque,
          retainingTorque:
            CABINET_PLAY_TUNING.retainingTorque,
          holdBoostTorque:
            CABINET_PLAY_TUNING.holdBoostTorque,
          pickupLiftDistanceMeters:
            CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
          closedAngleRadians:
            CABINET_PLAY_TUNING.closedAngleRadians,
          fingerLowerPadRadiusMeters:
            CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        },
        results,
      }),
    );
  }, 15000);


  it("measures full production one-prong ring close and retention behavior", async () => {
    const openTipRadius =
      computeFingerTipSpan(CLAW_LAB_CONFIG.openAngle) * 0.5;
    const theta = Math.PI * 4 / 3;
    const radialX = Math.cos(theta);
    const radialZ = Math.sin(theta);
    const tangentX = -radialZ;
    const tangentZ = radialX;

    const common = {
      fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
      closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
      retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
      holdBoostTorque: CABINET_PLAY_TUNING.holdBoostTorque,
      pickupLiftDistanceMeters:
        CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
      closedAngleRadians:
        CABINET_PLAY_TUNING.closedAngleRadians,
      fingerLowerPadRadiusMeters:
        CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
      topHoldSeconds: 1.3,
      supportMode: "flat-deck" as const,
      prizeDefinitionId: "prize/ring_loop",
      prizeRotationXRadians: 0.52,
      prizeRotationYRadians: 0.04,
      prizeVerticalOffsetMeters: 0.030,
      supportPrizeDefinitionId: "prize/box_tall",
    };

    const approaches = [
      { radial: -0.012, tangent: 0 },
      { radial: 0, tangent: 0 },
      { radial: 0.012, tangent: 0 },
      { radial: 0, tangent: -0.012 },
      { radial: 0, tangent: 0.012 },
    ] as const;

    const results = [];

    for (const approach of approaches) {
      const prizeOffsetX =
        radialX * (openTipRadius + approach.radial) +
        tangentX * approach.tangent;
      const prizeOffsetZ =
        radialZ * (openTipRadius + approach.radial) +
        tangentZ * approach.tangent;

      const metrics = await simulateM04PickupRetention({
        ...common,
        prizeOffsetX,
        prizeOffsetZ,
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        ...approach,
        prizeOffsetX,
        prizeOffsetZ,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        planarDisplacementMeters:
          metrics.maxPlanarDisplacementMeters,
        retainingReached: metrics.retainingReached,
        topReached: metrics.topReached,
      });
    }

    console.log(
      "M09 production ring pickup scan",
      JSON.stringify({
        openTipRadius,
        retainingTorque:
          CABINET_PLAY_TUNING.retainingTorque,
        holdBoostTorque:
          CABINET_PLAY_TUNING.holdBoostTorque,
        results,
      }),
    );

    expect(
      results.every((result) => result.retainingReached),
    ).toBe(true);
  }, 20000);


  it("scans the minimum retaining torque needed for a one-prong ring hook", async () => {
    const openTipRadius =
      computeFingerTipSpan(CLAW_LAB_CONFIG.openAngle) * 0.5;
    const theta = Math.PI * 4 / 3;
    const prizeOffsetX = Math.cos(theta) * openTipRadius;
    const prizeOffsetZ = Math.sin(theta) * openTipRadius;
    const candidates = [
      0.014,
      0.020,
      0.030,
      0.040,
      0.060,
      0.080,
    ] as const;

    const results = [];
    for (const retainingTorque of candidates) {
      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        retainingTorque,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        topReached: metrics.topReached,
      });
    }

    console.log(
      "M09 ring retaining torque sweep",
      JSON.stringify({ results }),
    );

    expect(results.every((result) => result.topReached)).toBe(true);
  }, 20000);


  it("scans production closed angle for stable one-prong ring retention", async () => {
    const openTipRadius =
      computeFingerTipSpan(CLAW_LAB_CONFIG.openAngle) * 0.5;
    const theta = Math.PI * 4 / 3;
    const prizeOffsetX = Math.cos(theta) * openTipRadius;
    const prizeOffsetZ = Math.sin(theta) * openTipRadius;
    const candidates = [
      -0.42,
      -0.48,
      -0.54,
      -0.58,
      -0.63,
    ] as const;

    const results = [];
    for (const closedAngleRadians of candidates) {
      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque: 0.03,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        closedAngleRadians,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        planarDisplacementMeters:
          metrics.maxPlanarDisplacementMeters,
      });
    }

    console.log(
      "M09 ring closed-angle sweep",
      JSON.stringify({ results }),
    );

    expect(results).toHaveLength(candidates.length);
  }, 20000);


  it("scans deeper production finger-tip hook geometry for ring retention", async () => {
    const baseNodes = CLAW_LAB_CONFIG.fingerNodes;
    const candidates = [
      { label: "baseline-50", penultimate: 0.075, tip: 0.050 },
      { label: "hook-40", penultimate: 0.075, tip: 0.040 },
      { label: "hook-30", penultimate: 0.075, tip: 0.030 },
      { label: "hook-20", penultimate: 0.075, tip: 0.020 },
      { label: "deep-85-25", penultimate: 0.085, tip: 0.025 },
      { label: "deep-90-20", penultimate: 0.090, tip: 0.020 },
    ] as const;
    const theta = Math.PI * 4 / 3;
    const results = [];

    for (const candidate of candidates) {
      const fingerNodes = [
        baseNodes[0]!,
        baseNodes[1]!,
        {
          radial: candidate.penultimate,
          down: baseNodes[2]!.down,
        },
        {
          radial: candidate.tip,
          down: baseNodes[3]!.down,
        },
      ] as const;
      const tipNode = fingerNodes[3];
      const openTipRadius =
        CLAW_LAB_CONFIG.fingerPivotRadius +
        tipNode.radial * Math.cos(CLAW_LAB_CONFIG.openAngle) +
        tipNode.down * Math.sin(CLAW_LAB_CONFIG.openAngle);
      const prizeOffsetX = Math.cos(theta) * openTipRadius;
      const prizeOffsetZ = Math.sin(theta) * openTipRadius;

      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        fingerNodes,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        ...candidate,
        openTipRadius,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        planarDisplacementMeters:
          metrics.maxPlanarDisplacementMeters,
      });
    }

    console.log(
      "M09 ring finger-hook geometry sweep",
      JSON.stringify({ results }),
    );

    expect(results).toHaveLength(candidates.length);
  }, 20000);


  it("scans J-shaped cabinet finger tips for mechanical ring retention", async () => {
    const base = CLAW_LAB_CONFIG.fingerNodes;
    const candidates = [
      {
        label: "baseline",
        nodes: base,
        entryNodeIndex: 3,
      },
      {
        label: "j10",
        nodes: [
          ...base,
          { radial: 0.060, down: 0.215 },
        ],
        entryNodeIndex: 3,
      },
      {
        label: "j15",
        nodes: [
          ...base,
          { radial: 0.065, down: 0.210 },
        ],
        entryNodeIndex: 3,
      },
      {
        label: "j20",
        nodes: [
          ...base,
          { radial: 0.070, down: 0.205 },
        ],
        entryNodeIndex: 3,
      },
      {
        label: "j-wide",
        nodes: [
          ...base,
          { radial: 0.075, down: 0.210 },
        ],
        entryNodeIndex: 3,
      },
    ] as const;
    const theta = Math.PI * 4 / 3;
    const results = [];

    for (const candidate of candidates) {
      const entry = candidate.nodes[candidate.entryNodeIndex]!;
      const entryRadius =
        CLAW_LAB_CONFIG.fingerPivotRadius +
        entry.radial * Math.cos(CLAW_LAB_CONFIG.openAngle) +
        entry.down * Math.sin(CLAW_LAB_CONFIG.openAngle);
      const prizeOffsetX = Math.cos(theta) * entryRadius;
      const prizeOffsetZ = Math.sin(theta) * entryRadius;

      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        fingerNodes: candidate.nodes,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        label: candidate.label,
        entryRadius,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        planarDisplacementMeters:
          metrics.maxPlanarDisplacementMeters,
      });
    }

    console.log(
      "M09 ring J-hook geometry sweep",
      JSON.stringify({ results }),
    );

    expect(results).toHaveLength(candidates.length);
  }, 20000);


  it("combines J20 tip geometry with modest retaining torque for ring retention", async () => {
    const base = CLAW_LAB_CONFIG.fingerNodes;
    const fingerNodes = [
      ...base,
      { radial: 0.070, down: 0.205 },
    ] as const;
    const entry = fingerNodes[3]!;
    const entryRadius =
      CLAW_LAB_CONFIG.fingerPivotRadius +
      entry.radial * Math.cos(CLAW_LAB_CONFIG.openAngle) +
      entry.down * Math.sin(CLAW_LAB_CONFIG.openAngle);
    const theta = Math.PI * 4 / 3;
    const prizeOffsetX = Math.cos(theta) * entryRadius;
    const prizeOffsetZ = Math.sin(theta) * entryRadius;
    const candidates = [0.014, 0.020, 0.030, 0.040] as const;

    const results = [];
    for (const retainingTorque of candidates) {
      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        fingerNodes,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        retainingTorque,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        topReached: metrics.topReached,
      });
    }

    console.log(
      "M09 J20 retaining torque sweep",
      JSON.stringify({ results }),
    );

    expect(results.every((result) => result.topReached)).toBe(true);
  }, 20000);


  it("scans padded J-hook contact surfaces for ring retention", async () => {
    const base = CLAW_LAB_CONFIG.fingerNodes;
    const candidates = [
      {
        label: "j20-thin",
        nodes: [...base, { radial: 0.070, down: 0.205 }],
        padSegments: 1,
      },
      {
        label: "j20-wide2",
        nodes: [...base, { radial: 0.070, down: 0.205 }],
        padSegments: 2,
      },
      {
        label: "jwide-wide2",
        nodes: [...base, { radial: 0.075, down: 0.210 }],
        padSegments: 2,
      },
      {
        label: "j25-wide2",
        nodes: [...base, { radial: 0.075, down: 0.200 }],
        padSegments: 2,
      },
      {
        label: "j30-wide2",
        nodes: [...base, { radial: 0.080, down: 0.195 }],
        padSegments: 2,
      },
    ] as const;
    const theta = Math.PI * 4 / 3;
    const entry = base[3]!;
    const entryRadius =
      CLAW_LAB_CONFIG.fingerPivotRadius +
      entry.radial * Math.cos(CLAW_LAB_CONFIG.openAngle) +
      entry.down * Math.sin(CLAW_LAB_CONFIG.openAngle);
    const prizeOffsetX = Math.cos(theta) * entryRadius;
    const prizeOffsetZ = Math.sin(theta) * entryRadius;
    const results = [];

    for (const candidate of candidates) {
      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        fingerLowerPadSegmentCount: candidate.padSegments,
        fingerNodes: candidate.nodes,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        label: candidate.label,
        padSegments: candidate.padSegments,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        planarDisplacementMeters:
          metrics.maxPlanarDisplacementMeters,
      });
    }

    console.log(
      "M09 ring padded J-hook sweep",
      JSON.stringify({ results }),
    );

    expect(results).toHaveLength(candidates.length);
  }, 20000);


  it("scans steeper thin J-hooks for long ring retention", async () => {
    const base = CLAW_LAB_CONFIG.fingerNodes;
    const candidates = [
      { label: "j20-u20", radial: 0.070, down: 0.205 },
      { label: "j15-u30", radial: 0.065, down: 0.195 },
      { label: "j20-u30", radial: 0.070, down: 0.195 },
      { label: "j10-u40", radial: 0.060, down: 0.185 },
      { label: "j15-u40", radial: 0.065, down: 0.185 },
      { label: "j20-u40", radial: 0.070, down: 0.185 },
    ] as const;
    const theta = Math.PI * 4 / 3;
    const entry = base[3]!;
    const entryRadius =
      CLAW_LAB_CONFIG.fingerPivotRadius +
      entry.radial * Math.cos(CLAW_LAB_CONFIG.openAngle) +
      entry.down * Math.sin(CLAW_LAB_CONFIG.openAngle);
    const prizeOffsetX = Math.cos(theta) * entryRadius;
    const prizeOffsetZ = Math.sin(theta) * entryRadius;
    const results = [];

    for (const candidate of candidates) {
      const fingerNodes = [
        ...base,
        { radial: candidate.radial, down: candidate.down },
      ] as const;

      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        fingerLowerPadSegmentCount: 1,
        fingerNodes,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        ...candidate,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        planarDisplacementMeters:
          metrics.maxPlanarDisplacementMeters,
      });
    }

    console.log(
      "M09 ring steep J-hook sweep",
      JSON.stringify({ results }),
    );

    expect(results).toHaveLength(candidates.length);
  }, 20000);


  it("scans wider short hook lips for ring retention", async () => {
    const base = CLAW_LAB_CONFIG.fingerNodes;
    const candidates = [
      { label: "lip30", radial: 0.080, down: 0.205 },
      { label: "lip40", radial: 0.090, down: 0.205 },
      { label: "lip50", radial: 0.100, down: 0.205 },
      { label: "lip60", radial: 0.110, down: 0.205 },
      { label: "lip40-u10", radial: 0.090, down: 0.215 },
      { label: "lip50-u10", radial: 0.100, down: 0.215 },
    ] as const;
    const theta = Math.PI * 4 / 3;
    const entry = base[3]!;
    const entryRadius =
      CLAW_LAB_CONFIG.fingerPivotRadius +
      entry.radial * Math.cos(CLAW_LAB_CONFIG.openAngle) +
      entry.down * Math.sin(CLAW_LAB_CONFIG.openAngle);
    const prizeOffsetX = Math.cos(theta) * entryRadius;
    const prizeOffsetZ = Math.sin(theta) * entryRadius;
    const results = [];

    for (const candidate of candidates) {
      const fingerNodes = [
        ...base,
        { radial: candidate.radial, down: candidate.down },
      ] as const;

      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        fingerLowerPadSegmentCount: 1,
        fingerNodes,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        ...candidate,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        planarDisplacementMeters:
          metrics.maxPlanarDisplacementMeters,
      });
    }

    console.log(
      "M09 ring wide hook-lip sweep",
      JSON.stringify({ results }),
    );

    expect(results).toHaveLength(candidates.length);
  }, 20000);


  it("scans passive retaining torque with the lip50 mechanical hook", async () => {
    const base = CLAW_LAB_CONFIG.fingerNodes;
    const fingerNodes = [
      ...base,
      { radial: 0.100, down: 0.205 },
    ] as const;
    const entry = base[3]!;
    const entryRadius =
      CLAW_LAB_CONFIG.fingerPivotRadius +
      entry.radial * Math.cos(CLAW_LAB_CONFIG.openAngle) +
      entry.down * Math.sin(CLAW_LAB_CONFIG.openAngle);
    const theta = Math.PI * 4 / 3;
    const prizeOffsetX = Math.cos(theta) * entryRadius;
    const prizeOffsetZ = Math.sin(theta) * entryRadius;
    const candidates = [0, 0.002, 0.005, 0.008, 0.014] as const;
    const results = [];

    for (const retainingTorque of candidates) {
      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        fingerLowerPadSegmentCount: 1,
        fingerNodes,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        retainingTorque,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        planarDisplacementMeters:
          metrics.maxPlanarDisplacementMeters,
      });
    }

    console.log(
      "M09 lip50 passive-retention sweep",
      JSON.stringify({ results }),
    );

    expect(results).toHaveLength(candidates.length);
  }, 20000);


  it("sweeps two-segment crook tips for mechanical ring retention", async () => {
    const base = CLAW_LAB_CONFIG.fingerNodes;
    const candidates = [
      {
        label: "crook-a",
        nodes: [
          ...base,
          { radial: 0.090, down: 0.205 },
          { radial: 0.082, down: 0.183 },
        ],
      },
      {
        label: "crook-b",
        nodes: [
          ...base,
          { radial: 0.100, down: 0.205 },
          { radial: 0.090, down: 0.180 },
        ],
      },
      {
        label: "crook-c",
        nodes: [
          ...base,
          { radial: 0.100, down: 0.205 },
          { radial: 0.082, down: 0.180 },
        ],
      },
      {
        label: "crook-d",
        nodes: [
          ...base,
          { radial: 0.095, down: 0.200 },
          { radial: 0.082, down: 0.172 },
        ],
      },
      {
        label: "crook-e",
        nodes: [
          ...base,
          { radial: 0.090, down: 0.202 },
          { radial: 0.090, down: 0.176 },
        ],
      },
      {
        label: "crook-f",
        nodes: [
          ...base,
          { radial: 0.095, down: 0.205 },
          { radial: 0.088, down: 0.175 },
        ],
      },
    ] as const;

    const entry = base[3]!;
    const entryRadius =
      CLAW_LAB_CONFIG.fingerPivotRadius +
      entry.radial * Math.cos(CLAW_LAB_CONFIG.openAngle) +
      entry.down * Math.sin(CLAW_LAB_CONFIG.openAngle);
    const theta = Math.PI * 4 / 3;
    const prizeOffsetX = Math.cos(theta) * entryRadius;
    const prizeOffsetZ = Math.sin(theta) * entryRadius;
    const results = [];

    for (const candidate of candidates) {
      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque: 0,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        fingerNodes: candidate.nodes,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        label: candidate.label,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        planarDisplacementMeters:
          metrics.maxPlanarDisplacementMeters,
        topReached: metrics.topReached,
      });
    }

    console.log(
      "M09 ring crook-tip sweep",
      JSON.stringify({ results }),
    );

    expect(results).toHaveLength(candidates.length);
  }, 20000);


  it("sweeps ring surface friction with the unchanged production claw", async () => {
    const openTipRadius =
      computeFingerTipSpan(CLAW_LAB_CONFIG.openAngle) * 0.5;
    const theta = Math.PI * 4 / 3;
    const radialX = Math.cos(theta);
    const radialZ = Math.sin(theta);
    const prizeOffsetX =
      radialX * (openTipRadius + 0.012);
    const prizeOffsetZ =
      radialZ * (openTipRadius + 0.012);
    const candidates = [
      "material/plastic",
      "material/cardboard_matte",
      "material/fabric",
      "material/plush",
      "material/rubber",
    ] as const;
    const results = [];

    for (const prizeMaterialId of candidates) {
      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeMaterialId,
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        prizeMaterialId,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
      });
    }

    console.log(
      "M09 ring material friction sweep",
      JSON.stringify({ results }),
    );

    expect(results).toHaveLength(candidates.length);
  }, 20000);


  it("scans inward-up J-hooks for one-prong ring retention", async () => {
    const base = CLAW_LAB_CONFIG.fingerNodes;
    const candidates = [
      { label: "in10-u20", radial: 0.040, down: 0.205 },
      { label: "in20-u20", radial: 0.030, down: 0.205 },
      { label: "in30-u20", radial: 0.020, down: 0.205 },
      { label: "in10-u30", radial: 0.040, down: 0.195 },
      { label: "in20-u30", radial: 0.030, down: 0.195 },
      { label: "in30-u30", radial: 0.020, down: 0.195 },
    ] as const;
    const theta = Math.PI * 4 / 3;
    const entry = base[3]!;
    const entryRadius =
      CLAW_LAB_CONFIG.fingerPivotRadius +
      entry.radial * Math.cos(CLAW_LAB_CONFIG.openAngle) +
      entry.down * Math.sin(CLAW_LAB_CONFIG.openAngle);
    const prizeOffsetX = Math.cos(theta) * entryRadius;
    const prizeOffsetZ = Math.sin(theta) * entryRadius;
    const results = [];

    for (const candidate of candidates) {
      const fingerNodes = [
        ...base,
        { radial: candidate.radial, down: candidate.down },
      ] as const;

      const metrics = await simulateM04PickupRetention({
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
        holdBoostTorque: 0,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
        fingerLowerPadSegmentCount: 1,
        fingerNodes,
        topHoldSeconds: 1.3,
        supportMode: "flat-deck",
        prizeDefinitionId: "prize/ring_loop",
        prizeRotationXRadians: 0.52,
        prizeRotationYRadians: 0.04,
        prizeVerticalOffsetMeters: 0.030,
        prizeOffsetX,
        prizeOffsetZ,
        supportPrizeDefinitionId: "prize/box_tall",
        supportOffsetX: prizeOffsetX,
        supportOffsetZ: prizeOffsetZ - 0.110,
      });

      results.push({
        ...candidate,
        peakLiftMeters: metrics.peakLiftMeters,
        liftAtRetainingStartMeters:
          metrics.liftAtRetainingStartMeters,
        retain0p4: metrics.liftAfterRetaining0p4sMeters,
        retain0p8: metrics.liftAfterRetaining0p8sMeters,
        retain1p2: metrics.liftAfterRetaining1p2sMeters,
        finalLiftMeters: metrics.finalLiftMeters,
        planarDisplacementMeters:
          metrics.maxPlanarDisplacementMeters,
      });
    }

    console.log(
      "M09 ring inward J-hook sweep",
      JSON.stringify({ results }),
    );

    expect(results).toHaveLength(candidates.length);
  }, 20000);

});

