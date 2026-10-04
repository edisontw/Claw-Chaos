import { describe, expect, it } from "vitest";
import {
  CABINET_CLAW_PARK_POSITION,
  CABINET_PLAY_TUNING,
} from "../cabinet/cabinetPlayTuning";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "../cabinet/cabinetGeometry";
import { ChuteSensor } from "../cabinet/chuteSensor";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { getPrizeDefinition } from "../prizes/catalog";
import { createPrize } from "../prizes/PrizeFactory";
import { createRingLoopGeometry } from "../prizes/ringProfile";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  computeFingerTipSpan,
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

interface ApproachCase {
  label: string;
  fingerIndex: 1 | 2;
  highSideFraction: number;
  tangentOffsetMeters: number;
}

interface SupportCase {
  label: string;
  supportPrizeId?: string;
  primaryXOffsetMeters?: number;
  primaryZOffsetMeters?: number;
  secondaryXOffsetMeters?: number;
  secondaryZOffsetMeters?: number;
}

interface GripDiagnostic {
  label?: string;
  closedAngleRadians?: number;
  retainingTorque?: number;
}

interface RingPickupMetrics {
  label: string;
  fingerIndex: number;
  carriageX: number;
  carriageZ: number;
  targetPointX: number;
  targetPointZ: number;
  ringBaselineX: number;
  ringBaselineY: number;
  ringBaselineZ: number;
  fingerContactTicks: number[];
  peakFingerContactPairs: number[];
  firstFingerContactPhase: Array<string | null>;
  contactAtRetainingStart: boolean[];
  contactAtReturningStart: boolean[];
  returningContactTicks: number[];
  closePlanarDisplacementMeters: number;
  displacementAtClosedAtDepthMeters: number;
  displacementAtPickupStartMeters: number;
  liftAtClosedAtDepthMeters: number;
  liftAtPickupStartMeters: number;
  liftAtRetainingStartMeters: number;
  liftAtReturningStartMeters: number;
  finalLiftMeters: number;
  peakLiftMeters: number;
  minimumLiftDuringReturningMeters: number;
  ringReturnTravelMeters: number;
  chuteReached: boolean;
  chuteReachedPhase: string | null;
  ringReturnTravelAtChuteMeters: number;
  gantryDistanceToReturnTargetAtChuteMeters: number;
  maxRingSpeedMetersPerSecond: number;
  retainingReached: boolean;
  returningReached: boolean;
  releasingReached: boolean;
  escapedPhase: string | null;
  poseCollapsePhase: string | null;
  supportCaseLabel: string;
  gripDiagnosticLabel: string;
  closedAngleRadians: number;
  retainingTorque: number;
  success: boolean;
}

function rotateVector(
  vector: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number } {
  const { x, y, z, w } = rotation;
  return {
    x:
      (1 - 2 * (y * y + z * z)) * vector.x +
      2 * (x * y - z * w) * vector.y +
      2 * (x * z + y * w) * vector.z,
    y:
      2 * (x * y + z * w) * vector.x +
      (1 - 2 * (x * x + z * z)) * vector.y +
      2 * (y * z - x * w) * vector.z,
    z:
      2 * (x * z - y * w) * vector.x +
      2 * (y * z + x * w) * vector.y +
      (1 - 2 * (x * x + y * y)) * vector.z,
  };
}

function horizontalUnit(vector: {
  x: number;
  y: number;
  z: number;
}): { x: number; z: number } {
  const length = Math.hypot(vector.x, vector.z);
  if (length <= Number.EPSILON) {
    return { x: 0, z: 0 };
  }
  return {
    x: vector.x / length,
    z: vector.z / length,
  };
}

