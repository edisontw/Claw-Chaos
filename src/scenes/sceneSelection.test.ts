import { describe, expect, it } from "vitest";
import {
  parseSceneSelection,
  resolveStartupSceneSelection,
} from "./sceneSelection";

describe("fresh stocked startup selection", () => {
  it("randomizes the default public stocked machine on each new session", () => {
    const first = resolveStartupSceneSelection("", () => "session-a");
    const second = resolveStartupSceneSelection("", () => "session-b");
    expect(first.id).toBe("cabinet-lab");
    expect(first.seed).toBe("session-a");
    expect(second.seed).toBe("session-b");
    expect(second.seed).not.toBe(first.seed);
  });

  it("preserves an explicit seed for exact reproduction", () => {
    expect(
      resolveStartupSceneSelection(
        "?layout=stocked&seed=physics-report-123",
        () => { throw new Error("random seed should not be used"); },
      ),
    ).toEqual(parseSceneSelection("?layout=stocked&seed=physics-report-123"));
  });

  it("never modifies accepted deterministic M09 diagnostic layouts", () => {
    for (const layout of ["loose", "dense", "ring", "edge", "bridge", "showcase", "chute"]) {
      expect(
        resolveStartupSceneSelection(
          `?layout=${layout}`,
          () => { throw new Error("diagnostic layouts should keep their seed"); },
        ).seed,
      ).toBe(parseSceneSelection(`?layout=${layout}`).seed);
    }
  });

  it("does not change explicit seeds or non-cabinet scenes", () => {
    expect(
      resolveStartupSceneSelection(
        "?scene=gantry-lab",
        () => { throw new Error("laboratory should not randomize"); },
      ).seed,
    ).toBe(parseSceneSelection("?scene=gantry-lab").seed);
  });
});
