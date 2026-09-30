import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  M02_GANTRY_CONFIG,
  evaluatePt006Swing,
  type Pt006Metrics,
} from "./gantryLab";
import { advanceGantryAxis } from "./gantryMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

describe("PT-006 swing from braking", () => {
  it("produces inertial lag and forward swing from physical suspension", async () => {
    const config = M02_GANTRY_CONFIG;
    const physics = await PhysicsRuntime.create();
    const dt = 1 / PHYSICS_HZ;

    const carriage = physics.createKinematicCuboid(
      { x: 0, y: config.carriageY, z: 0 },
      {
        x: config.carriageHalfX,
        y: config.carriageHalfY,
        z: config.carriageHalfZ,
      },
    );

    const anchorY = config.carriageY - config.carriageHalfY;
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

    const setCarriageAndStabilize = (): void => {
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
    };

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      setCarriageAndStabilize();
      physics.step();
    }

    let minimumRelativeX = 0;
    let maximumRelativeX = 0;
    let peakSwingAngle = 0;
    let finiteAndBounded = true;

    const sample = (): void => {
      const position = hub.translation();
      const rotation = hub.rotation();
      const relativeX = position.x - gantry.position;
      const vertical = Math.max(1e-6, anchorY - position.y);
      const swingAngle = Math.atan2(Math.abs(relativeX), vertical);

      minimumRelativeX = Math.min(minimumRelativeX, relativeX);
      maximumRelativeX = Math.max(maximumRelativeX, relativeX);
      peakSwingAngle = Math.max(peakSwingAngle, swingAngle);

      finiteAndBounded =
        finiteAndBounded &&
        [
          position.x,
          position.y,
          position.z,
          rotation.x,
          rotation.y,
          rotation.z,
          rotation.w,
        ].every(Number.isFinite) &&
        Math.abs(position.x) < 1 &&
        position.y > 0.2 &&
        position.y < 1.2;
    };

    const accelerationTicks = Math.ceil(
      config.pt006AccelerationSeconds * PHYSICS_HZ,
    );
    for (let tick = 0; tick < accelerationTicks; tick += 1) {
      gantry = advanceGantryAxis(gantry, 1, axisConfig, dt);
      setCarriageAndStabilize();
      physics.step();
      sample();
    }

    const lagMeters = Math.abs(Math.min(0, minimumRelativeX));
    maximumRelativeX = 0;
    peakSwingAngle = 0;

    const brakingTicks = Math.ceil(
      config.pt006BrakeObservationSeconds * PHYSICS_HZ,
    );
    for (let tick = 0; tick < brakingTicks; tick += 1) {
      gantry = advanceGantryAxis(gantry, 0, axisConfig, dt);
      setCarriageAndStabilize();
      physics.step();
      sample();
    }

    const finalHub = hub.translation();
    const metrics: Pt006Metrics = {
      lagMeters,
      forwardSwingMeters: Math.max(0, maximumRelativeX),
      peakSwingAngleRadians: peakSwingAngle,
      residualOffsetMeters: Math.hypot(
        finalHub.x - gantry.position,
        finalHub.z,
      ),
    };

    const suspensionDistance = Math.hypot(
      finalHub.x - gantry.position,
      anchorY - finalHub.y,
      finalHub.z,
    );

    console.log("PT-006 metrics", JSON.stringify({
      ...metrics,
      carriageX: gantry.position,
      carriageVelocityX: gantry.velocity,
      suspensionDistance,
      finiteAndBounded,
    }));

    expect(finiteAndBounded).toBe(true);
    expect(gantry.velocity).toBeCloseTo(0, 8);
    expect(suspensionDistance).toBeCloseTo(config.suspensionLength, 2);
    expect(metrics.lagMeters).toBeGreaterThanOrEqual(
      config.pt006MinLagMeters,
    );
    expect(metrics.lagMeters).toBeLessThanOrEqual(
      config.pt006MaxLagMeters,
    );
    expect(metrics.forwardSwingMeters).toBeGreaterThanOrEqual(
      config.pt006MinForwardSwingMeters,
    );
    expect(metrics.forwardSwingMeters).toBeLessThanOrEqual(
      config.pt006MaxForwardSwingMeters,
    );
    expect(metrics.peakSwingAngleRadians).toBeGreaterThanOrEqual(
      config.pt006MinSwingAngleRadians,
    );
    expect(metrics.peakSwingAngleRadians).toBeLessThanOrEqual(
      config.pt006MaxSwingAngleRadians,
    );
    expect(metrics.residualOffsetMeters).toBeLessThanOrEqual(
      config.pt006MaxResidualOffsetMeters,
    );
    expect(evaluatePt006Swing(metrics)).toBe(true);
  });
});
