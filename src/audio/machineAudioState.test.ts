import { describe, expect, it } from "vitest";
import {
  deriveMachineAudioFrame,
  type MachineAudioState,
} from "./machineAudioState";

function state(
  overrides: Partial<MachineAudioState> = {},
): MachineAudioState {
  return {
    gantrySpeedMetersPerSecond: 0,
    reelSpeedMetersPerSecond: 0,
    playPhase: "READY",
    ...overrides,
  };
}

describe("M08 machine audio state derivation", () => {
  it("scales continuous gantry and reel motor levels from real motion", () => {
    const frame = deriveMachineAudioFrame(
      null,
      state({
        gantrySpeedMetersPerSecond: 0.225,
        reelSpeedMetersPerSecond: 0.14,
      }),
    );

    expect(frame.gantryMotorLevel).toBeCloseTo(0.5, 6);
    expect(frame.reelMotorLevel).toBeCloseTo(0.5, 6);
    expect(frame.transients).toEqual([]);
  });

  it("uses a slightly higher reel pitch while lifting", () => {
    const down = deriveMachineAudioFrame(
      null,
      state({ reelSpeedMetersPerSecond: 0.14 }),
    );
    const up = deriveMachineAudioFrame(
      null,
      state({ reelSpeedMetersPerSecond: -0.14 }),
    );

    expect(up.reelMotorFrequencyHz)
      .toBeGreaterThan(down.reelMotorFrequencyHz);
  });

  it("emits DROP, CLOSE and RELEASE cues only on phase entry", () => {
    const drop = deriveMachineAudioFrame(
      state({ playPhase: "READY" }),
      state({ playPhase: "DESCENDING" }),
    );
    const close = deriveMachineAudioFrame(
      state({ playPhase: "DESCENDING" }),
      state({ playPhase: "CLOSING" }),
    );
    const release = deriveMachineAudioFrame(
      state({ playPhase: "RETURNING" }),
      state({ playPhase: "RELEASING" }),
    );
    const stable = deriveMachineAudioFrame(
      state({ playPhase: "CLOSING" }),
      state({ playPhase: "CLOSING" }),
    );

    expect(drop.transients).toContain("drop-start");
    expect(close.transients).toContain("claw-close");
    expect(release.transients).toContain("claw-release");
    expect(stable.transients).not.toContain("claw-close");
  });

  it("emits one mechanical stop cue after meaningful gantry motion", () => {
    const frame = deriveMachineAudioFrame(
      state({ gantrySpeedMetersPerSecond: 0.18 }),
      state({ gantrySpeedMetersPerSecond: 0.004 }),
    );

    expect(frame.transients).toContain("gantry-stop");
  });

  it("clamps motor loudness inputs to the normalized range", () => {
    const frame = deriveMachineAudioFrame(
      null,
      state({
        gantrySpeedMetersPerSecond: 2,
        reelSpeedMetersPerSecond: -2,
      }),
    );

    expect(frame.gantryMotorLevel).toBe(1);
    expect(frame.reelMotorLevel).toBe(1);
  });
});
