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
  restockedInventoryCount: number;
  completedServiceCount: number;
  restockThresholdCount: number;
  restockNeeded: boolean;
  canCallStaff: boolean;
  serviceState: CabinetServiceState;
  machinePaused: boolean;
}

export class CabinetInventoryServiceState {
  private readonly awardedPrizeIds = new Set<string>();
  private restockedInventoryCountValue = 0;
  private completedServiceCountValue = 0;
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
    if (this.remainingInventoryCount <= 0) {
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

  recordRestock(count: number): number {
    if (
      this.state !== "service_paused" ||
      !Number.isInteger(count) ||
      count <= 0
    ) {
      return 0;
    }

    const accepted = Math.min(
      count,
      this.restockDeficitCount,
    );
    this.restockedInventoryCountValue += accepted;
    return accepted;
  }

  completeService(): boolean {
    if (
      this.state !== "service_paused" ||
      this.restockNeeded
    ) {
      return false;
    }

    this.state = "operating";
    this.completedServiceCountValue += 1;
    return true;
  }

  get awardedInventoryCount(): number {
    return this.awardedPrizeIds.size;
  }

  get restockedInventoryCount(): number {
    return this.restockedInventoryCountValue;
  }

  get completedServiceCount(): number {
    return this.completedServiceCountValue;
  }

  get remainingInventoryCount(): number {
    return Math.max(
      0,
      this.initialInventoryCount +
        this.restockedInventoryCountValue -
        this.awardedPrizeIds.size,
    );
  }

  get restockDeficitCount(): number {
    return Math.max(
      0,
      this.initialInventoryCount -
        this.remainingInventoryCount,
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
      restockedInventoryCount:
        this.restockedInventoryCount,
      completedServiceCount:
        this.completedServiceCount,
      restockThresholdCount:
        this.restockThresholdCount,
      restockNeeded: this.restockNeeded,
      canCallStaff: this.canCallStaff,
      serviceState: this.serviceState,
      machinePaused: this.machinePaused,
    };
  }
}
