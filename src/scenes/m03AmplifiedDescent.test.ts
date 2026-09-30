import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { M02_GANTRY_CONFIG } from "./gantryLab";
import {
  advanceGantryMotion,
  type GantryMotionState,
} from "./gantryMotion";
import { advanceReel, type ReelState } from "./reelMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

interface AmplifiedDescentMetrics {
  pumpPeakResultantMeters: number;
  dropTriggerFound: boolean;
  dropStartOffsetXMeters: number;
  dropStartOffsetZMeters: number;
  dropStartResultantMeters: number;
  dropStartHorizontalSpeed: number;
  dropStartRelativeHorizontalSpeed: number;
  firstDropTickHorizontalSpeed: number;
  firstDropTickRelativeHorizontalSpeed: number;
  firstTickSpeedRetentionRatio: number;
  descentMeters: number;
  maxDropOffsetXMeters: number;
  maxDropOffsetZMeters: number;
  maxDropResultantMeters: number;
  maxHubTravelFromDropStartMeters: number;
  maxSuspensionErrorMeters: number;
  finalSuspensionDistanceMeters: number;
  bottomPayoutMeters: number;
  dropTicks: number;
  finiteAndBounded: boolean;
}

async function runAmplifiedDiagonalDescent(): Promise<AmplifiedDescentMetrics> {
  const config = M02_GANTRY_CONFIG;
  const physics = await PhysicsRuntime.create();
  const dt = 1 / PHYSICS_HZ;
  const anchorY = config.carriageY - config.carriageHalfY;

  const carriage = physics.createKinematicCuboid(
    { x: 0, y: config.carriageY, z: 0 },
    {
      x: config.carriageHalfX,
      y: config.carriageHalfY,
      z: config.carriageHalfZ,
    },
  );
  const reelAnchor = physics.createKinematicBody({
    x: 0,
    y: anchorY,
    z: 0,
  });
  const hub = physics.createDynamicCylinder(
    { x: 0, y: anchorY - config.suspensionLength, z: 0 },
    0.082,
    0.055,
    config.hubMassKg,
    { friction: 0.55, restitution: 0.02 },
  );
  hub.setAngularDamping(config.suspensionAngularDamping);
  hub.setLinearDamping(config.suspensionLinearDamping);

  physics.createSphericalJoint(
    reelAnchor,
    hub,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: config.suspensionLength, z: 0 },
    false,
  );

  const motionConfig = {
    x: {
      minPosition: config.xMin,
      maxPosition: config.xMax,
      maxSpeed: config.maxSpeed,
      acceleration: config.acceleration,
      braking: config.braking,
    },
    z: {
      minPosition: config.zMin,
      maxPosition: config.zMax,
      maxSpeed: config.maxSpeed,
      acceleration: config.acceleration,
      braking: config.braking,
    },
  };
  const reelConfig = {
    minPayout: config.reelMinPayout,
    maxPayout: config.reelMaxPayout,
    maxSpeed: config.reelMaxSpeed,
    acceleration: config.reelAcceleration,
    braking: config.reelBraking,
  };

  let motion: GantryMotionState = {
    x: { position: 0, velocity: 0 },
    z: { position: 0, velocity: 0 },
  };
  let reel: ReelState = { payout: 0, velocity: 0 };
  let finiteAndBounded = true;
  let pumpPeakResultantMeters = 0;
  let maxSuspensionErrorMeters = 0;

  const applyStep = (
    inputX: number,
    inputZ: number,
    reelCommand: number,
    measurePump: boolean,
  ): void => {
    motion = advanceGantryMotion(
      motion,
      inputX,
      inputZ,
      motionConfig,
      dt,
    );
    reel = advanceReel(reel, reelCommand, reelConfig, dt);

    carriage.setNextKinematicTranslation({
      x: motion.x.position,
      y: config.carriageY,
      z: motion.z.position,
    });
    reelAnchor.setNextKinematicTranslation({
      x: motion.x.position,
      y: anchorY - reel.payout,
      z: motion.z.position,
    });

    const position = hub.translation();
    const velocity = hub.linvel();
    const impulse = computeSuspensionStabilizerImpulse(
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
        stiffness: config.suspensionSpringStiffness,
        damping: config.suspensionSpringDamping,
        maxForce: config.suspensionSpringMaxForce,
      },
      dt,
    );
    hub.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);
    physics.step();

    const next = hub.translation();
    const rotation = hub.rotation();
    const relativeX = next.x - motion.x.position;
    const relativeZ = next.z - motion.z.position;
    const resultant = Math.hypot(relativeX, relativeZ);
    const anchor = reelAnchor.translation();
    const suspensionDistance = Math.hypot(
      next.x - anchor.x,
      next.y - anchor.y,
      next.z - anchor.z,
    );

    if (measurePump) {
      pumpPeakResultantMeters = Math.max(
        pumpPeakResultantMeters,
        resultant,
      );
    }
    maxSuspensionErrorMeters = Math.max(
      maxSuspensionErrorMeters,
      Math.abs(suspensionDistance - config.suspensionLength),
    );

    finiteAndBounded =
      finiteAndBounded &&
      [
        next.x,
        next.y,
        next.z,
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
        motion.x.position,
        motion.x.velocity,
        motion.z.position,
        motion.z.velocity,
        reel.payout,
        reel.velocity,
      ].every(Number.isFinite) &&
      Math.abs(next.x) < 1 &&
      Math.abs(next.z) < 1 &&
      next.y > 0.1 &&
      next.y < 1.2;
  };

  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    applyStep(0, 0, 0, false);
  }

  const halfPeriodTicks = Math.round(0.4 * PHYSICS_HZ);
  for (let segment = 0; segment < 12; segment += 1) {
    const input = segment % 2 === 0 ? 1 : -1;
    for (let tick = 0; tick < halfPeriodTicks; tick += 1) {
      applyStep(input, input, 0, true);
    }
  }

  let dropTriggerFound = false;
  const triggerWindowTicks = Math.ceil(0.5 * PHYSICS_HZ);

  for (let tick = 0; tick < triggerWindowTicks; tick += 1) {
    applyStep(0, 0, 0, false);

    const position = hub.translation();
    const velocity = hub.linvel();
    const offset = Math.hypot(
      position.x - motion.x.position,
      position.z - motion.z.position,
    );
    const relativeSpeed = Math.hypot(
      velocity.x - motion.x.velocity,
      velocity.z - motion.z.velocity,
    );

    if (offset >= 0.008 && relativeSpeed >= 0.08) {
      dropTriggerFound = true;
      break;
    }
  }

  const dropStartPosition = hub.translation();
  const dropStartVelocity = hub.linvel();
  const dropStartOffsetX = dropStartPosition.x - motion.x.position;
  const dropStartOffsetZ = dropStartPosition.z - motion.z.position;
  const dropStartResultant = Math.hypot(
    dropStartOffsetX,
    dropStartOffsetZ,
  );
  const dropStartHorizontalSpeed = Math.hypot(
    dropStartVelocity.x,
    dropStartVelocity.z,
  );
  const dropStartRelativeHorizontalSpeed = Math.hypot(
    dropStartVelocity.x - motion.x.velocity,
    dropStartVelocity.z - motion.z.velocity,
  );

  let firstDropTickHorizontalSpeed = 0;
  let firstDropTickRelativeHorizontalSpeed = 0;
  let minHubY = dropStartPosition.y;
  let maxDropOffsetX = Math.abs(dropStartOffsetX);
  let maxDropOffsetZ = Math.abs(dropStartOffsetZ);
  let maxDropResultant = dropStartResultant;
  let maxHubTravelFromDropStart = 0;
  let dropTicks = 0;

  while (
    dropTicks < PHYSICS_HZ * 4 &&
    !(
      reel.payout >= config.reelMaxPayout - 1e-5 &&
      Math.abs(reel.velocity) < 1e-4
    )
  ) {
    applyStep(0, 0, 1, false);
    dropTicks += 1;

    const position = hub.translation();
    const velocity = hub.linvel();
    const relativeX = position.x - motion.x.position;
    const relativeZ = position.z - motion.z.position;
    const resultant = Math.hypot(relativeX, relativeZ);

    if (dropTicks === 1) {
      firstDropTickHorizontalSpeed = Math.hypot(
        velocity.x,
        velocity.z,
      );
      firstDropTickRelativeHorizontalSpeed = Math.hypot(
        velocity.x - motion.x.velocity,
        velocity.z - motion.z.velocity,
      );
    }

    minHubY = Math.min(minHubY, position.y);
    maxDropOffsetX = Math.max(maxDropOffsetX, Math.abs(relativeX));
    maxDropOffsetZ = Math.max(maxDropOffsetZ, Math.abs(relativeZ));
    maxDropResultant = Math.max(maxDropResultant, resultant);
    maxHubTravelFromDropStart = Math.max(
      maxHubTravelFromDropStart,
      Math.hypot(
        position.x - dropStartPosition.x,
        position.z - dropStartPosition.z,
      ),
    );
  }

  const finalHub = hub.translation();
  const finalAnchor = reelAnchor.translation();
  const finalSuspensionDistance = Math.hypot(
    finalHub.x - finalAnchor.x,
    finalHub.y - finalAnchor.y,
    finalHub.z - finalAnchor.z,
  );

  return {
    pumpPeakResultantMeters,
    dropTriggerFound,
    dropStartOffsetXMeters: dropStartOffsetX,
    dropStartOffsetZMeters: dropStartOffsetZ,
    dropStartResultantMeters: dropStartResultant,
    dropStartHorizontalSpeed,
    dropStartRelativeHorizontalSpeed,
    firstDropTickHorizontalSpeed,
    firstDropTickRelativeHorizontalSpeed,
    firstTickSpeedRetentionRatio:
      dropStartHorizontalSpeed > 1e-6
        ? firstDropTickHorizontalSpeed / dropStartHorizontalSpeed
        : 0,
    descentMeters: dropStartPosition.y - minHubY,
    maxDropOffsetXMeters: maxDropOffsetX,
    maxDropOffsetZMeters: maxDropOffsetZ,
    maxDropResultantMeters: maxDropResultant,
    maxHubTravelFromDropStartMeters: maxHubTravelFromDropStart,
    maxSuspensionErrorMeters,
    finalSuspensionDistanceMeters: finalSuspensionDistance,
    bottomPayoutMeters: reel.payout,
    dropTicks,
    finiteAndBounded,
  };
}

