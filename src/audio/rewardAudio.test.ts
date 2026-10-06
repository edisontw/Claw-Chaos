import { describe, expect, it } from "vitest";
import { getRewardAudioCue } from "./rewardAudio";

describe("M11 reward audio cue", () => {
  it("keeps the ordinary win jingle short but clearly audible", () => {
    const cue = getRewardAudioCue("prize");

    expect(cue.notes).toHaveLength(3);
    expect(cue.notes.at(-1)!.offsetSeconds).toBeLessThan(0.3);
    expect(
      Math.min(...cue.notes.map((note) => note.primaryGain)),
    ).toBeGreaterThanOrEqual(0.09);
    expect(
      cue.notes.every((note) => note.harmonicGain > 0),
    ).toBe(true);
  });

  it("uses a longer stronger fanfare for machine clear", () => {
    const prize = getRewardAudioCue("prize");
    const clear = getRewardAudioCue("clear");

    expect(clear.notes.length).toBeGreaterThan(
      prize.notes.length,
    );
    expect(
      Math.max(...clear.notes.map((note) => note.primaryGain)),
    ).toBeGreaterThan(
      Math.max(...prize.notes.map((note) => note.primaryGain)),
    );
    expect(clear.notes.at(-1)!.frequencyHz).toBeGreaterThan(
      prize.notes.at(-1)!.frequencyHz,
    );
  });
});
