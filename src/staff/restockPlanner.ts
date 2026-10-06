import { createSeededRandom } from "../core/seededRng";

export const M10_RESTOCK_CONFIG = {
  insertionIntervalSeconds: 0.85,
  insertionMinX: -0.14,
  insertionMaxX: 0.08,
  insertionMinY: 0.39,
  insertionMaxY: 0.48,
  insertionMinZ: -0.18,
  insertionMaxZ: -0.02,
  maxTiltRadians: 0.10,
} as const;

export interface RestockPlacement {
  prizeId: string;
  x: number;
  y: number;
  z: number;
  rotationXRadians: number;
  rotationYRadians: number;
  variantSeed: string;
}

export function createRestockPlan(
  seed: string,
  count: number,
  prizePool: readonly string[],
): RestockPlacement[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(
      "Restock count must be a non-negative integer",
    );
  }
  if (count > 0 && prizePool.length === 0) {
    throw new Error(
      "Restock prize pool cannot be empty",
    );
  }

  const rng = createSeededRandom(
    "m10:restock:" + seed,
  );
  const plan: RestockPlacement[] = [];
  let cycle: string[] = [];

  const refillCycle = (): void => {
    cycle = [...prizePool];
    for (
      let index = cycle.length - 1;
      index > 0;
      index -= 1
    ) {
      const swapIndex = Math.min(
        index,
        Math.floor(rng.next() * (index + 1)),
      );
      [cycle[index], cycle[swapIndex]] = [
        cycle[swapIndex]!,
        cycle[index]!,
      ];
    }
  };

  for (let index = 0; index < count; index += 1) {
    if (cycle.length === 0) {
      refillCycle();
    }

    const prizeId = cycle.pop();
    if (prizeId === undefined) {
      throw new Error("Invalid restock prize pool");
    }

    const rollingPrize =
      prizeId === "prize/sphere_ball" ||
      prizeId === "prize/capsule_soft";
    const x = rollingPrize
      ? rng.range(-0.24, -0.15)
      : rng.range(
          M10_RESTOCK_CONFIG.insertionMinX,
          M10_RESTOCK_CONFIG.insertionMaxX,
        );
    const z = rollingPrize
      ? rng.range(-0.20, -0.10)
      : rng.range(
          M10_RESTOCK_CONFIG.insertionMinZ,
          M10_RESTOCK_CONFIG.insertionMaxZ,
        );

    plan.push({
      prizeId,
      x,
      y: rng.range(
        M10_RESTOCK_CONFIG.insertionMinY,
        M10_RESTOCK_CONFIG.insertionMaxY,
      ),
      z,
      rotationXRadians: rng.range(
        -M10_RESTOCK_CONFIG.maxTiltRadians,
        M10_RESTOCK_CONFIG.maxTiltRadians,
      ),
      rotationYRadians: rng.range(
        -Math.PI,
        Math.PI,
      ),
      variantSeed:
        "m10:restock:" + seed + ":" + index,
    });
  }

  return plan;
}