describe("M03 amplified-swing descent", () => {
  it("preserves a deliberately amplified diagonal swing while the reel descends physically", async () => {
    const metrics = await runAmplifiedDiagonalDescent();

    console.log("M03 amplified descent metrics", JSON.stringify(metrics));

    expect(metrics.finiteAndBounded).toBe(true);
    expect(metrics.pumpPeakResultantMeters).toBeGreaterThan(0.025);
    expect(metrics.dropTriggerFound).toBe(true);

    expect(metrics.dropStartResultantMeters).toBeGreaterThan(0.008);
    expect(metrics.dropStartRelativeHorizontalSpeed).toBeGreaterThan(0.08);
    expect(metrics.dropStartHorizontalSpeed).toBeGreaterThan(0.02);
    expect(metrics.firstDropTickHorizontalSpeed).toBeGreaterThan(0.01);
    expect(metrics.firstDropTickRelativeHorizontalSpeed).toBeGreaterThan(0.04);
    expect(metrics.firstTickSpeedRetentionRatio).toBeGreaterThan(0.2);

    expect(metrics.descentMeters).toBeGreaterThanOrEqual(
      M02_GANTRY_CONFIG.pt008MinDescentMeters,
    );
    expect(metrics.maxDropOffsetXMeters).toBeGreaterThan(0.01);
    expect(metrics.maxDropOffsetZMeters).toBeGreaterThan(0.01);
    expect(metrics.maxDropResultantMeters).toBeGreaterThan(0.018);
    expect(metrics.maxHubTravelFromDropStartMeters).toBeGreaterThan(0.01);

    expect(metrics.maxDropResultantMeters).toBeLessThan(0.08);
    expect(metrics.maxSuspensionErrorMeters).toBeLessThan(0.002);
    expect(metrics.finalSuspensionDistanceMeters).toBeCloseTo(
      M02_GANTRY_CONFIG.suspensionLength,
      2,
    );
    expect(metrics.bottomPayoutMeters).toBeCloseTo(
      M02_GANTRY_CONFIG.reelMaxPayout,
      4,
    );
  });
});
