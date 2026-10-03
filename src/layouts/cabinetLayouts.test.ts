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
      parseCabinetLayoutSelection("?layout=bridge"),
    ).toEqual({
      id: "bridge",
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
    for (const id of [
      "loose",
      "dense",
      "showcase",
      "bridge",
    ] as const) {
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

  it("keeps loose, dense, showcase, and bridge content contracts", () => {
    expect(
      createCabinetLayout("loose", "count").placements,
    ).toHaveLength(5);
    expect(
      createCabinetLayout("dense", "count").placements.length,
    ).toBeGreaterThan(5);
    expect(
      createCabinetLayout("showcase", "count").placements,
    ).toHaveLength(6);
    expect(
      createCabinetLayout("bridge", "count").placements,
    ).toHaveLength(5);
  });

  it("builds bridge from two dynamic supports and one elevated flat-box beam", () => {
    const layout = createCabinetLayout(
      "bridge",
      "bridge-structure",
    );
    const supports = layout.placements.filter(
      (placement) => placement.role === "support",
    );
    const beam = layout.placements.find(
      (placement) => placement.role === "bridge",
    );

    expect(supports).toHaveLength(2);
    expect(
      supports.every(
        (placement) =>
          placement.prizeId === "prize/box_standard",
      ),
    ).toBe(true);
    expect(beam?.prizeId).toBe("prize/box_flat");
    expect(beam?.yOffsetMeters).toBe(0.087);
    expect(supports[0]!.x).toBeLessThan(-0.085);
    expect(supports[1]!.x).toBeGreaterThan(0.085);
  });

  it("keeps structural bridge seed jitter small enough to preserve the initial span", () => {
    const layout = createCabinetLayout(
      "bridge",
      "bridge-jitter",
    );
    const beam = layout.placements.find(
      (placement) => placement.role === "bridge",
    );
    const supports = layout.placements.filter(
      (placement) => placement.role === "support",
    );

    expect(beam).toBeDefined();
    expect(Math.abs(beam!.x)).toBeLessThanOrEqual(0.0015);
    expect(
      Math.abs(beam!.rotationYRadians),
    ).toBeLessThanOrEqual(0.012);
    expect(
      Math.abs(supports[0]!.x + 0.09),
    ).toBeLessThanOrEqual(0.0015);
    expect(
      Math.abs(supports[1]!.x - 0.09),
    ).toBeLessThanOrEqual(0.0015);
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
    for (const id of [
      "loose",
      "dense",
      "showcase",
      "bridge",
    ] as const) {
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
