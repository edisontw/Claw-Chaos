import { describe, expect, it } from "vitest";
import {
  derivePrizeImpactCue,
  resolvePrizeImpactFamily,
} from "./prizeImpactAudio";

describe("M08 prize impact audio model", () => {
  it("maps catalog audio profiles to distinct audible families", () => {
    expect(resolvePrizeImpactFamily("audio/cardboard"))
      .toBe("cardboard");
    expect(resolvePrizeImpactFamily("audio/plastic"))
      .toBe("plastic");
    expect(resolvePrizeImpactFamily("audio/rubber"))
      .toBe("rubber");
    expect(resolvePrizeImpactFamily("audio/fabric"))
      .toBe("soft");
    expect(resolvePrizeImpactFamily("audio/plush"))
      .toBe("soft");
  });

  it("ignores resting-scale contact below the impact threshold", () => {
    expect(
      derivePrizeImpactCue({
        audioProfileId: "audio/plush",
        forceNewtons: 1.49,
      }),
    ).toBeNull();
  });

  it("makes harder impacts stronger without exceeding normalized intensity", () => {
    const light = derivePrizeImpactCue({
      audioProfileId: "audio/cardboard",
      forceNewtons: 3,
    });
    const hard = derivePrizeImpactCue({
      audioProfileId: "audio/cardboard",
      forceNewtons: 20,
    });

    expect(light).not.toBeNull();
    expect(hard).not.toBeNull();
    expect(hard!.intensity).toBeGreaterThan(light!.intensity);
    expect(hard!.intensity).toBe(1);
    expect(hard!.noiseGain).toBeGreaterThan(light!.noiseGain);
  });

  it("keeps rigid plastic brighter and shorter than soft plush/fabric", () => {
    const plastic = derivePrizeImpactCue({
      audioProfileId: "audio/plastic",
      forceNewtons: 8,
    });
    const soft = derivePrizeImpactCue({
      audioProfileId: "audio/plush",
      forceNewtons: 8,
    });

    expect(plastic).not.toBeNull();
    expect(soft).not.toBeNull();
    expect(plastic!.startFrequencyHz)
      .toBeGreaterThan(soft!.startFrequencyHz);
    expect(plastic!.noiseLowpassHz)
      .toBeGreaterThan(soft!.noiseLowpassHz);
    expect(plastic!.durationSeconds)
      .toBeLessThan(soft!.durationSeconds);
  });

  it("gives rubber a lower thump than plastic at the same force", () => {
    const rubber = derivePrizeImpactCue({
      audioProfileId: "audio/rubber",
      forceNewtons: 8,
    });
    const plastic = derivePrizeImpactCue({
      audioProfileId: "audio/plastic",
      forceNewtons: 8,
    });

    expect(rubber).not.toBeNull();
    expect(plastic).not.toBeNull();
    expect(rubber!.startFrequencyHz)
      .toBeLessThan(plastic!.startFrequencyHz);
  });
});
