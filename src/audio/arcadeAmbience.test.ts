import { describe, expect, it } from "vitest";
import {
  ambiencePeakContinuousGain,
  M08_ARCADE_AMBIENCE,
} from "./arcadeAmbience";

describe("M08 arcade ambience profile", () => {
  it("keeps ambience materially quieter than foreground machine audio", () => {
    expect(ambiencePeakContinuousGain()).toBeLessThan(0.015);
    expect(M08_ARCADE_AMBIENCE.roomNoiseGain).toBeLessThan(0.005);
  });

  it("keeps the cabinet hum in a low electrical/fan-like range", () => {
    expect(M08_ARCADE_AMBIENCE.cabinetHumFundamentalHz)
      .toBeGreaterThanOrEqual(45);
    expect(M08_ARCADE_AMBIENCE.cabinetHumFundamentalHz)
      .toBeLessThanOrEqual(70);
    expect(M08_ARCADE_AMBIENCE.cabinetHumHarmonicHz)
      .toBeGreaterThan(M08_ARCADE_AMBIENCE.cabinetHumFundamentalHz);
  });

  it("keeps distant room noise band-limited away from sub-bass and harsh highs", () => {
    expect(M08_ARCADE_AMBIENCE.roomHighpassHz)
      .toBeGreaterThanOrEqual(120);
    expect(M08_ARCADE_AMBIENCE.roomLowpassHz)
      .toBeLessThanOrEqual(2200);
    expect(M08_ARCADE_AMBIENCE.roomLowpassHz)
      .toBeGreaterThan(M08_ARCADE_AMBIENCE.roomHighpassHz);
  });

  it("uses slow, shallow room modulation rather than an audible rhythmic pulse", () => {
    expect(M08_ARCADE_AMBIENCE.roomModulationHz).toBeLessThan(0.2);
    expect(M08_ARCADE_AMBIENCE.roomModulationDepth)
      .toBeLessThan(M08_ARCADE_AMBIENCE.roomNoiseGain * 0.5);
  });
});
