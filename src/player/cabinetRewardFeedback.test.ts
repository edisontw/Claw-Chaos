import { describe, expect, it } from "vitest";
import { cabinetRewardPresentation } from "./cabinetRewardFeedback";

describe("M11 reward presentation budget", () => {
  it("uses a short lightweight ordinary win presentation", () => {
    expect(
      cabinetRewardPresentation("prize", false),
    ).toEqual({
      title: "PRIZE GET!",
      detail: "PRIZE DELIVERED",
      durationMs: 1600,
      particleCount: 10,
    });
  });

  it("uses a longer distinct clear presentation", () => {
    const prize = cabinetRewardPresentation(
      "prize",
      false,
    );
    const clear = cabinetRewardPresentation(
      "clear",
      false,
    );

    expect(clear.title).toBe("MACHINE CLEARED!");
    expect(clear.durationMs).toBeGreaterThan(
      prize.durationMs,
    );
    expect(clear.particleCount).toBeGreaterThan(
      prize.particleCount,
    );
  });

  it("removes decorative particles in reduced-effects mode", () => {
    expect(
      cabinetRewardPresentation("prize", true)
        .particleCount,
    ).toBe(0);
    expect(
      cabinetRewardPresentation("clear", true)
        .particleCount,
    ).toBe(0);
  });
});
