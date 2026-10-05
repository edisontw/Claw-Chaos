export type StaffServicePhase =
  | "hidden"
  | "approaching"
  | "opening_door"
  | "door_open";

export interface StaffServiceState {
  phase: StaffServicePhase;
  elapsedSeconds: number;
}

export const M10_STAFF_SERVICE_CONFIG = {
  approachSeconds: 2.6,
  doorOpeningSeconds: 0.9,
  startX: 0.98,
  startZ: 0.92,
  serviceX: 0.70,
  serviceZ: 0.49,
  doorOpenRadians: 1.12,
} as const;

export function createStaffServiceState(): StaffServiceState {
  return {
    phase: "hidden",
    elapsedSeconds: 0,
  };
}

export function advanceStaffServiceState(
  state: StaffServiceState,
  servicePaused: boolean,
  stepSeconds: number,
): StaffServiceState {
  const dt = Math.max(0, stepSeconds);

  if (!servicePaused) {
    return state;
  }

  if (state.phase === "hidden") {
    return {
      phase: "approaching",
      elapsedSeconds: 0,
    };
  }

  const elapsedSeconds = state.elapsedSeconds + dt;
  if (
    state.phase === "approaching" &&
    elapsedSeconds >=
      M10_STAFF_SERVICE_CONFIG.approachSeconds
  ) {
    return {
      phase: "opening_door",
      elapsedSeconds:
        elapsedSeconds -
        M10_STAFF_SERVICE_CONFIG.approachSeconds,
    };
  }

  if (
    state.phase === "opening_door" &&
    elapsedSeconds >=
      M10_STAFF_SERVICE_CONFIG.doorOpeningSeconds
  ) {
    return {
      phase: "door_open",
      elapsedSeconds:
        M10_STAFF_SERVICE_CONFIG.doorOpeningSeconds,
    };
  }

  if (state.phase === "door_open") {
    return state;
  }

  return {
    phase: state.phase,
    elapsedSeconds,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export interface StaffServicePose {
  visible: boolean;
  x: number;
  z: number;
  yawRadians: number;
  walkCycleRadians: number;
  doorOpenFraction: number;
}

export function staffServicePose(
  state: StaffServiceState,
): StaffServicePose {
  const c = M10_STAFF_SERVICE_CONFIG;

  if (state.phase === "hidden") {
    return {
      visible: false,
      x: c.startX,
      z: c.startZ,
      yawRadians: 0,
      walkCycleRadians: 0,
      doorOpenFraction: 0,
    };
  }

  const approachProgress =
    state.phase === "approaching"
      ? clamp01(state.elapsedSeconds / c.approachSeconds)
      : 1;
  const smoothApproach =
    approachProgress *
    approachProgress *
    (3 - 2 * approachProgress);
  const x =
    c.startX + (c.serviceX - c.startX) * smoothApproach;
  const z =
    c.startZ + (c.serviceZ - c.startZ) * smoothApproach;
  const approachYaw = Math.atan2(
    c.serviceX - c.startX,
    c.serviceZ - c.startZ,
  );
  const doorOpenFraction =
    state.phase === "opening_door"
      ? clamp01(
          state.elapsedSeconds / c.doorOpeningSeconds,
        )
      : state.phase === "door_open"
        ? 1
        : 0;

  return {
    visible: true,
    x,
    z,
    yawRadians:
      state.phase === "approaching"
        ? approachYaw
        : -Math.PI * 0.5,
    walkCycleRadians:
      state.phase === "approaching"
        ? state.elapsedSeconds * Math.PI * 3.2
        : 0,
    doorOpenFraction,
  };
}
