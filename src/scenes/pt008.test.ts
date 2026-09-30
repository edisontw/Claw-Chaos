import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  M02_GANTRY_CONFIG,
  evaluatePt008Momentum,
  type Pt008Metrics,
} from "./gantryLab";
import { advanceGantryAxis } from "./gantryMotion";
import { advanceReel } from "./reelMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

describe("PT-008 momentum during descent", () => {
  it("keeps horizontal momentum while the reel lowers and lifts physically", async () => {
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

    const axisConfig = {
      minPosition: config.xMin,
      maxPosition: config.xMax,
      maxSpeed: config.maxSpeed,
      acceleration: config.acceleration,
      braking: config.braking,
    };
    const reelConfig = {
      minPayout: config.reelMinPayout,
      maxPayout: config.reelMaxPayout,
      maxSpeed: config.reelMaxSpeed,
      acceleration: config.reelAcceleration,
      braking: config.reelBraking,
    };

    let gantry = { position: 0, velocity: 0 };
    let reel = { payout: 0, velocity: 0 };
    let finiteAndBounded = true;

    const step = (gantryCommand: number, reelCommand: number): void => {
      gantry = advanceGantryAxis(gantry, gantryCommand, axisConfig, dt);
      reel = advanceReel(reel, reelCommand, reelConfig, dt);

      carriage.setNextKinematicTranslation({
        x: gantry.position,
        y: config.carriageY,
        z: 0,
      });
      reelAnchor.setNextKinematicTranslation({
        x: gantry.position,
        y: anchorY - reel.payout,
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

      const nextPosition = hub.translation();
      const rotation = hub.rotation();
      finiteAndBounded =
        finiteAndBounded &&
        [
          nextPosition.x,
          nextPosition.y,
          nextPosition.z,
          rotation.x,
          rotation.y,
          rotation.z,
          rotation.w,
        ].every(Number.isFinite) &&
        Math.abs(nextPosition.x) < 1 &&
        nextPosition.y > 0.2 &&
        nextPosition.y < 1.2;
    };

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      step(0, 0);
    }

    const accelerationTicks = Math.ceil(
      config.pt008AccelerationSeconds * PHYSICS_HZ,
    );
    for (let tick = 0; tick < accelerationTicks; tick += 1) {
      step(1, 0);
    }

    const brakingTicks = Math.ceil(
      config.pt008BrakeLeadSeconds * PHYSICS_HZ,
    );
    for (let tick = 0; tick < brakingTicks; tick += 1) {
      step(0, 0);
    }

    const dropStartPosition = hub.translation();
    const dropStartVelocity = hub.linvel();
    const dropStartSpeed = Math.hypot(
      dropStartVelocity.x,
      dropStartVelocity.z,
    );
    let firstDropTickSpeed = 0;
    let maxHorizontalOffset = Math.hypot(
      dropStartPosition.x - gantry.position,
      dropStartPosition.z,
    );
    let minHubY = dropStartPosition.y;
    let dropTicks = 0;

    while (
      dropTicks < PHYSICS_HZ * 4 &&
      !(
        reel.payout >= config.reelMaxPayout - 1e-5 &&
        Math.abs(reel.velocity) < 1e-4
      )
    ) {
      step(0, 1);
      dropTicks += 1;

      const position = hub.translation();
      const velocity = hub.linvel();
      if (dropTicks === 1) {
        firstDropTickSpeed = Math.hypot(velocity.x, velocity.z);
      }
      minHubY = Math.min(minHubY, position.y);
      maxHorizontalOffset = Math.max(
        maxHorizontalOffset,
        Math.hypot(position.x - gantry.position, position.z),
      );
    }

    const metrics: Pt008Metrics = {
      descentMeters: dropStartPosition.y - minHubY,
      maxHorizontalOffsetMeters: maxHorizontalOffset,
      velocityRetentionRatio:
        dropStartSpeed > 1e-6 ? firstDropTickSpeed / dropStartSpeed : 0,
    };

    const bottomHubY = hub.translation().y;
    const bottomPayout = reel.payout;

    let liftTicks = 0;
    while (
      liftTicks < PHYSICS_HZ * 4 &&
      !(
        reel.payout <= config.reelMinPayout + 1e-5 &&
        Math.abs(reel.velocity) < 1e-4
      )
    ) {
      step(0, -1);
      liftTicks += 1;
    }

    const finalHub = hub.translation();
    const reelAnchorPosition = reelAnchor.translation();
    const suspensionDistance = Math.hypot(
      finalHub.x - reelAnchorPosition.x,
      finalHub.y - reelAnchorPosition.y,
      finalHub.z - reelAnchorPosition.z,
    );

    console.log("PT-008 metrics", JSON.stringify({
      ...metrics,
      dropStartSpeed,
      firstDropTickSpeed,
      bottomPayout,
      bottomHubY,
      finalHubY: finalHub.y,
      finalPayout: reel.payout,
      liftMeters: finalHub.y - bottomHubY,
      suspensionDistance,
      dropTicks,
      liftTicks,
      finiteAndBounded,
    }));

    expect(finiteAndBounded).toBe(true);
    expect(dropStartSpeed).toBeGreaterThan(1e-4);
    expect(metrics.descentMeters).toBeGreaterThanOrEqual(
      config.pt008MinDescentMeters,
    );
    expect(metrics.maxHorizontalOffsetMeters).toBeGreaterThanOrEqual(
      config.pt008MinHorizontalOffsetMeters,
    );
    expect(metrics.velocityRetentionRatio).toBeGreaterThanOrEqual(
      config.pt008MinVelocityRetentionRatio,
    );
    expect(evaluatePt008Momentum(metrics)).toBe(true);

    expect(bottomPayout).toBeCloseTo(config.reelMaxPayout, 4);
    expect(reel.payout).toBeCloseTo(config.reelMinPayout, 4);
    expect(finalHub.y - bottomHubY).toBeGreaterThan(0.2);
    expect(suspensionDistance).toBeCloseTo(config.suspensionLength, 2);
  });
});
