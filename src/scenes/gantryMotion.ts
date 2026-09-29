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
