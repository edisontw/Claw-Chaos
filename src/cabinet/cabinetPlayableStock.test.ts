import { describe, expect, it } from "vitest";
import { M06_CABINET_CONFIG } from "./cabinetGeometry";
import { isPrizeBelowChuteOpening } from "./cabinetPlayableStock";

describe("cabinet playable-stock chute exit", () => {
  it("removes a prize from playable stock as soon as its center falls below the chute opening", () => {
    const c = M06_CABINET_CONFIG;

    expect(
      isPrizeBelowChuteOpening({
        x: c.chuteCenterX,
        y:
          c.playDeckY -
          c.playDeckHalfThickness -
          0.001,
        z: c.chuteCenterZ,
      }),
    ).toBe(true);
  });

  it("does not remove a prize merely hovering above the opening", () => {
    const c = M06_CABINET_CONFIG;

    expect(
      isPrizeBelowChuteOpening({
        x: c.chuteCenterX,
        y: c.playDeckY + 0.08,
        z: c.chuteCenterZ,
      }),
    ).toBe(false);
  });

  it("does not remove prizes below deck height outside the chute opening", () => {
    const c = M06_CABINET_CONFIG;

    expect(
      isPrizeBelowChuteOpening({
        x:
          c.chuteCenterX +
          c.chuteOpeningHalfX +
          0.02,
        y: c.playDeckY - 0.10,
        z: c.chuteCenterZ,
      }),
    ).toBe(false);
  });
});
