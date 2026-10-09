import { describe, expect, it } from "vitest";
import {
  createCabinetLayout,
  parseCabinetLayoutSelection,
} from "./cabinetLayouts";

describe("M09 cabinet layout foundation", () => {
  it("parses supported layouts and uses stocked as the player-facing default", () => {
    expect(
      parseCabinetLayoutSelection(""),
    ).toEqual({
      id: "stocked",
      usedFallback: false,
    });

    expect(
      parseCabinetLayoutSelection("?layout=stocked"),
    ).toEqual({
      id: "stocked",
      usedFallback: false,
    });
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
      parseCabinetLayoutSelection("?layout=edge"),
    ).toEqual({
      id: "edge",
      usedFallback: false,
    });

    expect(
      parseCabinetLayoutSelection("?layout=ring"),
    ).toEqual({
      id: "ring",
      usedFallback: false,
    });

    expect(
      parseCabinetLayoutSelection("?layout=chute"),
    ).toEqual({
      id: "chute",
      usedFallback: false,
    });

    expect(
      parseCabinetLayoutSelection("?layout=unknown"),
    ).toEqual({
      id: "stocked",
      usedFallback: true,
    });
  });

  it("is deterministic for a fixed seed across every implemented layout", () => {
    for (const id of [
      "stocked",
      "loose",
      "dense",
      "showcase",
      "bridge",
      "edge",
      "ring",
      "chute",
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

  it("keeps all implemented layout content contracts", () => {
    expect(
      createCabinetLayout("stocked", "count").placements.length,
    ).toBeGreaterThanOrEqual(12);
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
    expect(
      createCabinetLayout("edge", "count").placements,
    ).toHaveLength(5);
    expect(
      createCabinetLayout("ring", "count").placements,
    ).toHaveLength(5);
    expect(
      createCabinetLayout("chute", "count").placements,
    ).toHaveLength(4);
  });

  it("merchandises the default machine with mostly dolls and no naked test geometry", () => {
    const stock = createCabinetLayout("stocked", "merchandise").placements;
    const dolls = stock.filter(
      (entry) => entry.prizeId === "prize/teddy_simple" ||
        entry.prizeId === "prize/animal_simple",
    );
    expect(stock).toHaveLength(11);
    expect(dolls.length).toBeGreaterThanOrEqual(8);
    expect(
      stock.every((entry) => ![
        "prize/cube_small", "prize/sphere_ball",
        "prize/capsule_soft", "prize/cylinder_can",
      ].includes(entry.prizeId)),
    ).toBe(true);
    // No floating exhibition stack on the public-facing default.
    expect(stock.every((entry) => entry.yOffsetMeters < 0.008)).toBe(true);
    // Front-left chute stays open. A mid/front center prize is still playable.
    expect(stock.some((entry) => entry.z > 0.10 && entry.x > 0)).toBe(true);
  });

  it("creates two tilted hollow ring targets with dedicated dynamic supports", () => {
    const layout = createCabinetLayout(
      "ring",
      "ring-structure",
    );
    const targets = layout.placements.filter(
      (placement) => placement.role === "ring_target",
    );

    expect(targets).toHaveLength(2);
    expect(
      targets.every(
        (placement) =>
          placement.prizeId === "prize/ring_loop",
      ),
    ).toBe(true);
    const supports = layout.placements.filter(
      (placement) => placement.role === "ring_support",
    );

    expect(supports).toHaveLength(2);
    expect(
      supports.every(
        (placement) =>
          placement.prizeId === "prize/cube_small",
      ),
    ).toBe(true);
    expect(targets[0]!.x).toBeLessThan(-0.15);
    expect(targets[1]!.x).toBeGreaterThan(0.15);
    expect(targets[0]!.rotationXRadians).toBeCloseTo(0.52, 8);
    expect(targets[1]!.rotationXRadians).toBeCloseTo(-0.52, 8);
    expect(targets[0]!.yOffsetMeters).toBeCloseTo(0.030, 6);
    expect(targets[1]!.yOffsetMeters).toBeCloseTo(0.030, 6);

    const leftSupport = supports.find(
      (placement) => placement.x < 0,
    )!;
    const rightSupport = supports.find(
      (placement) => placement.x > 0,
    )!;
    expect(leftSupport.z).toBeLessThan(-0.13);
    expect(rightSupport.z).toBeGreaterThan(0.13);
  });

  it("keeps ring seed jitter small enough to preserve clear hole access", () => {
    const layout = createCabinetLayout(
      "ring",
      "ring-jitter",
    );
    const targets = layout.placements.filter(
      (placement) => placement.role === "ring_target",
    );

    expect(
      Math.abs(targets[0]!.x + 0.16),
    ).toBeLessThanOrEqual(0.0015);
    expect(
      Math.abs(targets[1]!.x - 0.16),
    ).toBeLessThanOrEqual(0.0015);
    expect(targets[0]!.rotationXRadians).toBeCloseTo(0.52, 8);
    expect(targets[1]!.rotationXRadians).toBeCloseTo(-0.52, 8);
    expect(
      Math.abs(targets[0]!.rotationYRadians - 0.04),
    ).toBeLessThanOrEqual(0.015);
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

  it("creates two edge targets outside direct carriage-center travel", () => {
    const layout = createCabinetLayout(
      "edge",
      "edge-structure",
    );
    const targets = layout.placements.filter(
      (placement) => placement.role === "edge_target",
    );

    expect(targets).toHaveLength(2);

    const sideTarget = targets.find(
      (placement) =>
        placement.prizeId === "prize/box_standard",
    );
    const backTarget = targets.find(
      (placement) =>
        placement.prizeId === "prize/cylinder_can",
    );

    expect(sideTarget).toBeDefined();
    expect(backTarget).toBeDefined();
    expect(sideTarget!.x).toBeGreaterThan(0.37);
    expect(backTarget!.z).toBeLessThan(-0.295);
  });

  it("keeps edge seed jitter tight enough to preserve wall challenge placement", () => {
    const layout = createCabinetLayout(
      "edge",
      "edge-jitter",
    );
    const targets = layout.placements.filter(
      (placement) => placement.role === "edge_target",
    );

    const sideTarget = targets.find(
      (placement) =>
        placement.prizeId === "prize/box_standard",
    )!;
    const backTarget = targets.find(
      (placement) =>
        placement.prizeId === "prize/cylinder_can",
    )!;

    expect(Math.abs(sideTarget.x - 0.38)).toBeLessThanOrEqual(
      0.001,
    );
    expect(Math.abs(backTarget.z + 0.305)).toBeLessThanOrEqual(
      0.001,
    );
    expect(
      Math.abs(sideTarget.rotationYRadians - 0.08),
    ).toBeLessThanOrEqual(0.010);
  });

  it("creates two chute-adjacent targets just outside the opening", () => {
    const layout = createCabinetLayout(
      "chute",
      "chute-structure",
    );
    const targets = layout.placements.filter(
      (placement) => placement.role === "chute_target",
    );

    expect(targets).toHaveLength(2);

    const ball = targets.find(
      (placement) =>
        placement.prizeId === "prize/sphere_ball",
    );
    const cube = targets.find(
      (placement) =>
        placement.prizeId === "prize/cube_small",
    );

    expect(ball).toBeDefined();
    expect(cube).toBeDefined();

    expect(ball!.x).toBeGreaterThan(-0.071);
    expect(ball!.x).toBeLessThan(-0.065);
    expect(Math.abs(ball!.z - 0.20)).toBeLessThanOrEqual(0.001);

    expect(Math.abs(cube!.x + 0.24)).toBeLessThanOrEqual(0.001);
    expect(cube!.z).toBeGreaterThan(0.027);
    expect(cube!.z).toBeLessThan(0.033);
  });

  it("keeps chute-adjacent seed jitter tight enough to preserve the lip challenge", () => {
    const layout = createCabinetLayout(
      "chute",
      "chute-jitter",
    );
    const targets = layout.placements.filter(
      (placement) => placement.role === "chute_target",
    );

    const ball = targets.find(
      (placement) =>
        placement.prizeId === "prize/sphere_ball",
    )!;
    const cube = targets.find(
      (placement) =>
        placement.prizeId === "prize/cube_small",
    )!;

    expect(Math.abs(ball.x + 0.068)).toBeLessThanOrEqual(
      0.001,
    );
    expect(Math.abs(ball.z - 0.20)).toBeLessThanOrEqual(
      0.001,
    );
    expect(Math.abs(cube.x + 0.24)).toBeLessThanOrEqual(
      0.001,
    );
    expect(Math.abs(cube.z - 0.030)).toBeLessThanOrEqual(
      0.001,
    );
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

  it("keeps standard layouts inside the central play envelope and edge inside cabinet-safe bounds", () => {
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

    for (const placement of createCabinetLayout(
      "edge",
      "bounds",
    ).placements) {
      expect(Math.abs(placement.x)).toBeLessThanOrEqual(0.40);
      expect(Math.abs(placement.z)).toBeLessThanOrEqual(0.315);
      expect(placement.yOffsetMeters).toBeGreaterThanOrEqual(0.002);
    }

    for (const placement of createCabinetLayout(
      "ring",
      "bounds",
    ).placements) {
      expect(Math.abs(placement.x)).toBeLessThanOrEqual(0.265);
      expect(Math.abs(placement.z)).toBeLessThanOrEqual(0.195);
      expect(placement.yOffsetMeters).toBeGreaterThanOrEqual(0.002);
    }

    for (const placement of createCabinetLayout(
      "chute",
      "bounds",
    ).placements) {
      expect(placement.x).toBeGreaterThanOrEqual(-0.42);
      expect(placement.x).toBeLessThanOrEqual(0.265);
      expect(placement.z).toBeGreaterThanOrEqual(-0.195);
      expect(placement.z).toBeLessThanOrEqual(0.315);
      expect(placement.yOffsetMeters).toBeGreaterThanOrEqual(0.002);
    }
  });
});
