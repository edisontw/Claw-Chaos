import type { M04PlayPhase } from "../scenes/m04PlayCycle";

export interface MachineAudioState {
  gantrySpeedMetersPerSecond: number;
  reelSpeedMetersPerSecond: number;
  playPhase: M04PlayPhase;
}

export type MachineAudioTransient =
  | "drop-start"
  | "claw-close"
  | "claw-release"
  | "gantry-stop";

export interface MachineAudioFrame {
  gantryMotorLevel: number;
  gantryMotorFrequencyHz: number;
  reelMotorLevel: number;
  reelMotorFrequencyHz: number;
  transients: MachineAudioTransient[];
}

const GANTRY_MAX_SPEED_METERS_PER_SECOND = 0.45;
const REEL_MAX_SPEED_METERS_PER_SECOND = 0.28;
const GANTRY_STOP_PREVIOUS_THRESHOLD = 0.06;
const GANTRY_STOP_CURRENT_THRESHOLD = 0.012;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function deriveMachineAudioFrame(
  previous: MachineAudioState | null,
  current: MachineAudioState,
): MachineAudioFrame {
  const gantryLevel = clamp01(
    current.gantrySpeedMetersPerSecond /
      GANTRY_MAX_SPEED_METERS_PER_SECOND,
  );
  const reelLevel = clamp01(
    Math.abs(current.reelSpeedMetersPerSecond) /
      REEL_MAX_SPEED_METERS_PER_SECOND,
  );
  const transients: MachineAudioTransient[] = [];

  if (previous) {
    if (
      previous.playPhase !== "DESCENDING" &&
      current.playPhase === "DESCENDING"
    ) {
      transients.push("drop-start");
    }
    if (
      previous.playPhase !== "CLOSING" &&
      current.playPhase === "CLOSING"
    ) {
      transients.push("claw-close");
    }
    if (
      previous.playPhase !== "RELEASING" &&
      current.playPhase === "RELEASING"
    ) {
      transients.push("claw-release");
    }
    if (
      previous.gantrySpeedMetersPerSecond >
        GANTRY_STOP_PREVIOUS_THRESHOLD &&
      current.gantrySpeedMetersPerSecond <
        GANTRY_STOP_CURRENT_THRESHOLD
    ) {
      transients.push("gantry-stop");
    }
  }

  return {
    gantryMotorLevel: gantryLevel,
    gantryMotorFrequencyHz: 82 + gantryLevel * 54,
    reelMotorLevel: reelLevel,
    reelMotorFrequencyHz:
      145 +
      reelLevel * 58 +
      (current.reelSpeedMetersPerSecond < 0 ? 18 : 0),
    transients,
  };
}
