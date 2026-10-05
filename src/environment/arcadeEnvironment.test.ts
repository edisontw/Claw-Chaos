import { describe, expect, it } from "vitest";
import {
  ARCADE_CEILING_FIXTURES,
  ARCADE_ENVIRONMENT_ID,
  ARCADE_ENVIRONMENT_VISUAL_ONLY,
  ARCADE_NEIGHBOR_MACHINE_PLACEMENTS,
} from "./arcadeEnvironment";

describe("Art Slice 3 arcade environment", () => {
  it("is explicitly visual-only", () => {
    expect(ARCADE_ENVIRONMENT_VISUAL_ONLY).toBe(true);
    expect(ARCADE_ENVIRONMENT_ID).toBe(
      "theme-a-modern-japanese-arcade-room",
    );
  });

  it("keeps neighboring machines outside the player movement lane", () => {
    expect(
      ARCADE_NEIGHBOR_MACHINE_PLACEMENTS.length,
    ).toBeGreaterThanOrEqual(4);

    for (const machine of ARCADE_NEIGHBOR_MACHINE_PLACEMENTS) {
      expect(Math.abs(machine.x)).toBeGreaterThanOrEqual(1.0);
      expect(machine.scale).toBeGreaterThanOrEqual(0.85);
      expect(machine.scale).toBeLessThanOrEqual(1.05);
    }
  });

  it("keeps ceiling fixtures above the adjustable player eye height", () => {
    expect(ARCADE_CEILING_FIXTURES.length).toBeGreaterThanOrEqual(6);
    for (const fixture of ARCADE_CEILING_FIXTURES) {
      expect(Math.abs(fixture.x)).toBeLessThanOrEqual(1.5);
      expect(fixture.z).toBeGreaterThanOrEqual(-0.8);
      expect(fixture.z).toBeLessThanOrEqual(0.9);
    }
  });

  it("uses balanced left/right neighboring-machine placement", () => {
    const xs = ARCADE_NEIGHBOR_MACHINE_PLACEMENTS.map(
      (machine) => machine.x,
    );
    expect(xs.some((x) => x < 0)).toBe(true);
    expect(xs.some((x) => x > 0)).toBe(true);
    expect(
      ARCADE_NEIGHBOR_MACHINE_PLACEMENTS.filter(
        (machine) => machine.accent === "primary",
      ),
    ).toHaveLength(2);
    expect(
      ARCADE_NEIGHBOR_MACHINE_PLACEMENTS.filter(
        (machine) => machine.accent === "secondary",
      ),
    ).toHaveLength(2);
  });
});
