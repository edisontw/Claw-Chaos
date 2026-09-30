export interface GantryAxisState {
  position: number;
  velocity: number;
}

export interface GantryAxisConfig {
  minPosition: number;
  maxPosition: number;
  maxSpeed: number;
  acceleration: number;
  braking: number;
}

export interface GantryMotionState {
  x: GantryAxisState;
  z: GantryAxisState;
}

export interface GantryMotionConfig {
  x: GantryAxisConfig;
  z: GantryAxisConfig;
}

function moveToward(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) {
    return target;
  }
  return current + Math.sign(delta) * maxDelta;
}

export function advanceGantryAxis(
  state: GantryAxisState,
  input: number,
  config: GantryAxisConfig,
  stepSeconds: number,
): GantryAxisState {
  const clampedInput = Math.max(-1, Math.min(1, input));
  const targetVelocity = clampedInput * config.maxSpeed;
  const reducingSpeed =
    Math.abs(targetVelocity) < Math.abs(state.velocity) ||
    (targetVelocity !== 0 &&
      state.velocity !== 0 &&
      Math.sign(targetVelocity) !== Math.sign(state.velocity));
  const response = reducingSpeed || clampedInput === 0
    ? config.braking
    : config.acceleration;

  let velocity = moveToward(
    state.velocity,
    targetVelocity,
    Math.max(0, response * stepSeconds),
  );
  let position = state.position + velocity * stepSeconds;

  if (position <= config.minPosition) {
    position = config.minPosition;
    velocity = Math.max(0, velocity);
  } else if (position >= config.maxPosition) {
    position = config.maxPosition;
    velocity = Math.min(0, velocity);
  }

  return { position, velocity };
}

export function advanceGantryMotion(
  state: GantryMotionState,
  inputX: number,
  inputZ: number,
  config: GantryMotionConfig,
  stepSeconds: number,
): GantryMotionState {
  return {
    x: advanceGantryAxis(state.x, inputX, config.x, stepSeconds),
    z: advanceGantryAxis(state.z, inputZ, config.z, stepSeconds),
  };
}


export interface GantryTargetTolerance {
  position: number;
  velocity: number;
}

export function advanceGantryAxisTowardPosition(
  state: GantryAxisState,
  targetPosition: number,
  config: GantryAxisConfig,
  stepSeconds: number,
): GantryAxisState {
  const target = Math.max(
    config.minPosition,
    Math.min(config.maxPosition, targetPosition),
  );
  const remaining = target - state.position;

  if (Math.abs(remaining) <= Number.EPSILON && Math.abs(state.velocity) <= 1e-9) {
    return state;
  }

  const direction = Math.sign(remaining);
  const stoppingLimitedSpeed = Math.sqrt(
    Math.max(0, 2 * config.braking * Math.abs(remaining)),
  );
  const desiredSpeed = Math.min(config.maxSpeed, stoppingLimitedSpeed);
  const desiredVelocity = direction * desiredSpeed;

  const reducingSpeed =
    Math.abs(desiredVelocity) < Math.abs(state.velocity) ||
    (desiredVelocity !== 0 &&
      state.velocity !== 0 &&
      Math.sign(desiredVelocity) !== Math.sign(state.velocity));
  const response = reducingSpeed ? config.braking : config.acceleration;
  const velocity = moveToward(
    state.velocity,
    desiredVelocity,
    Math.max(0, response * stepSeconds),
  );

  return {
    position: state.position + velocity * stepSeconds,
    velocity,
  };
}

export function isGantryAxisAtTarget(
  state: GantryAxisState,
  targetPosition: number,
  tolerance: GantryTargetTolerance,
): boolean {
  return (
    Math.abs(state.position - targetPosition) <= tolerance.position &&
    Math.abs(state.velocity) <= tolerance.velocity
  );
}

export function advanceGantryMotionTowardPosition(
  state: GantryMotionState,
  targetX: number,
  targetZ: number,
  config: GantryMotionConfig,
  stepSeconds: number,
): GantryMotionState {
  return {
    x: advanceGantryAxisTowardPosition(
      state.x,
      targetX,
      config.x,
      stepSeconds,
    ),
    z: advanceGantryAxisTowardPosition(
      state.z,
      targetZ,
      config.z,
      stepSeconds,
    ),
  };
}
