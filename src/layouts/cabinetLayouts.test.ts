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
      parseCabinetLayoutSelection("?layout=showcase"),
    ).toEqual({
      id: "showcase",
      usedFallback: false,
    });

    expect(
      parseCabinetLayoutSelection("?layout=unknown"),
    ).toEqual({
      id: "loose",
      usedFallback: true,
    });
  });

  it("is deterministic for a fixed seed across every implemented layout", () => {
    for (const id of ["loose", "dense", "showcase"] as const) {
      const first = createCabinetLayout(id, "fixed-seed");
      const second = createCabinetLayout(id, "fixed-seed");
      expect(second).toEqual(first);
    }
  });

  it("changes physical spawn poses when the seed changes", () => {
    const first = createCabinetLayout("dense", "seed-a");
    const second = createCabinetLayout("dense", "seed-b");

    expect(second.placements).not.toEqual(first.placements);
  });

  it("keeps loose, dense, and showcase content contracts", () => {
    expect(
      createCabinetLayout("loose", "count").placements,
    ).toHaveLength(5);
    expect(
      createCabinetLayout("dense", "count").placements.length,
    ).toBeGreaterThan(5);
    expect(
      createCabinetLayout("showcase", "count").placements,
    ).toHaveLength(6);
  });

  it("showcase exposes representative rigid and soft prize families", () => {
    const prizeIds = createCabinetLayout(
      "showcase",
      "families",
    ).placements.map((placement) => placement.prizeId);

    expect(prizeIds).toEqual([
      "prize/box_standard",
      "prize/sphere_ball",
      "prize/cylinder_can",
      "prize/teddy_simple",
      "prize/pillow_small",
      "prize/animal_simple",
    ]);
  });

  it("keeps showcase in two separated display rows with only subtle jitter", () => {
    const layout = createCabinetLayout(
      "showcase",
      "showcase-bounds",
    );
    const front = layout.placements.slice(0, 3);
    const rear = layout.placements.slice(3);

    expect(front[0]!.x).toBeLessThan(-0.21);
    expect(front[2]!.x).toBeGreaterThan(0.21);
    expect(rear[0]!.x).toBeLessThan(-0.21);
    expect(rear[2]!.x).toBeGreaterThan(0.21);

    for (const placement of front) {
      expect(placement.z).toBeLessThan(-0.10);
      expect(placement.yOffsetMeters).toBe(0.002);
    }
    for (const placement of rear) {
      expect(placement.z).toBeGreaterThan(0.09);
      expect(placement.yOffsetMeters).toBe(0.002);
    }
  });

  it("keeps generated centers inside the current cabinet play envelope", () => {
    for (const id of ["loose", "dense", "showcase"] as const) {
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
