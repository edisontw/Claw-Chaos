import { describe, expect, it } from "vitest";
import {
  classifyCabinetReward,
  createCabinetRewardEvent,
} from "./cabinetRewardFeedback";

describe("M11 authoritative reward feedback", () => {
  it("uses PRIZE feedback for an ordinary ChuteSensor win", () => {
    expect(
      classifyCabinetReward({
        remainingInventoryCount: 3,
        awardedInventoryCount: 2,
        totalStockCount: 5,
      }),
    ).toBe("prize");
  });

  it("does not clear while another unavailable prize is still pending sensor award", () => {
    expect(
      classifyCabinetReward({
        remainingInventoryCount: 0,
        awardedInventoryCount: 4,
        totalStockCount: 5,
      }),
    ).toBe("prize");
  });

  it("clears only after the final stocked prize is authoritatively awarded", () => {
    expect(
      classifyCabinetReward({
        remainingInventoryCount: 0,
        awardedInventoryCount: 5,
        totalStockCount: 5,
      }),
    ).toBe("clear");
  });

  it("includes restocked inventory in the clear requirement", () => {
    const event = createCabinetRewardEvent(
      {
        prizeId: "restock#1#2:prize/cube_small",
        resultSequence: 7,
      },
      {
        remainingInventoryCount: 0,
        awardedInventoryCount: 7,
        totalStockCount: 7,
      },
    );

    expect(event).toEqual({
      kind: "clear",
      prizeId: "restock#1#2:prize/cube_small",
      resultSequence: 7,
      awardedPrizeCount: 7,
      totalStockCount: 7,
    });
  });

  it("never reports clear for an empty zero-stock bootstrap state", () => {
    expect(
      classifyCabinetReward({
        remainingInventoryCount: 0,
        awardedInventoryCount: 0,
        totalStockCount: 0,
      }),
    ).toBe("prize");
  });
});
