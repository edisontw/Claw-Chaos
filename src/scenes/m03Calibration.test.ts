import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { M02_GANTRY_CONFIG } from "./gantryLab";
import { advanceGantryAxis } from "./gantryMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

interface SuspensionCandidate {
  stiffness: number;
  damping: number;
}

interface CandidateMetrics extends SuspensionCandidate {
  lagMeters: number;
  forwardSwingMeters: number;
  peakSwingAngleRadians: number;
  residualOffsetMeters: number;
  pt007EarlyPeakMeters: number;
  pt007LatePeakMeters: number;
  pt007GrowthRatio: number;
  finiteAndBounded: boolean;
}

function makeAxisConfig() {
  const config = M02_GANTRY_CONFIG;
  return {
    minPosition: config.xMin,
    maxPosition: config.xMax,
    maxSpeed: config.maxSpeed,
    acceleration: config.acceleration,
    braking: config.braking,
  };
}

async function runPt006(candidate: SuspensionCandidate) {
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
    carriage,
    hub,
    { x: 0, y: -config.carriageHalfY, z: 0 },
    { x: 0, y: config.suspensionLength, z: 0 },
    false,
  );

  let gantry = { position: 0, velocity: 0 };
  const axisConfig = makeAxisConfig();
  let minRelativeX = 0;
  let maxRelativeX = 0;
  let peakAngle = 0;
  let finiteAndBounded = true;

  const step = (input: number, sample: boolean) => {
    gantry = advanceGantryAxis(gantry, input, axisConfig, dt);
    carriage.setNextKinematicTranslation({
      x: gantry.position,
      y: config.carriageY,
      z: 0,
    });
    const pos = hub.translation();
    const vel = hub.linvel();
    const impulse = computeSuspensionStabilizerImpulse(
      {
        anchorX: gantry.position,
        anchorZ: 0,
        anchorVelocityX: gantry.velocity,
        anchorVelocityZ: 0,
        hubX: pos.x,
        hubZ: pos.z,
        hubVelocityX: vel.x,
        hubVelocityZ: vel.z,
      },
      {
        stiffness: candidate.stiffness,
        damping: candidate.damping,
        maxForce: config.suspensionSpringMaxForce,
      },
      dt,
    );
    hub.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);
    physics.step();

    const next = hub.translation();
    if (sample) {
      const relX = next.x - gantry.position;
      minRelativeX = Math.min(minRelativeX, relX);
      maxRelativeX = Math.max(maxRelativeX, relX);
      peakAngle = Math.max(
        peakAngle,
        Math.atan2(
          Math.abs(relX),
          Math.max(1e-6, anchorY - next.y),
        ),
      );
    }
    const q = hub.rotation();
    finiteAndBounded =
      finiteAndBounded &&
      [next.x, next.y, next.z, q.x, q.y, q.z, q.w].every(Number.isFinite) &&
      Math.abs(next.x) < 1 &&
      next.y > 0.2 &&
      next.y < 1.2;
  };

  for (let i = 0; i < PHYSICS_HZ; i += 1) step(0, false);

  const accelTicks = Math.ceil(config.pt006AccelerationSeconds * PHYSICS_HZ);
  for (let i = 0; i < accelTicks; i += 1) step(1, true);

  const lagMeters = Math.abs(Math.min(0, minRelativeX));
  maxRelativeX = 0;
  peakAngle = 0;

  const brakeTicks = Math.ceil(
    config.pt006BrakeObservationSeconds * PHYSICS_HZ,
  );
  for (let i = 0; i < brakeTicks; i += 1) step(0, true);

  const finalHub = hub.translation();
  return {
    lagMeters,
    forwardSwingMeters: Math.max(0, maxRelativeX),
    peakSwingAngleRadians: peakAngle,
    residualOffsetMeters: Math.hypot(
      finalHub.x - gantry.position,
      finalHub.z,
    ),
    finiteAndBounded,
  };
}

async function runPt007(candidate: SuspensionCandidate) {
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
    carriage,
    hub,
    { x: 0, y: -config.carriageHalfY, z: 0 },
    { x: 0, y: config.suspensionLength, z: 0 },
    false,
  );

  let gantry = { position: 0, velocity: 0 };
  const axisConfig = makeAxisConfig();
  let earlyPeak = 0;
  let latePeak = 0;
  let finiteAndBounded = true;

  const step = (input: number, early: boolean) => {
    gantry = advanceGantryAxis(gantry, input, axisConfig, dt);
    carriage.setNextKinematicTranslation({
      x: gantry.position,
      y: config.carriageY,
      z: 0,
    });
    const pos = hub.translation();
    const vel = hub.linvel();
    const impulse = computeSuspensionStabilizerImpulse(
      {
        anchorX: gantry.position,
        anchorZ: 0,
        anchorVelocityX: gantry.velocity,
        anchorVelocityZ: 0,
        hubX: pos.x,
        hubZ: pos.z,
        hubVelocityX: vel.x,
        hubVelocityZ: vel.z,
      },
      {
        stiffness: candidate.stiffness,
        damping: candidate.damping,
        maxForce: config.suspensionSpringMaxForce,
      },
      dt,
    );
    hub.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);
    physics.step();

    const next = hub.translation();
    const amp = Math.abs(next.x - gantry.position);
    if (early) earlyPeak = Math.max(earlyPeak, amp);
    else latePeak = Math.max(latePeak, amp);

    const q = hub.rotation();
    finiteAndBounded =
      finiteAndBounded &&
      [next.x, next.y, next.z, q.x, q.y, q.z, q.w].every(Number.isFinite) &&
      Math.abs(next.x) < 1 &&
      next.y > 0.2 &&
      next.y < 1.2;
  };

  for (let i = 0; i < PHYSICS_HZ; i += 1) step(0, true);

  const halfPeriodTicks = Math.round(0.4 * PHYSICS_HZ);
  for (let segment = 0; segment < 12; segment += 1) {
    const input = segment % 2 === 0 ? 1 : -1;
    for (let i = 0; i < halfPeriodTicks; i += 1) {
      step(input, segment < 4);
    }
  }

  return {
    earlyPeak,
    latePeak,
    growthRatio: earlyPeak > 1e-9 ? latePeak / earlyPeak : 0,
    finiteAndBounded,
  };
}

describe("M03 suspension calibration exploration", () => {
  it("prints PT-006/PT-007 overlap candidates without changing the M02 baseline", async () => {
    const stiffnesses = [120, 140, 150, 160, 170, 180];
    const dampings = [1.0, 1.5, 2.0, 2.5, 3.0];
    const results: CandidateMetrics[] = [];

    for (const stiffness of stiffnesses) {
      for (const damping of dampings) {
        const candidate = { stiffness, damping };
        const pt006 = await runPt006(candidate);
        const pt007 = await runPt007(candidate);
        results.push({
          ...candidate,
          ...pt006,
          pt007EarlyPeakMeters: pt007.earlyPeak,
          pt007LatePeakMeters: pt007.latePeak,
          pt007GrowthRatio: pt007.growthRatio,
          finiteAndBounded:
            pt006.finiteAndBounded && pt007.finiteAndBounded,
        });
      }
    }

    console.log("M03 calibration sweep", JSON.stringify(results));

    expect(results.every((result) => result.finiteAndBounded)).toBe(true);
  });
});
