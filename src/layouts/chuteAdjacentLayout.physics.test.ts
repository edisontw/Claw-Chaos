import { describe, expect, it } from "vitest";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "../cabinet/cabinetGeometry";
import { ChuteSensor } from "../cabinet/chuteSensor";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createPrize } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";
import { createCabinetLayout } from "./cabinetLayouts";

interface ChuteNudgeResult {
  prizeId: string;
  settledX: number;
  settledY: number;
  settledZ: number;
  initialWin: boolean;
  enteredChute: boolean;
  entryTick: number | null;
  entryX: number | null;
  entryY: number | null;
  entryZ: number | null;
}

async function runChuteNudge(
  prizeId: "prize/sphere_ball" | "prize/cube_small",
  impulse: { x: number; y: number; z: number },
  pointOffset?: { x: number; y: number; z: number },
): Promise<ChuteNudgeResult> {
  const physics = await PhysicsRuntime.create();
  createCabinetPhysics(physics);

  const layout = createCabinetLayout(
    "chute",
    "physics-regression",
  );
  const placement = layout.placements.find(
    (candidate) =>
      candidate.role === "chute_target" &&
      candidate.prizeId === prizeId,
  );
  expect(placement).toBeDefined();

  const definition = getPrizeDefinition(prizeId);
  const prize = createPrize(
    physics,
    definition,
    {
      position: {
        x: placement!.x,
        y:
          M06_CABINET_CONFIG.playDeckY +
          definition.dimensions.y * 0.5 +
          placement!.yOffsetMeters,
        z: placement!.z,
      },
      rotationYRadians: placement!.rotationYRadians,
      variantSeed: placement!.variantSeed,
    },
  );

  const sensor = new ChuteSensor();

  for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
    physics.step();
  }

  const settled = prize.body.translation();
  const initialWin =
    sensor.pollPrize(prizeId, prize.body) !== null;

  if (pointOffset) {
    prize.body.applyImpulseAtPoint(
      impulse,
      {
        x: settled.x + pointOffset.x,
        y: settled.y + pointOffset.y,
        z: settled.z + pointOffset.z,
      },
      true,
    );
  } else {
    prize.body.applyImpulse(impulse, true);
  }

  let entryTick: number | null = null;
  let entryPosition:
    | { x: number; y: number; z: number }
    | null = null;

  for (let tick = 1; tick <= PHYSICS_HZ * 5; tick += 1) {
    physics.step();
    if (sensor.pollPrize(prizeId, prize.body)) {
      entryTick = tick;
      entryPosition = prize.body.translation();
      break;
    }
  }

  return {
    prizeId,
    settledX: settled.x,
    settledY: settled.y,
    settledZ: settled.z,
    initialWin,
    enteredChute: entryTick !== null,
    entryTick,
    entryX: entryPosition?.x ?? null,
    entryY: entryPosition?.y ?? null,
    entryZ: entryPosition?.z ?? null,
  };
}

describe("M09 chute-adjacent layout physics", () => {
  it("starts outside the chute sensor and can be physically nudged into the opening", async () => {
    const ball = await runChuteNudge(
      "prize/sphere_ball",
      { x: -0.030, y: 0, z: 0 },
    );
    const cube = await runChuteNudge(
      "prize/cube_small",
      { x: 0, y: 0, z: 0.035 },
      { x: 0, y: 0.040, z: -0.030 },
    );

    console.log(
      "M09 chute-adjacent manipulation",
      JSON.stringify({ ball, cube }),
    );

    for (const result of [ball, cube]) {
      expect(result.initialWin).toBe(false);
      expect(result.settledY).toBeGreaterThan(
        M06_CABINET_CONFIG.playDeckY + 0.035,
      );
      expect(result.enteredChute).toBe(true);
      expect(result.entryY).not.toBeNull();
      expect(result.entryY!).toBeLessThan(
        M06_CABINET_CONFIG.playDeckY - 0.05,
      );
    }
  }, 15_000);
});
