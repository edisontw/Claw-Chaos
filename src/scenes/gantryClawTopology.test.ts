import { describe, expect, it } from "vitest";
import {
  createFingerIndexPairs,
  createGantryFingerAzimuths,
  parseGantryClawTopology,
} from "./gantryLab";

describe("gantry claw topology", () => {
  it("keeps the existing three-prong claw as the default", () => {
    expect(parseGantryClawTopology("")).toBe("three-prong");

    const azimuths = createGantryFingerAzimuths("three-prong");
    expect(azimuths).toHaveLength(3);
    expect(azimuths[0]).toBeCloseTo(0);
    expect(azimuths[1]).toBeCloseTo((Math.PI * 2) / 3);
    expect(azimuths[2]).toBeCloseTo((Math.PI * 4) / 3);
  });

  it("accepts concise URL aliases for the UFO two-prong prototype", () => {
    expect(parseGantryClawTopology("?machine=ufo")).toBe(
      "ufo-two-prong",
    );
    expect(parseGantryClawTopology("?machine=two-prong")).toBe(
      "ufo-two-prong",
    );
    expect(
      parseGantryClawTopology("?machine=ufo-two-prong"),
    ).toBe("ufo-two-prong");
  });

  it("places the two UFO fingers opposite each other", () => {
    const azimuths =
      createGantryFingerAzimuths("ufo-two-prong");

    expect(azimuths).toHaveLength(2);
    expect(azimuths[0]).toBeCloseTo(0);
    expect(azimuths[1]).toBeCloseTo(Math.PI);
  });

  it("enumerates every sibling pair without hard-coding three fingers", () => {
    expect(createFingerIndexPairs(2)).toEqual([[0, 1]]);
    expect(createFingerIndexPairs(3)).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
  });
});
