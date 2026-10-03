import { describe, expect, it } from "vitest";
import {
  createCabinetLayout,
  parseCabinetLayoutSelection,
} from "./cabinetLayouts";

describe("M09 cabinet layout foundation", () => {
  it("parses supported layouts and falls back to loose", () => {
    expect(
      parseCabinetLayoutSelection("?layout=dense"),
    ).toEqual({
      id: "dense",
      usedFallback: false,
    });

    expect(
      parseCabinetLayoutSelection("?layout=unknown"),
    ).toEqual({
      id: "loose",
      usedFallback: true,
    });
  });

  it("is deterministic for a fixed seed", () => {
    const first = createCabinetLayout("loose", "fixed-seed");
    const second = createCabinetLayout("loose", "fixed-seed");
    expect(second).toEqual(first);
  });

  it("changes physical spawn poses when the seed changes", () => {
    const first = createCabinetLayout("dense", "seed-a");
    const second = createCabinetLayout("dense", "seed-b");

    expect(second.placements).not.toEqual(first.placements);
  });

  it("keeps loose layout at five prizes and dense layout denser", () => {
    expect(
      createCabinetLayout("loose", "count").placements,
    ).toHaveLength(5);
    expect(
      createCabinetLayout("dense", "count").placements.length,
    ).toBeGreaterThan(5);
  });

  it("keeps generated centers inside the current cabinet play envelope", () => {
    for (const id of ["loose", "dense"] as const) {
      for (const placement of createCabinetLayout(
        id,
        "bounds",
      ).placements) {
        expect(Math.abs(placement.x)).toBeLessThanOrEqual(0.265);
        expect(Math.abs(placement.z)).toBeLessThanOrEqual(0.195);
        expect(placement.yOffsetMeters).toBeGreaterThanOrEqual(0.002);
      }
    }
  });
});
