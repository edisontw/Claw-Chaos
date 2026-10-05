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
      restockedInventoryCount: 0,
      completedServiceCount: 0,
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

  it("queues service without interrupting the active machine until handoff is safe", () => {
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
    expect(state.machinePaused).toBe(false);

    expect(
      state.advanceServiceHandoff(true),
    ).toBe(true);
    expect(state.serviceState).toBe(
      "service_paused",
    );
    expect(state.machinePaused).toBe(true);
    expect(
      state.advanceServiceHandoff(true),
    ).toBe(false);
  });

  it("records only the physical restock deficit while service is paused", () => {
    const state = new CabinetInventoryServiceState(
      4,
      { restockThresholdCount: 1 },
    );

    expect(
      state.consumeWin({ prizeId: "prize-a" }),
    ).toBe(true);
    expect(
      state.consumeWin({ prizeId: "prize-b" }),
    ).toBe(true);
    expect(
      state.consumeWin({ prizeId: "prize-c" }),
    ).toBe(true);
    expect(state.remainingInventoryCount).toBe(1);
    expect(state.restockDeficitCount).toBe(3);

    expect(state.recordRestock(3)).toBe(0);
    expect(state.requestStaff()).toBe(true);
    expect(
      state.advanceServiceHandoff(true),
    ).toBe(true);

    expect(state.recordRestock(99)).toBe(3);
    expect(state.remainingInventoryCount).toBe(4);
    expect(state.restockedInventoryCount).toBe(3);
    expect(state.restockDeficitCount).toBe(0);
    expect(state.recordRestock(1)).toBe(0);

    expect(
      state.consumeWin({ prizeId: "restock-prize" }),
    ).toBe(true);
    expect(state.remainingInventoryCount).toBe(3);
  });

  it("reopens only after restock and supports independent repeated service cycles", () => {
    const state = new CabinetInventoryServiceState(
      4,
      { restockThresholdCount: 1 },
    );

    for (const prizeId of ["a", "b", "c"]) {
      expect(
        state.consumeWin({ prizeId }),
      ).toBe(true);
    }
    expect(state.requestStaff()).toBe(true);
    expect(
      state.advanceServiceHandoff(true),
    ).toBe(true);
    expect(state.completeService()).toBe(false);
    expect(state.recordRestock(3)).toBe(3);
    expect(state.completeService()).toBe(true);
    expect(state.serviceState).toBe("operating");
    expect(state.machinePaused).toBe(false);
    expect(state.completedServiceCount).toBe(1);
    expect(state.remainingInventoryCount).toBe(4);

    for (const prizeId of ["d", "e", "f"]) {
      expect(
        state.consumeWin({ prizeId }),
      ).toBe(true);
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
