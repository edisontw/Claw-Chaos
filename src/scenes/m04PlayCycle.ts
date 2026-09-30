export const M04_PLAY_CONFIG = {
  autoClosePayoutMeters: 0.275,
  closeCompletionToleranceRadians: 0.005,
  closeSettleSeconds: 0.90,
  pickupLiftDistanceMeters: 0.06,
  holdBoostDurationSeconds: 0.80,
  holdBoostTorque: 0.010,
  releaseCompletionToleranceRadians: 0.005,
} as const;

export type M04PlayPhase =
  | "READY"
  | "DESCENDING"
  | "CLOSING"
  | "CLOSED_AT_DEPTH"
  | "PICKUP"
  | "RETAINING"
  | "RETURNING"
  | "RELEASING";

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
  holdBoostUsedSeconds: number;
}

export interface M04PlayObservation {
  reelPayoutMeters: number;
  fingerCommandRadians: number;
  reelAtTop?: boolean;
  homeReached?: boolean;
  holdBoostRequested?: boolean;
}

export interface M04PlayConfig {
  autoClosePayoutMeters: number;
  closedAngleRadians: number;
  openAngleRadians: number;
  closeCompletionToleranceRadians: number;
  releaseCompletionToleranceRadians: number;
  closeSettleSeconds: number;
  pickupLiftDistanceMeters: number;
  holdBoostDurationSeconds: number;
}

export function createM04PlayState(): M04PlayState {
  return {
    phase: "READY",
    phaseElapsedSeconds: 0,
    closeReason: null,
    closeStartPayoutMeters: null,
    pickupStartPayoutMeters: null,
    retainingStartPayoutMeters: null,
    holdBoostUsedSeconds: 0,
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

export function m04HoldBoostActive(
  state: M04PlayState,
  requested: boolean,
  config: Pick<M04PlayConfig, "holdBoostDurationSeconds">,
): boolean {
  return (
    requested &&
    (state.phase === "RETAINING" || state.phase === "RETURNING") &&
    state.holdBoostUsedSeconds < config.holdBoostDurationSeconds
  );
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
      holdBoostUsedSeconds: 0,
    };
  }

  if (state.phase === "RETAINING" && observation.reelAtTop) {
    return {
      ...state,
      phase: "RETURNING",
      phaseElapsedSeconds: 0,
    };
  }

  if (state.phase === "RETURNING" && observation.homeReached) {
    return {
      ...state,
      phase: "RELEASING",
      phaseElapsedSeconds: 0,
    };
  }

  if (
    state.phase === "RELEASING" &&
    observation.fingerCommandRadians >=
      config.openAngleRadians - config.releaseCompletionToleranceRadians
  ) {
    return createM04PlayState();
  }

  if (stepSeconds > 0 && state.phase !== "READY") {
    const boostActive = m04HoldBoostActive(
      state,
      observation.holdBoostRequested ?? false,
      config,
    );

    return {
      ...state,
      phaseElapsedSeconds: state.phaseElapsedSeconds + stepSeconds,
      holdBoostUsedSeconds: boostActive
        ? Math.min(
            config.holdBoostDurationSeconds,
            state.holdBoostUsedSeconds + stepSeconds,
          )
        : state.holdBoostUsedSeconds,
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
    state.phase === "RETAINING" ||
    state.phase === "RETURNING"
  );
}

export function m04ForcePhase(state: M04PlayState): M04ForcePhase {
  if (state.phase === "PICKUP") {
    return "PICKUP";
  }
  if (state.phase === "RETAINING" || state.phase === "RETURNING") {
    return "RETAINING";
  }
  if (m04FingerShouldClose(state)) {
    return "CLOSE";
  }
  return "OPEN";
}
