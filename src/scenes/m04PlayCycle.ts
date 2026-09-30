export const M04_PLAY_CONFIG = {
  autoClosePayoutMeters: 0.275,
  closeCompletionToleranceRadians: 0.005,
  closeSettleSeconds: 0.30,
  pickupLiftDistanceMeters: 0.06,
} as const;

export type M04PlayPhase =
  | "READY"
  | "DESCENDING"
  | "CLOSING"
  | "CLOSED_AT_DEPTH"
  | "PICKUP"
  | "RETAINING";

export type M04CloseReason = "EARLY" | "AUTO" | null;

export type M04ForcePhase =
  | "OPEN"
  | "CLOSE"
  | "PICKUP"
  | "RETAINING";

export interface M04PlayState {
  phase: M04PlayPhase;
  phaseElapsedSeconds: number;
  closeReason: M04CloseReason;
  closeStartPayoutMeters: number | null;
  pickupStartPayoutMeters: number | null;
  retainingStartPayoutMeters: number | null;
}

export interface M04PlayObservation {
  reelPayoutMeters: number;
  fingerCommandRadians: number;
}

export interface M04PlayConfig {
  autoClosePayoutMeters: number;
  closedAngleRadians: number;
  closeCompletionToleranceRadians: number;
  closeSettleSeconds: number;
  pickupLiftDistanceMeters: number;
}

export function createM04PlayState(): M04PlayState {
  return {
    phase: "READY",
    phaseElapsedSeconds: 0,
    closeReason: null,
    closeStartPayoutMeters: null,
    pickupStartPayoutMeters: null,
    retainingStartPayoutMeters: null,
  };
}

export function applyM04Action(
  state: M04PlayState,
  reelPayoutMeters: number,
): M04PlayState {
  if (state.phase === "READY") {
    return {
      ...createM04PlayState(),
      phase: "DESCENDING",
    };
  }

  if (state.phase === "DESCENDING") {
    return {
      ...state,
      phase: "CLOSING",
      phaseElapsedSeconds: 0,
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
  stepSeconds = 0,
): M04PlayState {
  if (
    state.phase === "DESCENDING" &&
    observation.reelPayoutMeters >= config.autoClosePayoutMeters
  ) {
    return {
      ...state,
      phase: "CLOSING",
      phaseElapsedSeconds: 0,
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
      phaseElapsedSeconds: 0,
    };
  }

  if (state.phase === "CLOSED_AT_DEPTH") {
    const phaseElapsedSeconds = state.phaseElapsedSeconds + stepSeconds;
    if (phaseElapsedSeconds >= config.closeSettleSeconds) {
      return {
        ...state,
        phase: "PICKUP",
        phaseElapsedSeconds: 0,
        pickupStartPayoutMeters: observation.reelPayoutMeters,
      };
    }

    return {
      ...state,
      phaseElapsedSeconds,
    };
  }

  if (
    state.phase === "PICKUP" &&
    state.pickupStartPayoutMeters !== null &&
    state.pickupStartPayoutMeters - observation.reelPayoutMeters >=
      config.pickupLiftDistanceMeters
  ) {
    return {
      ...state,
      phase: "RETAINING",
      phaseElapsedSeconds: 0,
      retainingStartPayoutMeters: observation.reelPayoutMeters,
    };
  }

  if (stepSeconds > 0 && state.phase !== "READY") {
    return {
      ...state,
      phaseElapsedSeconds: state.phaseElapsedSeconds + stepSeconds,
    };
  }

  return state;
}

export function m04ReelCommand(state: M04PlayState): number {
  if (state.phase === "DESCENDING" || state.phase === "CLOSING") {
    return 1;
  }
  if (state.phase === "PICKUP" || state.phase === "RETAINING") {
    return -1;
  }
  return 0;
}

export function m04FingerShouldClose(state: M04PlayState): boolean {
  return (
    state.phase === "CLOSING" ||
    state.phase === "CLOSED_AT_DEPTH" ||
    state.phase === "PICKUP" ||
    state.phase === "RETAINING"
  );
}

export function m04ForcePhase(state: M04PlayState): M04ForcePhase {
  if (state.phase === "PICKUP") {
    return "PICKUP";
  }
  if (state.phase === "RETAINING") {
    return "RETAINING";
  }
  if (m04FingerShouldClose(state)) {
    return "CLOSE";
  }
  return "OPEN";
}
