import { describe, expect, it } from "vitest";
import { CabinetInventoryServiceState } from "./cabinetInventoryService";

describe("M10 cabinet inventory and staff-policy foundation", () => {
  it("tracks unique awarded prizes against remaining cabinet stock", () => {
    const state = new CabinetInventoryServiceState(
      5,
      { restockThresholdCount: 1 },
    );

    expect(state.snapshot()).toEqual({
      initialInventoryCount: 5,
      remainingInventoryCount: 5,
      awardedInventoryCount: 0,
      restockThresholdCount: 1,
      restockNeeded: false,
      canCallStaff: false,
      serviceState: "operating",
      machinePaused: false,
    });

    expect(
      state.consumeWin({ prizeId: "prize-a" }),
    ).toBe(true);
    expect(
      state.consumeWin({ prizeId: "prize-a" }),
    ).toBe(false);
    expect(
      state.consumeWin({ prizeId: "prize-b" }),
    ).toBe(true);
    expect(
      state.consumeWin({ prizeId: "prize-c" }),
    ).toBe(true);

    expect(state.remainingInventoryCount).toBe(2);
    expect(state.restockNeeded).toBe(false);
    expect(state.canCallStaff).toBe(false);

    expect(
      state.consumeWin({ prizeId: "prize-d" }),
    ).toBe(true);
    expect(state.remainingInventoryCount).toBe(1);
    expect(state.restockNeeded).toBe(true);
    expect(state.canCallStaff).toBe(true);
  });

  it("blocks arbitrary staff requests until the restock threshold is reached", () => {
    const state = new CabinetInventoryServiceState(
      3,
      { restockThresholdCount: 1 },
    );

    expect(state.requestStaff()).toBe(false);
    expect(state.serviceState).toBe("operating");
    expect(state.machinePaused).toBe(false);

    expect(
      state.consumeWin({ prizeId: "prize-a" }),
    ).toBe(true);
    expect(state.requestStaff()).toBe(false);

    expect(
      state.consumeWin({ prizeId: "prize-b" }),
    ).toBe(true);
    expect(state.canCallStaff).toBe(true);
    expect(state.requestStaff()).toBe(true);

    expect(state.serviceState).toBe(
      "staff_requested",
    );
    expect(state.machinePaused).toBe(true);
    expect(state.canCallStaff).toBe(false);
    expect(state.requestStaff()).toBe(false);
  });

  it("never decrements inventory below zero", () => {
    const state = new CabinetInventoryServiceState(
      1,
      { restockThresholdCount: 0 },
    );

    expect(
      state.consumeWin({ prizeId: "prize-a" }),
    ).toBe(true);
    expect(
      state.consumeWin({ prizeId: "prize-b" }),
    ).toBe(false);
    expect(state.remainingInventoryCount).toBe(0);
    expect(state.awardedInventoryCount).toBe(1);
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
