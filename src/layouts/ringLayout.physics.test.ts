import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createPrize } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";
import {
  createRingLoopGeometry,
  RING_LOOP_PROFILE,
} from "../prizes/ringProfile";
import { createCabinetLayout } from "./cabinetLayouts";

function ringTiltRadians(rotation: {
  x: number;
  y: number;
  z: number;
  w: number;
}): number {
  const localUpWorldY =
    1 - 2 * (rotation.x ** 2 + rotation.z ** 2);
  return Math.acos(
    Math.min(1, Math.max(0, Math.abs(localUpWorldY))),
  );
}

function rotateLocalPoint(
  point: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number } {
  const { x, y, z, w } = rotation;
  return {
    x:
      (1 - 2 * (y * y + z * z)) * point.x +
      2 * (x * y - z * w) * point.y +
      2 * (x * z + y * w) * point.z,
    y:
      2 * (x * y + z * w) * point.x +
      (1 - 2 * (x * x + z * z)) * point.y +
      2 * (y * z - x * w) * point.z,
    z:
      2 * (x * z - y * w) * point.x +
      2 * (y * z + x * w) * point.y +
      (1 - 2 * (x * x + y * y)) * point.z,
  };
}

describe("M09 ring hook physics", () => {
  it("allows a finger-sized probe through the true center opening", async () => {
    const physics = await PhysicsRuntime.create();

    physics.createStaticCuboid(
      { x: 0, y: -0.02, z: 0 },
      { x: 0.35, y: 0.02, z: 0.30 },
      0.82,
    );

    const definition = getPrizeDefinition("prize/ring_loop");
    const ring = createPrize(
      physics,
      definition,
      {
        position: {
          x: 0,
          y: definition.dimensions.y * 0.5 + 0.002,
          z: 0,
        },
        rotationYRadians: 0,
        variantSeed: "ring-hole-physics",
      },
    );

    physics.createKinematicCylinder(
      { x: 0, y: 0.060, z: 0 },
      0.055,
      0.009,
      0.55,
    );

    for (let tick = 0; tick < PHYSICS_HZ * 2; tick += 1) {
      physics.step();
    }

    const settled = ring.body.translation();
    const centeredOffset = Math.hypot(settled.x, settled.z);

    console.log(
      "M09 ring hole",
      JSON.stringify({
        centeredOffsetMeters: centeredOffset,
        settledHeightMeters: settled.y,
      }),
    );

    expect(centeredOffset).toBeLessThan(0.004);
    expect(settled.y).toBeGreaterThan(0.008);
    expect(settled.y).toBeLessThan(0.018);
  });

  it("production ring layout settles tilted with real under-rim clearance", async () => {
    const physics = await PhysicsRuntime.create();

    physics.createStaticCuboid(
      { x: 0, y: -0.02, z: 0 },
      { x: 0.45, y: 0.02, z: 0.32 },
      0.85,
    );

    const layout = createCabinetLayout(
      "ring",
      "grabbable-physics",
    );
    const spawned = layout.placements.map((placement) => {
      const definition = getPrizeDefinition(placement.prizeId);
      return {
        placement,
        prize: createPrize(
          physics,
          definition,
          {
            position: {
              x: placement.x,
              y:
                definition.dimensions.y * 0.5 +
                placement.yOffsetMeters,
              z: placement.z,
            },
            rotationXRadians: placement.rotationXRadians,
            rotationYRadians: placement.rotationYRadians,
            variantSeed: placement.variantSeed,
          },
        ),
      };
    });

    for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
      physics.step();
    }

    const targets = spawned.filter(
      (entry) => entry.placement.role === "ring_target",
    );
    const supports = spawned.filter(
      (entry) => entry.placement.role === "ring_support",
    );

    expect(targets).toHaveLength(2);
    expect(supports).toHaveLength(2);

    const geometry = createRingLoopGeometry();
    const metrics = targets.map(({ prize }) => {
      const position = prize.body.translation();
      const rotation = prize.body.rotation();
      const worldPoints = geometry.points.map((point) => {
        const rotated = rotateLocalPoint(point, rotation);
        return {
          x: position.x + rotated.x,
          y: position.y + rotated.y,
          z: position.z + rotated.z,
        };
      });
      const highestPoint = worldPoints.reduce(
        (highest, point) =>
          point.y > highest.y ? point : highest,
      );
      const lowestCenterline = Math.min(
        ...worldPoints.map((point) => point.y),
      );
      const highRimUnderside =
        highestPoint.y - RING_LOOP_PROFILE.tubeRadius;

      return {
        centerHeightMeters: position.y,
        tiltRadians: ringTiltRadians(rotation),
        highestCenterlineMeters: highestPoint.y,
        lowestCenterlineMeters: lowestCenterline,
        highRimUndersideMeters: highRimUnderside,
        highestPoint,
      };
    });

    console.log(
      "M09 grabbable ring settle",
      JSON.stringify(metrics),
    );

    for (const metric of metrics) {
      expect(metric.centerHeightMeters).toBeGreaterThan(0.025);
      expect(metric.tiltRadians).toBeGreaterThan(0.30);
      expect(metric.highRimUndersideMeters).toBeGreaterThan(0.035);
      expect(metric.lowestCenterlineMeters).toBeGreaterThan(0);
    }

    expect(
      supports.every(({ prize }) => {
        const y = prize.body.translation().y;
        return y > 0.035 && y < 0.050;
      }),
    ).toBe(true);

    // Use a small kinematic pad under the elevated inner rim to prove
    // that a claw-finger-sized hook has physical access and can lift.
    const hookTarget = targets[0]!;
    const hookMetric = metrics[0]!;
    const beforeLiftY = hookTarget.prize.body.translation().y;
    const hookHalfY = 0.004;
    const hookStartY =
      hookMetric.highRimUndersideMeters - hookHalfY - 0.002;
    const hook = physics.createKinematicCuboid(
      {
        x: hookMetric.highestPoint.x,
        y: hookStartY,
        z: hookMetric.highestPoint.z,
      },
      { x: 0.008, y: hookHalfY, z: 0.008 },
      0.85,
    );

    const liftMeters = 0.050;
    const liftTicks = 72;
    for (let tick = 1; tick <= liftTicks; tick += 1) {
      hook.setNextKinematicTranslation({
        x: hookMetric.highestPoint.x,
        y: hookStartY + liftMeters * (tick / liftTicks),
        z: hookMetric.highestPoint.z,
      });
      physics.step();
    }

    const afterLiftY = hookTarget.prize.body.translation().y;
    const ringLiftMeters = afterLiftY - beforeLiftY;

    console.log(
      "M09 ring hook lift",
      JSON.stringify({
        beforeLiftY,
        afterLiftY,
        ringLiftMeters,
        hookStartY,
        liftMeters,
      }),
    );

    expect(ringLiftMeters).toBeGreaterThan(0.012);
  });
});
