export interface ReelState {
  payout: number;
  velocity: number;
}

export interface ReelConfig {
  minPayout: number;
  maxPayout: number;
  maxSpeed: number;
  acceleration: number;
  braking: number;
}

function moveToward(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) {
    return target;
  }
  return current + Math.sign(delta) * maxDelta;
}

function limitAwareTargetVelocity(
  state: ReelState,
  command: number,
  config: ReelConfig,
): number {
  const clamped = Math.max(-1, Math.min(1, command));
  if (clamped === 0) {
    return 0;
  }

  const movingDown = clamped > 0;
  const remaining = movingDown
    ? Math.max(0, config.maxPayout - state.payout)
    : Math.max(0, state.payout - config.minPayout);

  if (remaining <= Number.EPSILON) {
    return 0;
  }

  const stoppingLimitedSpeed = Math.sqrt(2 * config.braking * remaining);
  const speed = Math.min(config.maxSpeed, stoppingLimitedSpeed);
  return movingDown ? speed : -speed;
}


export function haltReel(state: ReelState): ReelState {
  return {
    payout: state.payout,
    velocity: 0,
  };
}

export function advanceReel(
  state: ReelState,
  command: number,
  config: ReelConfig,
  stepSeconds: number,
): ReelState {
  const targetVelocity = limitAwareTargetVelocity(state, command, config);
  const slowing =
    Math.abs(targetVelocity) < Math.abs(state.velocity) ||
    (targetVelocity !== 0 &&
      state.velocity !== 0 &&
      Math.sign(targetVelocity) !== Math.sign(state.velocity));
  const rate = slowing || command === 0 ? config.braking : config.acceleration;

  let velocity = moveToward(
    state.velocity,
    targetVelocity,
    Math.max(0, rate * stepSeconds),
  );
  let payout = state.payout + velocity * stepSeconds;

  if (payout <= config.minPayout) {
    payout = config.minPayout;
    velocity = Math.max(0, velocity);
  } else if (payout >= config.maxPayout) {
    payout = config.maxPayout;
    velocity = Math.min(0, velocity);
  }

  if (
    Math.abs(velocity) < 1e-6 &&
    (Math.abs(payout - config.minPayout) < 1e-6 ||
      Math.abs(payout - config.maxPayout) < 1e-6)
  ) {
    velocity = 0;
  }

  return { payout, velocity };
}
