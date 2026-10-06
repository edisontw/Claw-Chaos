import type { CabinetWinResult } from "./cabinetResultState";

export type CabinetRewardKind =
  | "prize"
  | "clear";

export interface CabinetRewardEvent {
  kind: CabinetRewardKind;
  prizeId: string;
  resultSequence: number;
  awardedPrizeCount: number;
  totalStockCount: number;
}

export interface CabinetRewardInventoryState {
  remainingInventoryCount: number;
  awardedInventoryCount: number;
  totalStockCount: number;
}

export function classifyCabinetReward(
  state: CabinetRewardInventoryState,
): CabinetRewardKind {
  const allStockAuthoritativelyAwarded =
    state.totalStockCount > 0 &&
    state.remainingInventoryCount === 0 &&
    state.awardedInventoryCount === state.totalStockCount;

  return allStockAuthoritativelyAwarded
    ? "clear"
    : "prize";
}

export function createCabinetRewardEvent(
  result: Pick<CabinetWinResult, "prizeId" | "resultSequence">,
  state: CabinetRewardInventoryState,
): CabinetRewardEvent {
  return {
    kind: classifyCabinetReward(state),
    prizeId: result.prizeId,
    resultSequence: result.resultSequence,
    awardedPrizeCount: state.awardedInventoryCount,
    totalStockCount: state.totalStockCount,
  };
}
