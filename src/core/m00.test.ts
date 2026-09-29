import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SCENE_SEED } from "../config/simulation";
import { parseSceneSelection } from "../scenes/sceneSelection";
import { FixedStepLoop } from "./FixedStepLoop";
import { createSeededRandom } from "./seededRng";

describe("M00 deterministic utilities", () => {
  it("runs two 120 Hz physics ticks for one 60 Hz render frame", () => {
    const loop = new FixedStepLoop(1 / 120, 8, 0.25);
    const step = vi.fn();

    const result = loop.advance(1 / 60, step);

    expect(result.steps).toBe(2);
    expect(step).toHaveBeenCalledTimes(2);
    expect(result.droppedSeconds).toBe(0);
    expect(result.alpha).toBeCloseTo(0, 10);
  });

  it("carries partial time and caps catch-up work", () => {
    const loop = new FixedStepLoop(0.01, 4, 0.25);
    const step = vi.fn();

    expect(loop.advance(0.006, step).steps).toBe(0);
    expect(loop.advance(0.006, step).steps).toBe(1);

    const catchUp = loop.advance(0.25, step);
    expect(catchUp.steps).toBe(4);
    expect(catchUp.droppedSeconds).toBeGreaterThan(0);
    expect(catchUp.alpha).toBeGreaterThanOrEqual(0);
    expect(catchUp.alpha).toBeLessThan(1);
  });

  it("repeats the same RNG sequence for the same seed", () => {
    const first = createSeededRandom("claw-chaos");
    const second = createSeededRandom("claw-chaos");

    expect(Array.from({ length: 8 }, () => first.next())).toEqual(
      Array.from({ length: 8 }, () => second.next()),
    );
  });

  it("keeps RNG range output in bounds", () => {
    const rng = createSeededRandom(42);
    for (let index = 0; index < 20; index += 1) {
      const value = rng.range(-2, 5);
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThan(5);
    }
  });

  it("selects M02, M01, and legacy M00 scenes", () => {
    expect(parseSceneSelection("?scene=gantry-lab&seed=m02-7")).toEqual({
      id: "gantry-lab",
      seed: "m02-7",
      usedFallback: false,
    });
    expect(parseSceneSelection("?scene=claw-lab&seed=lab-7")).toEqual({
      id: "claw-lab",
      seed: "lab-7",
      usedFallback: false,
    });
    expect(parseSceneSelection("?scene=falling-cube&seed=regression-7")).toEqual({
      id: "falling-cube",
      seed: "regression-7",
      usedFallback: false,
    });
  });

  it("falls back safely to the current default scene", () => {
    const selection = parseSceneSelection("?scene=not-a-scene");
    expect(selection.id).toBe("gantry-lab");
    expect(selection.usedFallback).toBe(true);
  });

  it("uses the stable default seed when none is supplied", () => {
    expect(parseSceneSelection("").seed).toBe(DEFAULT_SCENE_SEED);
  });
});
