import { describe, expect, it } from "vitest";
import { CabinetInventoryServiceState } from "./cabinetInventoryService";

describe("M10 cabinet inventory and staff-policy foundation", () => {
  it("tracks playable stock separately from awarded wins", () => {
    const state = new CabinetInventoryServiceState(
      5,
      { restockThresholdCount: 1 },
    );

    expect(state.snapshot()).toEqual({
      initialInventoryCount: 5,
      remainingInventoryCount: 5,
      unavailableInventoryCount: 0,
      awardedInventoryCount: 0,
      restockedInventoryCount: 0,
      completedServiceCount: 0,
      restockThresholdCount: 1,
      restockNeeded: false,
      canCallStaff: true,
      serviceState: "operating",
      machinePaused: false,
    });

    expect(state.markPrizeUnavailable("prize-a")).toBe(true);
    expect(state.markPrizeUnavailable("prize-a")).toBe(false);
    expect(state.remainingInventoryCount).toBe(4);
    expect(state.unavailableInventoryCount).toBe(1);
    expect(state.awardedInventoryCount).toBe(0);

    expect(
      state.consumeWin({ prizeId: "prize-a" }),
    ).toBe(true);
    expect(state.remainingInventoryCount).toBe(4);
    expect(state.awardedInventoryCount).toBe(1);

    expect(
      state.consumeWin({ prizeId: "prize-a" }),
    ).toBe(false);
    expect(state.remainingInventoryCount).toBe(4);
  });

  it("allows CALL STAFF any time while the cabinet is operating", () => {
    const state = new CabinetInventoryServiceState(
      3,
      { restockThresholdCount: 1 },
    );

    expect(state.canCallStaff).toBe(true);
    expect(state.requestStaff()).toBe(true);
    expect(state.serviceState).toBe(
      "staff_requested",
    );
    expect(state.playerInputLocked).toBe(true);
    expect(state.machinePaused).toBe(false);
    expect(state.canCallStaff).toBe(false);
    expect(state.requestStaff()).toBe(false);

    expect(
      state.advanceServiceHandoff(false),
    ).toBe(false);
    expect(state.serviceState).toBe(
      "staff_requested",
    );

    expect(
      state.advanceServiceHandoff(true),
    ).toBe(true);
    expect(state.serviceState).toBe(
      "service_paused",
    );
    expect(state.machinePaused).toBe(true);
  });

  it("restocks only the physical playable-stock deficit", () => {
    const state = new CabinetInventoryServiceState(
      4,
      { restockThresholdCount: 1 },
    );

    expect(state.markPrizeUnavailable("prize-a")).toBe(true);
    expect(state.markPrizeUnavailable("prize-b")).toBe(true);
    expect(state.markPrizeUnavailable("prize-c")).toBe(true);
    expect(state.remainingInventoryCount).toBe(1);
    expect(state.restockDeficitCount).toBe(3);
    expect(state.restockNeeded).toBe(true);

    expect(state.recordRestock(3)).toBe(0);
    expect(state.requestStaff()).toBe(true);
    expect(
      state.advanceServiceHandoff(true),
    ).toBe(true);

    expect(state.recordRestock(99)).toBe(3);
    expect(state.remainingInventoryCount).toBe(4);
    expect(state.restockedInventoryCount).toBe(3);
    expect(state.restockDeficitCount).toBe(0);
    expect(state.restockNeeded).toBe(false);
    expect(state.recordRestock(1)).toBe(0);
  });

  it("supports a no-deficit service cycle when CALL STAFF is requested early", () => {
    const state = new CabinetInventoryServiceState(
      4,
      { restockThresholdCount: 1 },
    );

    expect(state.restockDeficitCount).toBe(0);
    expect(state.requestStaff()).toBe(true);
    expect(
      state.advanceServiceHandoff(true),
    ).toBe(true);
    expect(state.recordRestock(1)).toBe(0);
    expect(state.completeService()).toBe(true);
    expect(state.completedServiceCount).toBe(1);
    expect(state.remainingInventoryCount).toBe(4);
    expect(state.canCallStaff).toBe(true);
  });

  it("reopens after topping up and supports repeated service cycles", () => {
    const state = new CabinetInventoryServiceState(
      4,
      { restockThresholdCount: 1 },
    );

    for (const prizeId of ["a", "b", "c"]) {
      expect(state.markPrizeUnavailable(prizeId)).toBe(true);
    }
    expect(state.requestStaff()).toBe(true);
    expect(
      state.advanceServiceHandoff(true),
    ).toBe(true);
    expect(state.completeService()).toBe(false);
    expect(state.recordRestock(3)).toBe(3);
    expect(state.completeService()).toBe(true);
    expect(state.remainingInventoryCount).toBe(4);

    for (const prizeId of ["d", "e", "f"]) {
      expect(state.markPrizeUnavailable(prizeId)).toBe(true);
    }
    expect(state.remainingInventoryCount).toBe(1);
    expect(state.requestStaff()).toBe(true);
    expect(
      state.advanceServiceHandoff(true),
    ).toBe(true);
    expect(state.recordRestock(3)).toBe(3);
    expect(state.completeService()).toBe(true);
    expect(state.completedServiceCount).toBe(2);
    expect(state.remainingInventoryCount).toBe(4);
  });

  it("does not double-decrement when a physically removed prize later becomes a win", () => {
    const state = new CabinetInventoryServiceState(
      2,
      { restockThresholdCount: 0 },
    );

    expect(state.markPrizeUnavailable("prize-a")).toBe(true);
    expect(state.remainingInventoryCount).toBe(1);

    expect(
      state.consumeWin({ prizeId: "prize-a" }),
    ).toBe(true);
    expect(state.remainingInventoryCount).toBe(1);
    expect(state.awardedInventoryCount).toBe(1);
  });

  it("never decrements playable stock below zero", () => {
    const state = new CabinetInventoryServiceState(
      1,
      { restockThresholdCount: 0 },
    );

    expect(state.markPrizeUnavailable("prize-a")).toBe(true);
    expect(state.markPrizeUnavailable("prize-b")).toBe(false);
    expect(state.remainingInventoryCount).toBe(0);
  });

  it("rejects invalid inventory policies", () => {
    expect(
      () =>
        new CabinetInventoryServiceState(
          -1,
          { restockThresholdCount: 0 },
        ),
    ).toThrow();

    expect(
      () =>
        new CabinetInventoryServiceState(
          2,
          { restockThresholdCount: 3 },
        ),
    ).toThrow();
  });
});
