import { describe, expect, it } from "vitest";
import {
  M10_RESTOCK_CONFIG,
  createRestockPlan,
} from "./restockPlanner";

describe("M10 seeded restock planning", () => {
  const pool = [
    "prize/cube_small",
    "prize/teddy_simple",
    "prize/pillow_small",
  ] as const;

  it("is deterministic for a fixed seed", () => {
    expect(
      createRestockPlan("same", 6, pool),
    ).toEqual(
      createRestockPlan("same", 6, pool),
    );
  });

  it("uses every pool prize before repeating a type", () => {
    const plan = createRestockPlan(
      "variety",
      pool.length,
      pool,
    );

    expect(
      new Set(plan.map((entry) => entry.prizeId)).size,
    ).toBe(pool.length);
  });

  it("changes physical insertion poses across seeds", () => {
    const a = createRestockPlan("seed-a", 6, pool);
    const b = createRestockPlan("seed-b", 6, pool);

    expect(a).not.toEqual(b);
    expect(
      a.some(
        (entry, index) =>
          entry.z !== b[index]?.z ||
          entry.rotationYRadians !==
            b[index]?.rotationYRadians,
      ),
    ).toBe(true);
  });

  it("keeps insertion inside a low-energy interior staging zone away from the open service door and chute", () => {
    const plan = createRestockPlan(
      "bounds",
      20,
      pool,
    );

    for (const entry of plan) {
      expect(entry.x).toBeGreaterThanOrEqual(-0.24);
      expect(entry.x).toBeLessThan(0.25);
      expect(entry.y).toBeGreaterThanOrEqual(
        M10_RESTOCK_CONFIG.insertionMinY,
      );
      expect(entry.y).toBeLessThanOrEqual(
        M10_RESTOCK_CONFIG.insertionMaxY,
      );
      expect(entry.z).toBeGreaterThanOrEqual(
        M10_RESTOCK_CONFIG.insertionMinZ,
      );
      expect(entry.z).toBeLessThanOrEqual(
        M10_RESTOCK_CONFIG.insertionMaxZ,
      );
    }
  });

  it("rejects impossible plans", () => {
    expect(
      () => createRestockPlan("bad", -1, pool),
    ).toThrow();
    expect(
      () => createRestockPlan("bad", 1, []),
    ).toThrow();
  });
});