async function simulateProductionRingPickup(
  approach: ApproachCase,
  supportCase: SupportCase = { label: "production" },
  gripDiagnostic: GripDiagnostic = {},
): Promise<RingPickupMetrics> {
  const physics = await PhysicsRuntime.create();
  createCabinetPhysics(physics);

  const layout = createCabinetLayout("ring", "grabbable");
  const placements = layout.placements.flatMap((placement) => {
    const isLeftSupport =
      placement.role === "ring_support" && placement.x < 0;
    if (!isLeftSupport) {
      return [placement];
    }

    const primary = {
      ...placement,
      prizeId: supportCase.supportPrizeId ?? placement.prizeId,
      x:
        placement.x +
        (supportCase.primaryXOffsetMeters ?? 0),
      z:
        placement.z +
        (supportCase.primaryZOffsetMeters ?? 0),
    };
    if (supportCase.secondaryXOffsetMeters === undefined) {
      return [primary];
    }

    return [
      primary,
      {
        ...placement,
        prizeId: supportCase.supportPrizeId ?? placement.prizeId,
        x:
          placement.x +
          supportCase.secondaryXOffsetMeters,
        z:
          placement.z +
          (supportCase.secondaryZOffsetMeters ??
            supportCase.primaryZOffsetMeters ??
            0),
        variantSeed: placement.variantSeed + ":secondary",
      },
    ];
  });
  const spawned = placements.map((placement) => {
    const definition = getPrizeDefinition(placement.prizeId);
    return {
      placement,
      prize: createPrize(physics, definition, {
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
      }),
    };
  });

  for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
    physics.step();
  }

  const target = spawned.find(
    (entry) =>
      entry.placement.role === "ring_target" &&
      entry.placement.x < 0,
  );
  if (!target) {
    throw new Error("left production ring target not found");
  }

  const geometry = createRingLoopGeometry();
  const settledRing = target.prize.body.translation();
  const settledRotation = target.prize.body.rotation();
  const localZ = rotateVector(
    { x: 0, y: 0, z: 1 },
    settledRotation,
  );
  const highSideAxis =
    localZ.y >= 0
      ? localZ
      : { x: -localZ.x, y: -localZ.y, z: -localZ.z };
  const highSide = horizontalUnit(highSideAxis);
  const localX = horizontalUnit(
    rotateVector({ x: 1, y: 0, z: 0 }, settledRotation),
  );

  const targetPoint = {
    x:
      settledRing.x +
      highSide.x * geometry.innerHalfZ * approach.highSideFraction +
      localX.x * approach.tangentOffsetMeters,
    z:
      settledRing.z +
      highSide.z * geometry.innerHalfZ * approach.highSideFraction +
      localX.z * approach.tangentOffsetMeters,
  };

  const theta = approach.fingerIndex * (Math.PI * 2 / 3);
  const openTipRadius =
    computeFingerTipSpan(CLAW_LAB_CONFIG.openAngle) * 0.5;
  const carriageX =
    targetPoint.x - Math.cos(theta) * openTipRadius;
  const carriageZ =
    targetPoint.z - Math.sin(theta) * openTipRadius;

  expect(carriageX).toBeGreaterThanOrEqual(M02_GANTRY_CONFIG.xMin);
  expect(carriageX).toBeLessThanOrEqual(M02_GANTRY_CONFIG.xMax);
  expect(carriageZ).toBeGreaterThanOrEqual(M02_GANTRY_CONFIG.zMin);
  expect(carriageZ).toBeLessThanOrEqual(M02_GANTRY_CONFIG.zMax);

  const claw = CLAW_LAB_CONFIG;
  const closedAngleRadians =
    gripDiagnostic.closedAngleRadians ??
    CABINET_PLAY_TUNING.closedAngleRadians;
  const retainingTorque =
    gripDiagnostic.retainingTorque ??
    CABINET_PLAY_TUNING.retainingTorque;
  const verticalHomeOffset =
    CABINET_PLAY_TUNING.verticalHomeOffsetMeters;
  const gantry = {
    ...M02_GANTRY_CONFIG,
    carriageY: M02_GANTRY_CONFIG.carriageY + verticalHomeOffset,
    reelMaxPayout:
      M02_GANTRY_CONFIG.reelMaxPayout + verticalHomeOffset,
  };
  const anchorY = gantry.carriageY - gantry.carriageHalfY;
  const initialHubY = anchorY - gantry.suspensionLength;

  const carriage = physics.createKinematicCuboid(
    { x: carriageX, y: gantry.carriageY, z: carriageZ },
    {
      x: gantry.carriageHalfX,
      y: gantry.carriageHalfY,
      z: gantry.carriageHalfZ,
    },
    0.45,
  );
  const reelAnchor = physics.createKinematicBody({
    x: carriageX,
    y: anchorY,
    z: carriageZ,
  });
  const hub = physics.createDynamicCylinder(
    { x: carriageX, y: initialHubY, z: carriageZ },
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

  const fingers = [];
  const joints = [];
  const fingerPivotLocalY =
    claw.fingerPivotY - claw.hubCenterY;

  for (let index = 0; index < 3; index += 1) {
    const fingerTheta = index * (Math.PI * 2 / 3);
    const radialX = Math.cos(fingerTheta);
    const radialZ = Math.sin(fingerTheta);
    const pivotLocal = {
      x: radialX * claw.fingerPivotRadius,
      y: fingerPivotLocalY,
      z: radialZ * claw.fingerPivotRadius,
    };
    const pivotWorld = {
      x: carriageX + pivotLocal.x,
      y: initialHubY + pivotLocal.y,
      z: carriageZ + pivotLocal.z,
    };
    const tangent = {
      x: -Math.sin(fingerTheta),
      y: 0,
      z: Math.cos(fingerTheta),
    };
    const finger = physics.createDynamicCapsuleChain(
      pivotWorld,
      createFingerSegments(
        createFingerPoints(fingerTheta),
        CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
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
    const joint = physics.createRevoluteJoint(hub, finger, {
      anchor1: pivotLocal,
      anchor2: { x: 0, y: 0, z: 0 },
      axis: tangent,
      minAngle: closedAngleRadians,
      maxAngle: claw.openAngle,
      initialTarget: claw.openAngle,
      stiffness: claw.motorStiffness,
      damping: claw.motorDamping,
      maxTorque: CABINET_PLAY_TUNING.closePickupTorque,
      contactsEnabled: false,
    });

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
      M04_PLAY_CONFIG.autoClosePayoutMeters + verticalHomeOffset,
    closedAngleRadians,
    openAngleRadians: claw.openAngle,
    closeCompletionToleranceRadians:
      M04_PLAY_CONFIG.closeCompletionToleranceRadians,
    releaseCompletionToleranceRadians:
      M04_PLAY_CONFIG.releaseCompletionToleranceRadians,
    closeSettleSeconds: M04_PLAY_CONFIG.closeSettleSeconds,
    pickupLiftDistanceMeters:
      CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
    holdBoostDurationSeconds:
      M04_PLAY_CONFIG.holdBoostDurationSeconds,
  };

  let motion: GantryMotionState = {
    x: { position: carriageX, velocity: 0 },
    z: { position: carriageZ, velocity: 0 },
  };
  let reel: ReelState = { payout: 0, velocity: 0 };
  let fingerCommand = 0;

  const applyStabilizer = (): void => {
    const hubPosition = hub.translation();
    const hubVelocity = hub.linvel();
    const impulse = computeSuspensionStabilizerImpulse(
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
    hub.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);
  };

  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    fingerCommand = advanceMotorCommand(
      fingerCommand,
      claw.openAngle,
      claw.motorSpeedRadiansPerSecond,
      dt,
    );
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
    applyStabilizer();
    for (const finger of fingers) {
      finger.wakeUp();
    }
    hub.wakeUp();
    physics.step();
  }

  const baseline = target.prize.body.translation();
  const baselinePosition = {
    x: baseline.x,
    y: baseline.y,
    z: baseline.z,
  };

  let play = applyM04Action(createM04PlayState(), reel.payout);
  const fingerContactTicks = [0, 0, 0];
  const peakFingerContactPairs = [0, 0, 0];
  const firstFingerContactPhase: Array<string | null> = [
    null,
    null,
    null,
  ];
  const contactAtRetainingStart = [false, false, false];
  const contactAtReturningStart = [false, false, false];
  const returningContactTicks = [0, 0, 0];
  let closePlanarDisplacementMeters = 0;
  let displacementAtClosedAtDepthMeters = Number.NaN;
  let displacementAtPickupStartMeters = Number.NaN;
  let liftAtClosedAtDepthMeters = Number.NaN;
  let liftAtPickupStartMeters = Number.NaN;
  let liftAtRetainingStartMeters = Number.NaN;
  let liftAtReturningStartMeters = Number.NaN;
  let peakLiftMeters = 0;
  let minimumLiftDuringReturningMeters = Number.POSITIVE_INFINITY;
  let maxRingSpeedMetersPerSecond = 0;
  let retainingReached = false;
  let returningReached = false;
  let releasingReached = false;
  let escapedPhase: string | null = null;
  let poseCollapsePhase: string | null = null;
  let hadMeaningfulLift = false;
  let returnStartRingPosition: { x: number; z: number } | null = null;
  const chuteSensor = new ChuteSensor();
  let chuteReached = false;
  let chuteReachedPhase: string | null = null;
  let ringReturnTravelAtChuteMeters = Number.NaN;
  let gantryDistanceToReturnTargetAtChuteMeters = Number.NaN;

  const tolerance = {
    position: gantry.homePositionTolerance,
    velocity: gantry.homeVelocityTolerance,
  };

  for (let tick = 0; tick < PHYSICS_HZ * 12; tick += 1) {
    const phaseAtTickStart = play.phase;

    if (phaseAtTickStart === "RETURNING") {
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
      reel.payout <= gantry.reelMinPayout + 1e-5 &&
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

    const phaseBeforeImmediate = play.phase;
    play = advanceM04PlayState(
      play,
      {
        reelPayoutMeters: reel.payout,
        fingerCommandRadians: fingerCommand,
        reelAtTop,
        homeReached,
        holdBoostRequested: false,
      },
      playConfig,
      0,
    );

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

    applyStabilizer();

    const closing = m04FingerShouldClose(play);
    fingerCommand = advanceMotorCommand(
      fingerCommand,
      closing
        ? closedAngleRadians
        : claw.openAngle,
      claw.motorSpeedRadiansPerSecond,
      dt,
    );

    play = advanceM04PlayState(
      play,
      {
        reelPayoutMeters: reel.payout,
        fingerCommandRadians: fingerCommand,
        reelAtTop,
        homeReached,
        holdBoostRequested: false,
      },
      playConfig,
      dt,
    );

    const forcePhase = m04ForcePhase(play);
    const activeTorque =
      forcePhase === "RETAINING"
        ? retainingTorque
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
          ? activeTorque
          : M02_FINGER_TRANSPORT_CONFIG.maxTorque,
      );
    }

    for (const finger of fingers) {
      finger.wakeUp();
    }
    hub.wakeUp();
    target.prize.body.wakeUp();
    physics.step();

    const ringPosition = target.prize.body.translation();
    const ringVelocity = target.prize.body.linvel();
    const lift = ringPosition.y - baselinePosition.y;
    const planarDisplacement = Math.hypot(
      ringPosition.x - baselinePosition.x,
      ringPosition.z - baselinePosition.z,
    );
    peakLiftMeters = Math.max(peakLiftMeters, lift);
    maxRingSpeedMetersPerSecond = Math.max(
      maxRingSpeedMetersPerSecond,
      Math.hypot(
        ringVelocity.x,
        ringVelocity.y,
        ringVelocity.z,
      ),
    );

    if (
      play.phase === "CLOSING" ||
      play.phase === "CLOSED_AT_DEPTH"
    ) {
      closePlanarDisplacementMeters = Math.max(
        closePlanarDisplacementMeters,
        planarDisplacement,
      );
    }

    const currentContactPairs = fingers.map((finger) =>
      physics.countBodyContactPairs(
        finger,
        target.prize.body,
      ),
    );
    for (let index = 0; index < fingers.length; index += 1) {
      const pairs = currentContactPairs[index]!;
      peakFingerContactPairs[index] = Math.max(
        peakFingerContactPairs[index]!,
        pairs,
      );
      if (pairs > 0) {
        fingerContactTicks[index] += 1;
        firstFingerContactPhase[index] ??= play.phase;
        if (play.phase === "RETURNING") {
          returningContactTicks[index] += 1;
        }
      }
    }

    if (
      phaseBeforeImmediate !== "CLOSED_AT_DEPTH" &&
      play.phase === "CLOSED_AT_DEPTH" &&
      !Number.isFinite(liftAtClosedAtDepthMeters)
    ) {
      liftAtClosedAtDepthMeters = lift;
      displacementAtClosedAtDepthMeters = planarDisplacement;
    }

    if (
      phaseAtTickStart !== "PICKUP" &&
      play.phase === "PICKUP" &&
      !Number.isFinite(liftAtPickupStartMeters)
    ) {
      liftAtPickupStartMeters = lift;
      displacementAtPickupStartMeters = planarDisplacement;
    }

    if (
      !retainingReached &&
      play.phase === "RETAINING"
    ) {
      retainingReached = true;
      liftAtRetainingStartMeters = lift;
      for (let index = 0; index < currentContactPairs.length; index += 1) {
        contactAtRetainingStart[index] =
          currentContactPairs[index]! > 0;
      }
    }

    if (
      !returningReached &&
      play.phase === "RETURNING"
    ) {
      returningReached = true;
      liftAtReturningStartMeters = lift;
      for (let index = 0; index < currentContactPairs.length; index += 1) {
        contactAtReturningStart[index] =
          currentContactPairs[index]! > 0;
      }
      returnStartRingPosition = {
        x: ringPosition.x,
        z: ringPosition.z,
      };
    }

    if (play.phase === "RETURNING") {
      minimumLiftDuringReturningMeters = Math.min(
        minimumLiftDuringReturningMeters,
        lift,
      );
    }

    if (
      !chuteReached &&
      chuteSensor.pollPrize(
        "m09-production-ring",
        target.prize.body,
      )
    ) {
      chuteReached = true;
      chuteReachedPhase = play.phase;
      ringReturnTravelAtChuteMeters = returnStartRingPosition
        ? Math.hypot(
            ringPosition.x - returnStartRingPosition.x,
            ringPosition.z - returnStartRingPosition.z,
          )
        : 0;
      gantryDistanceToReturnTargetAtChuteMeters = Math.hypot(
        motion.x.position - CABINET_CLAW_PARK_POSITION.x,
        motion.z.position - CABINET_CLAW_PARK_POSITION.z,
      );
    }

    if (
      poseCollapsePhase === null &&
      lift < -0.012
    ) {
      poseCollapsePhase = play.phase;
    }

    hadMeaningfulLift ||= lift > 0.015;
    const anyContact = currentContactPairs.some(
      (pairs) => pairs > 0,
    );
    if (
      escapedPhase === null &&
      hadMeaningfulLift &&
      lift < 0.005 &&
      !anyContact
    ) {
      escapedPhase = play.phase;
    }

    if (play.phase === "RELEASING") {
      releasingReached = true;
      break;
    }
  }

  const final = target.prize.body.translation();
  const finalLiftMeters = final.y - baselinePosition.y;
  const ringReturnTravelMeters = returnStartRingPosition
    ? Math.hypot(
        final.x - returnStartRingPosition.x,
        final.z - returnStartRingPosition.z,
      )
    : 0;
  const minReturnLift = Number.isFinite(
    minimumLiftDuringReturningMeters,
  )
    ? minimumLiftDuringReturningMeters
    : Number.NaN;

  const success =
    (chuteReached &&
      (chuteReachedPhase === "RETURNING" ||
        chuteReachedPhase === "RELEASING")) ||
    (retainingReached &&
      returningReached &&
      releasingReached &&
      peakLiftMeters > 0.03 &&
      minReturnLift > 0.02 &&
      ringReturnTravelMeters > 0.12);

  return {
    label: approach.label,
    fingerIndex: approach.fingerIndex,
    carriageX,
    carriageZ,
    targetPointX: targetPoint.x,
    targetPointZ: targetPoint.z,
    ringBaselineX: baselinePosition.x,
    ringBaselineY: baselinePosition.y,
    ringBaselineZ: baselinePosition.z,
    fingerContactTicks,
    peakFingerContactPairs,
    firstFingerContactPhase,
    contactAtRetainingStart,
    contactAtReturningStart,
    returningContactTicks,
    closePlanarDisplacementMeters,
    displacementAtClosedAtDepthMeters,
    displacementAtPickupStartMeters,
    liftAtClosedAtDepthMeters,
    liftAtPickupStartMeters,
    liftAtRetainingStartMeters,
    liftAtReturningStartMeters,
    finalLiftMeters,
    peakLiftMeters,
    minimumLiftDuringReturningMeters: minReturnLift,
    ringReturnTravelMeters,
    chuteReached,
    chuteReachedPhase,
    ringReturnTravelAtChuteMeters,
    gantryDistanceToReturnTargetAtChuteMeters,
    maxRingSpeedMetersPerSecond,
    retainingReached,
    returningReached,
    releasingReached,
    escapedPhase,
    poseCollapsePhase,
    supportCaseLabel: supportCase.label,
    gripDiagnosticLabel: gripDiagnostic.label ?? "production",
    closedAngleRadians,
    retainingTorque,
    success,
  };
}

