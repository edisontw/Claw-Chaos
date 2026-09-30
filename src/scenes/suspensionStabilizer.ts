export interface SuspensionStabilizerConfig {
  stiffness: number;
  damping: number;
  maxForce: number;
}

export interface SuspensionHorizontalState {
  anchorX: number;
  anchorZ: number;
  anchorVelocityX: number;
  anchorVelocityZ: number;
  hubX: number;
  hubZ: number;
  hubVelocityX: number;
  hubVelocityZ: number;
}

export interface SuspensionHorizontalImpulse {
  x: number;
  z: number;
}

export function computeSuspensionStabilizerImpulse(
  state: SuspensionHorizontalState,
  config: SuspensionStabilizerConfig,
  stepSeconds: number,
): SuspensionHorizontalImpulse {
  const offsetX = state.hubX - state.anchorX;
  const offsetZ = state.hubZ - state.anchorZ;
  const relativeVelocityX = state.hubVelocityX - state.anchorVelocityX;
  const relativeVelocityZ = state.hubVelocityZ - state.anchorVelocityZ;

  let forceX =
    -config.stiffness * offsetX - config.damping * relativeVelocityX;
  let forceZ =
    -config.stiffness * offsetZ - config.damping * relativeVelocityZ;

  const magnitude = Math.hypot(forceX, forceZ);
  if (magnitude > config.maxForce && magnitude > Number.EPSILON) {
    const scale = config.maxForce / magnitude;
    forceX *= scale;
    forceZ *= scale;
  }

  return {
    x: forceX * stepSeconds,
    z: forceZ * stepSeconds,
  };
}
