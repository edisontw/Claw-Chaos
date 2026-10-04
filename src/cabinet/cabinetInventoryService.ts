import type { CabinetWinResult } from "./cabinetResultState";

export type CabinetServiceState =
  | "operating"
  | "staff_requested"
  | "service_paused";

export interface CabinetStaffPolicy {
  restockThresholdCount: number;
}

export interface CabinetInventoryServiceSnapshot {
  initialInventoryCount: number;
  remainingInventoryCount: number;
  awardedInventoryCount: number;
  restockThresholdCount: number;
  restockNeeded: boolean;
  canCallStaff: boolean;
  serviceState: CabinetServiceState;
  machinePaused: boolean;
}

export class CabinetInventoryServiceState {
  private readonly awardedPrizeIds = new Set<string>();
  private state: CabinetServiceState = "operating";

  readonly initialInventoryCount: number;
  readonly restockThresholdCount: number;

  constructor(
    initialInventoryCount: number,
    policy: CabinetStaffPolicy = {
      restockThresholdCount: 1,
    },
  ) {
    if (
      !Number.isInteger(initialInventoryCount) ||
      initialInventoryCount < 0
    ) {
      throw new Error(
        "initialInventoryCount must be a non-negative integer",
      );
    }
    if (
      !Number.isInteger(policy.restockThresholdCount) ||
      policy.restockThresholdCount < 0 ||
      policy.restockThresholdCount > initialInventoryCount
    ) {
      throw new Error(
        "restockThresholdCount must be an integer within inventory bounds",
      );
    }

    this.initialInventoryCount = initialInventoryCount;
    this.restockThresholdCount =
      policy.restockThresholdCount;
  }

  consumeWin(
    result: Pick<CabinetWinResult, "prizeId">,
  ): boolean {
    if (this.awardedPrizeIds.has(result.prizeId)) {
      return false;
    }
    if (
      this.awardedPrizeIds.size >=
      this.initialInventoryCount
    ) {
      return false;
    }

    this.awardedPrizeIds.add(result.prizeId);
    return true;
  }

  requestStaff(): boolean {
    if (!this.canCallStaff) {
      return false;
    }

    this.state = "staff_requested";
    return true;
  }

  advanceServiceHandoff(canPauseSafely: boolean): boolean {
    if (
      this.state !== "staff_requested" ||
      !canPauseSafely
    ) {
      return false;
    }

    this.state = "service_paused";
    return true;
  }

  get awardedInventoryCount(): number {
    return this.awardedPrizeIds.size;
  }

  get remainingInventoryCount(): number {
    return (
      this.initialInventoryCount -
      this.awardedPrizeIds.size
    );
  }

  get restockNeeded(): boolean {
    return (
      this.remainingInventoryCount <=
      this.restockThresholdCount
    );
  }

  get canCallStaff(): boolean {
    return (
      this.state === "operating" &&
      this.restockNeeded
    );
  }

  get serviceState(): CabinetServiceState {
    return this.state;
  }

  get playerInputLocked(): boolean {
    return this.state !== "operating";
  }

  get machinePaused(): boolean {
    return this.state === "service_paused";
  }

  snapshot(): CabinetInventoryServiceSnapshot {
    return {
      initialInventoryCount: this.initialInventoryCount,
      remainingInventoryCount:
        this.remainingInventoryCount,
      awardedInventoryCount:
        this.awardedInventoryCount,
      restockThresholdCount:
        this.restockThresholdCount,
      restockNeeded: this.restockNeeded,
      canCallStaff: this.canCallStaff,
      serviceState: this.serviceState,
      machinePaused: this.machinePaused,
    };
  }
}
