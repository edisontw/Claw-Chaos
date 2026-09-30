import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { M02_GANTRY_CONFIG } from "./gantryLab";
import {
  advanceGantryMotion,
  type GantryMotionState,
} from "./gantryMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

type SamplePhase = "settle" | "early" | "late";

interface PumpDirection {
  x: number;
  z: number;
}

interface SwingAxesMetrics {
  halfPeriodSeconds: number;
  earlyPeakX: number;
  earlyPeakZ: number;
  earlyPeakResultant: number;
  latePeakX: number;
  latePeakZ: number;
  latePeakResultant: number;
  overallPeakX: number;
  overallPeakZ: number;
  overallPeakResultant: number;
  peakAngleRadians: number;
  maxSuspensionErrorMeters: number;
  finiteAndBounded: boolean;
}

async function runSwingPump(
  halfPeriodSeconds: number,
  direction: PumpDirection,
): Promise<SwingAxesMetrics> {
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

  let motion: GantryMotionState = {
    x: { position: 0, velocity: 0 },
    z: { position: 0, velocity: 0 },
  };

  let earlyPeakX = 0;
  let earlyPeakZ = 0;
  let earlyPeakResultant = 0;
  let latePeakX = 0;
  let latePeakZ = 0;
  let latePeakResultant = 0;
  let overallPeakX = 0;
  let overallPeakZ = 0;
  let overallPeakResultant = 0;
  let peakAngleRadians = 0;
  let maxSuspensionErrorMeters = 0;
  let finiteAndBounded = true;

  const sample = (
    relativeX: number,
    relativeZ: number,
    phase: SamplePhase,
  ): void => {
    const amplitudeX = Math.abs(relativeX);
    const amplitudeZ = Math.abs(relativeZ);
    const resultant = Math.hypot(relativeX, relativeZ);

    if (phase === "early") {
      earlyPeakX = Math.max(earlyPeakX, amplitudeX);
      earlyPeakZ = Math.max(earlyPeakZ, amplitudeZ);
      earlyPeakResultant = Math.max(earlyPeakResultant, resultant);
    } else if (phase === "late") {
      latePeakX = Math.max(latePeakX, amplitudeX);
      latePeakZ = Math.max(latePeakZ, amplitudeZ);
      latePeakResultant = Math.max(latePeakResultant, resultant);
    }

    overallPeakX = Math.max(overallPeakX, amplitudeX);
    overallPeakZ = Math.max(overallPeakZ, amplitudeZ);
    overallPeakResultant = Math.max(overallPeakResultant, resultant);
  };

  const step = (
    inputScale: number,
    phase: SamplePhase,
  ): void => {
    motion = advanceGantryMotion(
      motion,
      direction.x * inputScale,
      direction.z * inputScale,
      motionConfig,
      dt,
    );
    carriage.setNextKinematicTranslation({
      x: motion.x.position,
      y: config.carriageY,
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
    const vertical = Math.max(1e-6, anchorY - next.y);
    const resultant = Math.hypot(relativeX, relativeZ);
    const angle = Math.atan2(resultant, vertical);
    const suspensionDistance = Math.hypot(
      next.x - motion.x.position,
      next.y - anchorY,
      next.z - motion.z.position,
    );

    sample(relativeX, relativeZ, phase);
    peakAngleRadians = Math.max(peakAngleRadians, angle);
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
      ].every(Number.isFinite) &&
      Math.abs(next.x) < 1 &&
      Math.abs(next.z) < 1 &&
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
  const segments = 12;

  for (let segment = 0; segment < segments; segment += 1) {
    const inputScale = segment % 2 === 0 ? 1 : -1;
    const phase: SamplePhase = segment < 4 ? "early" : "late";
    for (let tick = 0; tick < halfPeriodTicks; tick += 1) {
      step(inputScale, phase);
    }
  }

  for (let tick = 0; tick < Math.ceil(0.5 * PHYSICS_HZ); tick += 1) {
    step(0, "late");
  }

  return {
    halfPeriodSeconds,
    earlyPeakX,
    earlyPeakZ,
    earlyPeakResultant,
    latePeakX,
    latePeakZ,
    latePeakResultant,
    overallPeakX,
    overallPeakZ,
    overallPeakResultant,
    peakAngleRadians,
    maxSuspensionErrorMeters,
    finiteAndBounded,
  };
}

describe("M03 front/back and diagonal swing", () => {
  it("amplifies Z-axis front/back swing near resonance while off-cadence input decays", async () => {
    const resonant = await runSwingPump(0.4, { x: 0, z: 1 });
    const offCadence = await runSwingPump(0.3, { x: 0, z: 1 });

    console.log(
      "M03 front/back swing metrics",
      JSON.stringify({ resonant, offCadence }),
    );

    expect(resonant.finiteAndBounded).toBe(true);
    expect(offCadence.finiteAndBounded).toBe(true);
    expect(resonant.earlyPeakZ).toBeGreaterThan(0.015);
    expect(resonant.latePeakZ).toBeGreaterThan(
      resonant.earlyPeakZ * 1.1,
    );
    expect(resonant.latePeakZ).toBeGreaterThan(0.022);
    expect(resonant.overallPeakResultant).toBeLessThan(0.05);
    expect(resonant.peakAngleRadians).toBeLessThan(0.16);
    expect(resonant.overallPeakX).toBeLessThan(0.003);
    expect(resonant.maxSuspensionErrorMeters).toBeLessThan(0.002);
    expect(offCadence.latePeakZ).toBeLessThan(offCadence.earlyPeakZ);
  });

  it("builds bounded synchronized X/Z diagonal swing with both components active", async () => {
    const diagonal = await runSwingPump(0.4, { x: 1, z: 1 });

    console.log("M03 diagonal swing metrics", JSON.stringify(diagonal));

    expect(diagonal.finiteAndBounded).toBe(true);
    expect(diagonal.latePeakX).toBeGreaterThan(0.012);
    expect(diagonal.latePeakZ).toBeGreaterThan(0.012);
    expect(diagonal.latePeakResultant).toBeGreaterThan(0.018);
    expect(diagonal.overallPeakResultant).toBeLessThan(0.08);
    expect(diagonal.peakAngleRadians).toBeLessThan(0.22);
    expect(diagonal.maxSuspensionErrorMeters).toBeLessThan(0.002);

    const componentRatio =
      diagonal.latePeakX / Math.max(diagonal.latePeakZ, 1e-9);
    expect(componentRatio).toBeGreaterThan(0.75);
    expect(componentRatio).toBeLessThan(1.25);
  });
});
