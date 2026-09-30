import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { M02_GANTRY_CONFIG } from "./gantryLab";
import { advanceGantryAxis } from "./gantryMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";
import {
  advancePhaseAwareSwingPump,
  type SwingPumpState,
} from "./swingTechnique";

interface SwingRunMetrics {
  label: string;
  earlyPeakMeters: number;
  latePeakMeters: number;
  overallPeakMeters: number;
  peakAngleRadians: number;
  reversalCount: number;
  finiteAndBounded: boolean;
}

async function runSwingPump(
  mode: "phase-aware" | "fixed",
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
  let pump: SwingPumpState = { direction: 1, initialized: false };
  let previousDirection = pump.direction;
  let reversalCount = 0;
  let finiteAndBounded = true;
  let earlyPeakMeters = 0;
  let latePeakMeters = 0;
  let overallPeakMeters = 0;
  let peakAngleRadians = 0;

  const step = (
    input: number,
    samplePhase: "settle" | "early" | "late",
  ): void => {
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

        maxDampingForce: config.suspensionDampingForceLimit,
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

  const totalTicks = Math.ceil(4.0 * PHYSICS_HZ);
  const fixedHalfPeriodTicks = Math.round(0.32 * PHYSICS_HZ);

  for (let tick = 0; tick < totalTicks; tick += 1) {
    const hubPosition = hub.translation();
    const hubVelocity = hub.linvel();
    const relativePosition = hubPosition.x - gantry.position;
    const relativeVelocity = hubVelocity.x - gantry.velocity;

    let input: number;
    if (mode === "phase-aware") {
      pump = advancePhaseAwareSwingPump(
        pump,
        { relativePosition, relativeVelocity },
        {
          velocityDeadband: 0.002,
          minOffsetForReversal: 0.0015,
        },
      );
      input = pump.direction;
      if (pump.direction !== previousDirection) {
        reversalCount += 1;
        previousDirection = pump.direction;
      }
    } else {
      const segment = Math.floor(tick / fixedHalfPeriodTicks);
      input = segment % 2 === 0 ? 1 : -1;
    }

    step(input, tick < totalTicks / 3 ? "early" : "late");
  }

  for (let tick = 0; tick < Math.ceil(0.5 * PHYSICS_HZ); tick += 1) {
    step(0, "late");
  }

  return {
    label: mode,
    earlyPeakMeters,
    latePeakMeters,
    overallPeakMeters,
    peakAngleRadians,
    reversalCount,
    finiteAndBounded,
  };
}

describe("PT-007 swing amplification", () => {
  it("grows lateral swing when reversals follow claw phase instead of a blind cadence", async () => {
    const phaseAware = await runSwingPump("phase-aware");
    const fixed = await runSwingPump("fixed");

    console.log(
      "PT-007 phase comparison",
      JSON.stringify({ phaseAware, fixed }),
    );

    expect(phaseAware.finiteAndBounded).toBe(true);
    expect(fixed.finiteAndBounded).toBe(true);
    expect(phaseAware.reversalCount).toBeGreaterThanOrEqual(3);
    expect(phaseAware.earlyPeakMeters).toBeGreaterThan(0.003);
    expect(phaseAware.latePeakMeters).toBeGreaterThan(
      phaseAware.earlyPeakMeters * 1.15,
    );
    expect(phaseAware.latePeakMeters).toBeGreaterThan(
      fixed.latePeakMeters * 1.5,
    );
    expect(phaseAware.latePeakMeters).toBeGreaterThan(0.018);
    expect(phaseAware.overallPeakMeters).toBeLessThan(0.10);
    expect(phaseAware.peakAngleRadians).toBeLessThan(0.35);
  });
});
