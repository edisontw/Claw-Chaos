export interface SuspensionStabilizerConfig {
  stiffness: number;
  damping: number;
  maxForce: number;
  maxDampingForce?: number;
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

  const springForceX = -config.stiffness * offsetX;
  const springForceZ = -config.stiffness * offsetZ;
  let dampingForceX = -config.damping * relativeVelocityX;
  let dampingForceZ = -config.damping * relativeVelocityZ;

  const maxDampingForce = config.maxDampingForce ?? Number.POSITIVE_INFINITY;
  const dampingMagnitude = Math.hypot(dampingForceX, dampingForceZ);
  if (
    dampingMagnitude > maxDampingForce &&
    dampingMagnitude > Number.EPSILON
  ) {
    const dampingScale = maxDampingForce / dampingMagnitude;
    dampingForceX *= dampingScale;
    dampingForceZ *= dampingScale;
  }

  let forceX = springForceX + dampingForceX;
  let forceZ = springForceZ + dampingForceZ;

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
