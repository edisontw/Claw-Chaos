export type StaffServicePhase =
  | "hidden"
  | "approaching"
  | "opening_door"
  | "door_open"
  | "closing_door"
  | "departing";

export interface StaffServiceState {
  phase: StaffServicePhase;
  elapsedSeconds: number;
}

export const M10_STAFF_SERVICE_CONFIG = {
  approachSeconds: 2.6,
  doorOpeningSeconds: 0.9,
  doorClosingSeconds: 0.8,
  departureSeconds: 2.2,
  startX: 1.72,
  startZ: 0.72,
  serviceX: 0.84,
  serviceZ: 0.22,
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
  closeRequested: boolean,
  stepSeconds: number,
): StaffServiceState {
  const dt = Math.max(0, stepSeconds);

  if (!servicePaused) {
    return state;
  }

  if (state.phase === "hidden") {
    if (closeRequested) {
      return state;
    }
    return {
      phase: "approaching",
      elapsedSeconds: 0,
    };
  }

  if (
    state.phase === "door_open" &&
    closeRequested
  ) {
    return {
      phase: "closing_door",
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

  if (
    state.phase === "closing_door" &&
    elapsedSeconds >=
      M10_STAFF_SERVICE_CONFIG.doorClosingSeconds
  ) {
    return {
      phase: "departing",
      elapsedSeconds:
        elapsedSeconds -
        M10_STAFF_SERVICE_CONFIG.doorClosingSeconds,
    };
  }

  if (
    state.phase === "departing" &&
    elapsedSeconds >=
      M10_STAFF_SERVICE_CONFIG.departureSeconds
  ) {
    return createStaffServiceState();
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

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
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
      ? smoothstep(
          state.elapsedSeconds / c.approachSeconds,
        )
      : 1;
  const departureProgress =
    state.phase === "departing"
      ? smoothstep(
          state.elapsedSeconds / c.departureSeconds,
        )
      : 0;

  const x =
    state.phase === "departing"
      ? c.serviceX +
        (c.startX - c.serviceX) *
          departureProgress
      : c.startX +
        (c.serviceX - c.startX) *
          approachProgress;
  const z =
    state.phase === "departing"
      ? c.serviceZ +
        (c.startZ - c.serviceZ) *
          departureProgress
      : c.startZ +
        (c.serviceZ - c.startZ) *
          approachProgress;

  const approachYaw = Math.atan2(
    c.serviceX - c.startX,
    c.serviceZ - c.startZ,
  );
  const departureYaw = Math.atan2(
    c.startX - c.serviceX,
    c.startZ - c.serviceZ,
  );

  const doorOpenFraction =
    state.phase === "opening_door"
      ? clamp01(
          state.elapsedSeconds / c.doorOpeningSeconds,
        )
      : state.phase === "door_open"
        ? 1
        : state.phase === "closing_door"
          ? 1 -
            clamp01(
              state.elapsedSeconds /
                c.doorClosingSeconds,
            )
          : 0;

  const walking =
    state.phase === "approaching" ||
    state.phase === "departing";

  return {
    visible: true,
    x,
    z,
    yawRadians:
      state.phase === "approaching"
        ? approachYaw
        : state.phase === "departing"
          ? departureYaw
          : -Math.PI * 0.5,
    walkCycleRadians: walking
      ? state.elapsedSeconds * Math.PI * 3.2
      : 0,
    doorOpenFraction,
  };
}
