import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { M02_GANTRY_CONFIG } from "./gantryLab";
import {
  advanceGantryMotion,
  advanceGantryMotionTowardPosition,
  isGantryAxisAtTarget,
  type GantryMotionState,
} from "./gantryMotion";
import { advanceReel, type ReelState } from "./reelMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";

describe("M02 lift-to-home return", () => {
  it("physically lifts to the top then returns the carriage home without clearing residual swing", async () => {
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

    const applyBodiesAndStep = (): void => {
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
        Math.abs(nextPosition.z) < 1 &&
        nextPosition.y > 0.2 &&
        nextPosition.y < 1.2;
    };

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      applyBodiesAndStep();
    }

    for (let tick = 0; tick < Math.ceil(0.6 * PHYSICS_HZ); tick += 1) {
      motion = advanceGantryMotion(
        motion,
        1,
        -1,
        motionConfig,
        dt,
      );
      applyBodiesAndStep();
    }
    for (let tick = 0; tick < Math.ceil(0.25 * PHYSICS_HZ); tick += 1) {
      motion = advanceGantryMotion(
        motion,
        0,
        0,
        motionConfig,
        dt,
      );
      applyBodiesAndStep();
    }

    const offHomeDistance = Math.hypot(
      motion.x.position - config.homeX,
      motion.z.position - config.homeZ,
    );
    expect(offHomeDistance).toBeGreaterThan(0.1);

    let dropTicks = 0;
    while (
      dropTicks < PHYSICS_HZ * 4 &&
      !(
        reel.payout >= config.reelMaxPayout - 1e-5 &&
        Math.abs(reel.velocity) < 1e-4
      )
    ) {
      reel = advanceReel(reel, 1, reelConfig, dt);
      motion = advanceGantryMotion(motion, 0, 0, motionConfig, dt);
      applyBodiesAndStep();
      dropTicks += 1;
    }

    expect(reel.payout).toBeCloseTo(config.reelMaxPayout, 4);

    let liftTicks = 0;
    while (
      liftTicks < PHYSICS_HZ * 4 &&
      !(
        reel.payout <= config.reelMinPayout + 1e-5 &&
        Math.abs(reel.velocity) < 1e-4
      )
    ) {
      const nearTop = reel.payout < 0.07;
      reel = advanceReel(reel, -1, reelConfig, dt);
      motion = advanceGantryMotion(
        motion,
        nearTop ? 1 : 0,
        0,
        motionConfig,
        dt,
      );
      applyBodiesAndStep();
      liftTicks += 1;
    }

    expect(reel.payout).toBeCloseTo(config.reelMinPayout, 4);

    const returnStartMotion = {
      x: { ...motion.x },
      z: { ...motion.z },
    };
    const returnStartHub = hub.translation();
    const returnStartVelocity = hub.linvel();
    const returnStartRelativeOffset = Math.hypot(
      returnStartHub.x - motion.x.position,
      returnStartHub.z - motion.z.position,
    );
    const returnStartHorizontalSpeed = Math.hypot(
      returnStartVelocity.x,
      returnStartVelocity.z,
    );

    let maxCarriageStep = 0;
    let maxRelativeOffset = returnStartRelativeOffset;
    let returnTicks = 0;
    const tolerance = {
      position: config.homePositionTolerance,
      velocity: config.homeVelocityTolerance,
    };

    while (
      returnTicks < PHYSICS_HZ * 5 &&
      !(
        isGantryAxisAtTarget(motion.x, config.homeX, tolerance) &&
        isGantryAxisAtTarget(motion.z, config.homeZ, tolerance)
      )
    ) {
      const previousX = motion.x.position;
      const previousZ = motion.z.position;
      motion = advanceGantryMotionTowardPosition(
        motion,
        config.homeX,
        config.homeZ,
        motionConfig,
        dt,
      );

      maxCarriageStep = Math.max(
        maxCarriageStep,
        Math.hypot(
          motion.x.position - previousX,
          motion.z.position - previousZ,
        ),
      );

      applyBodiesAndStep();
      const position = hub.translation();
      maxRelativeOffset = Math.max(
        maxRelativeOffset,
        Math.hypot(
          position.x - motion.x.position,
          position.z - motion.z.position,
        ),
      );
      returnTicks += 1;
    }

    const homeError = Math.hypot(
      motion.x.position - config.homeX,
      motion.z.position - config.homeZ,
    );
    const returnDistance = Math.hypot(
      returnStartMotion.x.position - motion.x.position,
      returnStartMotion.z.position - motion.z.position,
    );
    const finalHub = hub.translation();
    const finalAnchor = reelAnchor.translation();
    const suspensionDistance = Math.hypot(
      finalHub.x - finalAnchor.x,
      finalHub.y - finalAnchor.y,
      finalHub.z - finalAnchor.z,
    );

    console.log("M02 home-return metrics", JSON.stringify({
      offHomeDistance,
      returnDistance,
      returnStartRelativeOffset,
      returnStartHorizontalSpeed,
      maxRelativeOffset,
      maxCarriageStep,
      homeError,
      finalVelocityX: motion.x.velocity,
      finalVelocityZ: motion.z.velocity,
      finalPayout: reel.payout,
      suspensionDistance,
      dropTicks,
      liftTicks,
      returnTicks,
      finiteAndBounded,
    }));

    expect(finiteAndBounded).toBe(true);
    expect(returnDistance).toBeGreaterThan(0.1);
    expect(maxCarriageStep).toBeLessThanOrEqual(
      Math.SQRT2 * config.maxSpeed * dt + 1e-9,
    );
    expect(returnStartRelativeOffset).toBeGreaterThan(0.0005);
    expect(maxRelativeOffset).toBeGreaterThan(0.0005);
    expect(homeError).toBeLessThanOrEqual(
      Math.SQRT2 * config.homePositionTolerance,
    );
    expect(Math.abs(motion.x.velocity)).toBeLessThanOrEqual(
      config.homeVelocityTolerance,
    );
    expect(Math.abs(motion.z.velocity)).toBeLessThanOrEqual(
      config.homeVelocityTolerance,
    );
    expect(reel.payout).toBeCloseTo(config.reelMinPayout, 4);
    expect(suspensionDistance).toBeCloseTo(config.suspensionLength, 2);
  });
});
