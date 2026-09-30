export const M04_PLAY_CONFIG = {
  autoClosePayoutMeters: 0.275,
  closeCompletionToleranceRadians: 0.005,
} as const;

export type M04PlayPhase =
  | "READY"
  | "DESCENDING"
  | "CLOSING"
  | "CLOSED_AT_DEPTH";

export type M04CloseReason = "EARLY" | "AUTO" | null;

export interface M04PlayState {
  phase: M04PlayPhase;
  closeReason: M04CloseReason;
  closeStartPayoutMeters: number | null;
}

export interface M04PlayObservation {
  reelPayoutMeters: number;
  fingerCommandRadians: number;
}

export interface M04PlayConfig {
  autoClosePayoutMeters: number;
  closedAngleRadians: number;
  closeCompletionToleranceRadians: number;
}

export function createM04PlayState(): M04PlayState {
  return {
    phase: "READY",
    closeReason: null,
    closeStartPayoutMeters: null,
  };
}

export function applyM04Action(
  state: M04PlayState,
  reelPayoutMeters: number,
): M04PlayState {
  if (state.phase === "READY") {
    return {
      phase: "DESCENDING",
      closeReason: null,
      closeStartPayoutMeters: null,
    };
  }

  if (state.phase === "DESCENDING") {
    return {
      phase: "CLOSING",
      closeReason: "EARLY",
      closeStartPayoutMeters: reelPayoutMeters,
    };
  }

  return state;
}

export function advanceM04PlayState(
  state: M04PlayState,
  observation: M04PlayObservation,
  config: M04PlayConfig,
): M04PlayState {
  if (
    state.phase === "DESCENDING" &&
    observation.reelPayoutMeters >= config.autoClosePayoutMeters
  ) {
    return {
      phase: "CLOSING",
      closeReason: "AUTO",
      closeStartPayoutMeters: observation.reelPayoutMeters,
    };
  }

  if (
    state.phase === "CLOSING" &&
    observation.fingerCommandRadians <=
      config.closedAngleRadians + config.closeCompletionToleranceRadians
  ) {
    return {
      ...state,
      phase: "CLOSED_AT_DEPTH",
    };
  }

  return state;
}

export function m04ReelCommand(state: M04PlayState): number {
  return state.phase === "DESCENDING" || state.phase === "CLOSING" ? 1 : 0;
}

export function m04FingerShouldClose(state: M04PlayState): boolean {
  return state.phase === "CLOSING" || state.phase === "CLOSED_AT_DEPTH";
}
