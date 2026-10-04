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
  createFingerPoints,
  createFingerSegments,
  evaluatePt002Slip,
} from "./clawLab";
import {
  M02_FINGER_TRANSPORT_CONFIG,
  M02_GANTRY_CONFIG,
  advanceFingerCommandWithSelfContactGuard,
  updateFingerSelfContactGuard,
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
  prizeHalfExtents?: { x: number; y: number; z: number };
  prizeRotationYRadians?: number;
  prizeOffsetX?: number;
  prizeOffsetZ?: number;
  fingerLowerPadRadiusMeters?: number;
  fingerNodes?: readonly { radial: number; down: number }[];
  closedAngleRadians?: number;
  autoClosePayoutMeters?: number;
  pickupLiftDistanceMeters?: number;
  topHoldSeconds?: number;
  supportMode?: "pedestal" | "flat-deck";
  selfContactGuard?: boolean;
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
  const prizeRotationYRadians =
    profile.prizeRotationYRadians ?? 0;
  const prizeOffsetX = profile.prizeOffsetX ?? 0;
  const prizeOffsetZ = profile.prizeOffsetZ ?? 0;
  const fingerLowerPadRadiusMeters =
    profile.fingerLowerPadRadiusMeters ??
    CLAW_LAB_CONFIG.fingerRodRadius;
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
  const selfContactGuard = profile.selfContactGuard ?? false;
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
        0.002
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
          rotationYRadians: prizeRotationYRadians,
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
  let selfContactGuardActive = false;
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
        fingerClosedByContact: selfContactGuardActive,
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
    const siblingFingerContact =
      selfContactGuard &&
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
    selfContactGuardActive = selfContactGuard
      ? updateFingerSelfContactGuard(
          selfContactGuardActive,
          closing,
          siblingFingerContact,
        )
      : false;
    fingerCommand = advanceFingerCommandWithSelfContactGuard(
      fingerCommand,
      closing ? closedAngleRadians : claw.openAngle,
      claw.motorSpeedRadiansPerSecond,
      dt,
      closing,
      selfContactGuardActive,
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
        fingerClosedByContact: selfContactGuardActive,
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
      selfContactGuard: true,
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

});

