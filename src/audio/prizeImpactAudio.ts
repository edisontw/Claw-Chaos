export type PrizeImpactFamily =
  | "cardboard"
  | "plastic"
  | "rubber"
  | "soft";

export interface PrizeContactImpact {
  audioProfileId: string;
  forceNewtons: number;
}

export interface PrizeImpactCue {
  family: PrizeImpactFamily;
  intensity: number;
  oscillatorType: OscillatorType;
  startFrequencyHz: number;
  endFrequencyHz: number;
  oscillatorGain: number;
  noiseGain: number;
  noiseLowpassHz: number;
  durationSeconds: number;
}

const MIN_AUDIBLE_FORCE_NEWTONS = 1.5;
const FULL_SCALE_FORCE_NEWTONS = 14;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function resolvePrizeImpactFamily(
  audioProfileId: string,
): PrizeImpactFamily {
  switch (audioProfileId) {
    case "audio/cardboard":
      return "cardboard";
    case "audio/plastic":
      return "plastic";
    case "audio/rubber":
      return "rubber";
    case "audio/fabric":
    case "audio/plush":
    default:
      return "soft";
  }
}

export function derivePrizeImpactCue(
  impact: PrizeContactImpact,
): PrizeImpactCue | null {
  if (impact.forceNewtons < MIN_AUDIBLE_FORCE_NEWTONS) {
    return null;
  }

  const intensity = clamp01(
    (impact.forceNewtons - MIN_AUDIBLE_FORCE_NEWTONS) /
      (FULL_SCALE_FORCE_NEWTONS - MIN_AUDIBLE_FORCE_NEWTONS),
  );
  const family = resolvePrizeImpactFamily(
    impact.audioProfileId,
  );
  const strength = 0.35 + intensity * 0.65;

  switch (family) {
    case "cardboard":
      return {
        family,
        intensity,
        oscillatorType: "triangle",
        startFrequencyHz: 125 + intensity * 35,
        endFrequencyHz: 72,
        oscillatorGain: 0.018 * strength,
        noiseGain: 0.028 * strength,
        noiseLowpassHz: 920,
        durationSeconds: 0.085,
      };
    case "plastic":
      return {
        family,
        intensity,
        oscillatorType: "square",
        startFrequencyHz: 520 + intensity * 180,
        endFrequencyHz: 250,
        oscillatorGain: 0.013 * strength,
        noiseGain: 0.020 * strength,
        noiseLowpassHz: 2400,
        durationSeconds: 0.045,
      };
    case "rubber":
      return {
        family,
        intensity,
        oscillatorType: "sine",
        startFrequencyHz: 118 + intensity * 28,
        endFrequencyHz: 58,
        oscillatorGain: 0.029 * strength,
        noiseGain: 0.006 * strength,
        noiseLowpassHz: 430,
        durationSeconds: 0.080,
      };
    case "soft":
      return {
        family,
        intensity,
        oscillatorType: "sine",
        startFrequencyHz: 78 + intensity * 16,
        endFrequencyHz: 46,
        oscillatorGain: 0.010 * strength,
        noiseGain: 0.015 * strength,
        noiseLowpassHz: 310,
        durationSeconds: 0.095,
      };
  }
}
