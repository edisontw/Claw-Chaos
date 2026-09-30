import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { M02_GANTRY_CONFIG } from "./gantryLab";
import { advanceGantryAxis } from "./gantryMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

interface SwingRunMetrics {
  halfPeriodSeconds: number;
  earlyPeakMeters: number;
  latePeakMeters: number;
  overallPeakMeters: number;
  peakAngleRadians: number;
  finiteAndBounded: boolean;
}

async function runSwingPump(
  halfPeriodSeconds: number,
): Promise<SwingRunMetrics> {
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

  const axisConfig = {
    minPosition: config.xMin,
    maxPosition: config.xMax,
    maxSpeed: config.maxSpeed,
    acceleration: config.acceleration,
    braking: config.braking,
  };
  let gantry = { position: 0, velocity: 0 };
  let finiteAndBounded = true;
  let earlyPeakMeters = 0;
  let latePeakMeters = 0;
  let overallPeakMeters = 0;
  let peakAngleRadians = 0;

  const step = (input: number, samplePhase: "settle" | "early" | "late"): void => {
    gantry = advanceGantryAxis(gantry, input, axisConfig, dt);
    carriage.setNextKinematicTranslation({
      x: gantry.position,
      y: config.carriageY,
      z: 0,
    });

    const position = hub.translation();
    const velocity = hub.linvel();
    const impulse = computeSuspensionStabilizerImpulse(
      {
        anchorX: gantry.position,
        anchorZ: 0,
        anchorVelocityX: gantry.velocity,
        anchorVelocityZ: 0,
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
    const relativeX = next.x - gantry.position;
    const amplitude = Math.abs(relativeX);
    const vertical = Math.max(1e-6, anchorY - next.y);
    const angle = Math.atan2(amplitude, vertical);

    if (samplePhase === "early") {
      earlyPeakMeters = Math.max(earlyPeakMeters, amplitude);
    } else if (samplePhase === "late") {
      latePeakMeters = Math.max(latePeakMeters, amplitude);
    }
    overallPeakMeters = Math.max(overallPeakMeters, amplitude);
    peakAngleRadians = Math.max(peakAngleRadians, angle);

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
      ].every(Number.isFinite) &&
      Math.abs(next.x) < 1 &&
      next.y > 0.2 &&
      next.y < 1.2;
  };

  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    step(0, "settle");
  }

  const halfPeriodTicks = Math.max(
    1,
    Math.round(halfPeriodSeconds * PHYSICS_HZ),
  );
  const reversalCount = 12;
  for (let segment = 0; segment < reversalCount; segment += 1) {
    const input = segment % 2 === 0 ? 1 : -1;
    const samplePhase = segment < 4 ? "early" : "late";
    for (let tick = 0; tick < halfPeriodTicks; tick += 1) {
      step(input, samplePhase);
    }
  }

  for (let tick = 0; tick < Math.ceil(0.5 * PHYSICS_HZ); tick += 1) {
    step(0, "late");
  }

  return {
    halfPeriodSeconds,
    earlyPeakMeters,
    latePeakMeters,
    overallPeakMeters,
    peakAngleRadians,
    finiteAndBounded,
  };
}

describe("PT-007 swing amplification", () => {
  it("finds a repeatable reversal cadence that grows lateral swing without numerical runaway", async () => {
    const candidates = [0.12, 0.16, 0.20, 0.24, 0.28, 0.32];
    const results: SwingRunMetrics[] = [];

    for (const halfPeriodSeconds of candidates) {
      results.push(await runSwingPump(halfPeriodSeconds));
    }

    results.sort((a, b) => b.latePeakMeters - a.latePeakMeters);
    const best = results[0]!;

    console.log("PT-007 cadence sweep", JSON.stringify(results));

    expect(results.every((result) => result.finiteAndBounded)).toBe(true);
    expect(best.earlyPeakMeters).toBeGreaterThan(0.003);
    expect(best.latePeakMeters).toBeGreaterThan(best.earlyPeakMeters * 1.15);
    expect(best.latePeakMeters).toBeGreaterThan(0.018);
    expect(best.overallPeakMeters).toBeLessThan(0.10);
    expect(best.peakAngleRadians).toBeLessThan(0.35);
  });
});
