export interface SwingPumpState {
  direction: -1 | 1;
  initialized: boolean;
}

export interface SwingPumpSample {
  relativePosition: number;
  relativeVelocity: number;
}

export interface SwingPumpConfig {
  velocityDeadband: number;
  minOffsetForReversal: number;
}

export function advancePhaseAwareSwingPump(
  state: SwingPumpState,
  sample: SwingPumpSample,
  config: SwingPumpConfig,
): SwingPumpState {
  if (!state.initialized) {
    return { direction: 1, initialized: true };
  }

  if (
    Math.abs(sample.relativeVelocity) < config.velocityDeadband ||
    Math.abs(sample.relativePosition) < config.minOffsetForReversal
  ) {
    return state;
  }

  const desiredDirection = sample.relativeVelocity > 0 ? -1 : 1;
  return desiredDirection === state.direction
    ? state
    : { direction: desiredDirection, initialized: true };
}
