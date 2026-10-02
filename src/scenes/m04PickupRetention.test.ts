import { describe, expect, it } from "vitest";
import { CABINET_PLAY_TUNING } from "../cabinet/cabinetPlayTuning";
import { PHYSICS_HZ } from "../config/simulation";
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
  const ballCenterY =
    bottomHubY -
    m01HubToBallCenter +
    M04_TEST_BALL_HEIGHT_OFFSET_METERS;
  const pedestalTopY =
    ballCenterY - claw.pt001BallRadius;
  const pedestalHalfHeight = pedestalTopY * 0.5;

  physics.createStaticCylinder(
    { x: 0, y: pedestalHalfHeight, z: 0 },
    pedestalHalfHeight,
    claw.pt001PedestalRadius,
    0.75,
  );

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
      createFingerSegments(createFingerPoints(theta)),
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
        minAngle: claw.closedAngle,
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

  const ball = physics.createDynamicSphere(
    { x: 0, y: ballCenterY, z: 0 },
    claw.pt001BallRadius,
    claw.pt001BallMassKg,
    {
      friction: claw.pt001BallFriction,
      restitution: claw.pt001BallRestitution,
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
    autoClosePayoutMeters: M04_PLAY_CONFIG.autoClosePayoutMeters,
    closedAngleRadians: claw.closedAngle,
    openAngleRadians: claw.openAngle,
    closeCompletionToleranceRadians:
      M04_PLAY_CONFIG.closeCompletionToleranceRadians,
    closeSettleSeconds: M04_PLAY_CONFIG.closeSettleSeconds,
    pickupLiftDistanceMeters:
      M04_PLAY_CONFIG.pickupLiftDistanceMeters,
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
      closing ? claw.closedAngle : claw.openAngle,
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

  const baselineBallY = ball.translation().y;
  play = applyM04Action(play, reel.payout);

  let peakLiftMeters = 0;
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

    const lift = ball.translation().y - baselineBallY;
    peakLiftMeters = Math.max(peakLiftMeters, lift);

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
      if (retainingHoldTicks >= Math.ceil(0.6 * PHYSICS_HZ)) {
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

  it("cabinet grip profile can lift and retain a normal ball without magnetic hold", async () => {
    const baseline = await simulateM04PickupRetention();
    const cabinet = await simulateM04PickupRetention({
      fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
      closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
      retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
    });

    console.log(
      "Cabinet grip calibration metrics",
      JSON.stringify({
        profile: {
          fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
          closePickupTorque: CABINET_PLAY_TUNING.closePickupTorque,
          retainingTorque: CABINET_PLAY_TUNING.retainingTorque,
        },
        baseline: {
          peakLiftMeters: baseline.peakLiftMeters,
          liftAt0p4s: baseline.liftAfterRetaining0p4sMeters,
          liftAt0p8s: baseline.liftAfterRetaining0p8sMeters,
          finalLiftMeters: baseline.finalLiftMeters,
        },
        cabinet: {
          peakLiftMeters: cabinet.peakLiftMeters,
          liftAtRetainingStartMeters:
            cabinet.liftAtRetainingStartMeters,
          liftAt0p4s:
            cabinet.liftAfterRetaining0p4sMeters,
          liftAt0p8s:
            cabinet.liftAfterRetaining0p8sMeters,
          liftAt1p2s:
            cabinet.liftAfterRetaining1p2sMeters,
          finalLiftMeters: cabinet.finalLiftMeters,
          topReached: cabinet.topReached,
        },
      }),
    );

    expect(cabinet.finiteAndBounded).toBe(true);
    expect(cabinet.retainingReached).toBe(true);
    expect(cabinet.topReached).toBe(true);
    expect(cabinet.peakLiftMeters).toBeGreaterThan(0.03);
    expect(cabinet.liftAtRetainingStartMeters).toBeGreaterThan(0.015);
    expect(cabinet.liftAfterRetaining0p4sMeters).toBeGreaterThan(
      baseline.liftAfterRetaining0p4sMeters + 0.01,
    );
    expect(CABINET_PLAY_TUNING.retainingTorque).toBeLessThan(
      M04_PLAY_CONFIG.holdBoostTorque,
    );
  });
});