describe("M09 production-claw ring pickup", () => {
  it("sweeps realistic one-prong approaches through close, pickup, retain and return", async () => {
    const approaches: ApproachCase[] = [
      {
        label: "finger-1 centered-high-side",
        fingerIndex: 1,
        highSideFraction: 0.35,
        tangentOffsetMeters: 0,
      },
      {
        label: "finger-1 deeper-high-side",
        fingerIndex: 1,
        highSideFraction: 0.52,
        tangentOffsetMeters: 0,
      },
      {
        label: "finger-1 tangent-plus-10mm",
        fingerIndex: 1,
        highSideFraction: 0.42,
        tangentOffsetMeters: 0.010,
      },
      {
        label: "finger-1 tangent-minus-10mm",
        fingerIndex: 1,
        highSideFraction: 0.42,
        tangentOffsetMeters: -0.010,
      },
      {
        label: "finger-2 centered-high-side",
        fingerIndex: 2,
        highSideFraction: 0.35,
        tangentOffsetMeters: 0,
      },
    ];

    const metrics: RingPickupMetrics[] = [];
    for (const approach of approaches) {
      metrics.push(await simulateProductionRingPickup(approach));
    }

    console.log(
      "M09 production ring pickup metrics",
      JSON.stringify(metrics),
    );

    for (const result of metrics) {
      expect(result.retainingReached).toBe(true);
      expect(result.returningReached).toBe(true);
      expect(result.releasingReached).toBe(true);
      expect(
        result.fingerContactTicks.reduce(
          (sum, value) => sum + value,
          0,
        ),
      ).toBeGreaterThan(0);
    }

    const successful = metrics.filter((result) => result.success);
    expect(successful.length).toBeGreaterThanOrEqual(1);
  }, 10_000);
});
