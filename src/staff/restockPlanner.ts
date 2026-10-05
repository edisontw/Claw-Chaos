import { createSeededRandom } from "../core/seededRng";

export const M10_RESTOCK_CONFIG = {
  insertionIntervalSeconds: 0.55,
  insertionX: 0.33,
  insertionMinY: 0.74,
  insertionMaxY: 0.90,
  insertionMinZ: -0.16,
  insertionMaxZ: 0.16,
  maxTiltRadians: 0.22,
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

  for (let index = 0; index < count; index += 1) {
    const poolIndex = Math.min(
      prizePool.length - 1,
      Math.floor(rng.next() * prizePool.length),
    );
    const prizeId = prizePool[poolIndex];
    if (prizeId === undefined) {
      throw new Error("Invalid restock prize pool");
    }

    plan.push({
      prizeId,
      x: M10_RESTOCK_CONFIG.insertionX,
      y: rng.range(
        M10_RESTOCK_CONFIG.insertionMinY,
        M10_RESTOCK_CONFIG.insertionMaxY,
      ),
      z: rng.range(
        M10_RESTOCK_CONFIG.insertionMinZ,
        M10_RESTOCK_CONFIG.insertionMaxZ,
      ),
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
