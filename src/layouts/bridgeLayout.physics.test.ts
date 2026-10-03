import { describe, expect, it } from "vitest";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createPrize } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";
import { createCabinetLayout } from "./cabinetLayouts";

function quaternionAngularDistance(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
): number {
  const dot = Math.abs(
    a.x * b.x +
      a.y * b.y +
      a.z * b.z +
      a.w * b.w,
  );
  return 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
}

describe("M09 bridge layout physics", () => {
  it("settles as a supported dynamic bridge and remains physically movable", async () => {
    const physics = await PhysicsRuntime.create();

    physics.createStaticCuboid(
      { x: 0, y: -0.02, z: 0 },
      { x: 0.45, y: 0.02, z: 0.32 },
      0.85,
    );

    const layout = createCabinetLayout(
      "bridge",
      "physics-regression",
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
            rotationYRadians: placement.rotationYRadians,
            variantSeed: placement.variantSeed,
          },
        ),
      };
    });

    for (let tick = 0; tick < 360; tick += 1) {
      physics.step();
    }

    const beam = spawned.find(
      (entry) => entry.placement.role === "bridge",
    );
    const supports = spawned.filter(
      (entry) => entry.placement.role === "support",
    );

    expect(beam).toBeDefined();
    expect(supports).toHaveLength(2);

    const settledBeamPosition =
      beam!.prize.body.translation();
    const settledBeamRotation =
      beam!.prize.body.rotation();

    expect(settledBeamPosition.y).toBeGreaterThan(0.095);
    expect(
      supports.every(
        ({ prize }) =>
          prize.body.translation().y > 0.035 &&
          prize.body.translation().y < 0.050,
      ),
    ).toBe(true);

    for (let nudge = 0; nudge < 3; nudge += 1) {
      const current = beam!.prize.body.translation();
      beam!.prize.body.applyImpulseAtPoint(
        { x: 0.018, y: 0, z: 0 },
        {
          x: current.x,
          y: current.y,
          z: current.z + 0.045,
        },
        true,
      );

      for (let tick = 0; tick < 60; tick += 1) {
        physics.step();
      }
    }

    for (let tick = 0; tick < 120; tick += 1) {
      physics.step();
    }

    const movedPosition = beam!.prize.body.translation();
    const movedRotation = beam!.prize.body.rotation();
    const horizontalTravel = Math.hypot(
      movedPosition.x - settledBeamPosition.x,
      movedPosition.z - settledBeamPosition.z,
    );
    const rotationTravel = quaternionAngularDistance(
      settledBeamRotation,
      movedRotation,
    );

    console.log(
      "M09 bridge manipulation",
      JSON.stringify({
        settledHeightMeters: settledBeamPosition.y,
        horizontalTravelMeters: horizontalTravel,
        rotationTravelRadians: rotationTravel,
      }),
    );

    expect(horizontalTravel).toBeGreaterThan(0.012);
    expect(rotationTravel).toBeGreaterThan(0.02);
  });
});
