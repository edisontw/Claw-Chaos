import type { CabinetRewardKind } from "../cabinet/cabinetRewardFeedback";

export interface RewardAudioNote {
  frequencyHz: number;
  offsetSeconds: number;
  durationSeconds: number;
  primaryGain: number;
  harmonicGain: number;
}

export interface RewardAudioCue {
  notes: readonly RewardAudioNote[];
}

export function getRewardAudioCue(
  kind: CabinetRewardKind,
): RewardAudioCue {
  if (kind === "clear") {
    return {
      notes: [
        {
          frequencyHz: 523.25,
          offsetSeconds: 0.00,
          durationSeconds: 0.18,
          primaryGain: 0.105,
          harmonicGain: 0.040,
        },
        {
          frequencyHz: 659.25,
          offsetSeconds: 0.14,
          durationSeconds: 0.18,
          primaryGain: 0.110,
          harmonicGain: 0.042,
        },
        {
          frequencyHz: 783.99,
          offsetSeconds: 0.28,
          durationSeconds: 0.20,
          primaryGain: 0.115,
          harmonicGain: 0.044,
        },
        {
          frequencyHz: 1046.50,
          offsetSeconds: 0.44,
          durationSeconds: 0.38,
          primaryGain: 0.125,
          harmonicGain: 0.048,
        },
      ],
    };
  }

  return {
    notes: [
      {
        frequencyHz: 659.25,
        offsetSeconds: 0.00,
        durationSeconds: 0.15,
        primaryGain: 0.095,
        harmonicGain: 0.036,
      },
      {
        frequencyHz: 783.99,
        offsetSeconds: 0.11,
        durationSeconds: 0.15,
        primaryGain: 0.100,
        harmonicGain: 0.038,
      },
      {
        frequencyHz: 987.77,
        offsetSeconds: 0.22,
        durationSeconds: 0.26,
        primaryGain: 0.110,
        harmonicGain: 0.042,
      },
    ],
  };
}
