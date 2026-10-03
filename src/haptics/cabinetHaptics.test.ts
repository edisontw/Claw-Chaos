import { describe, expect, it } from "vitest";
import {
  deriveCabinetHapticPulse,
  derivePrizeImpactHapticIntensity,
} from "./cabinetHaptics";

describe("M08 cabinet haptics", () => {
  it("keeps action pulses brief and moderate", () => {
    for (const cue of [
      "drop-start",
      "claw-close",
      "claw-release",
      "gantry-stop",
      "prize-impact",
    ] as const) {
      const pulse = deriveCabinetHapticPulse(cue);
      expect(pulse.durationMilliseconds).toBeLessThanOrEqual(50);
      expect(pulse.weakMagnitude).toBeLessThanOrEqual(0.4);
      expect(pulse.strongMagnitude).toBeLessThanOrEqual(0.25);
    }
  });

  it("makes claw close stronger than gantry stop", () => {
    const close = deriveCabinetHapticPulse("claw-close");
    const stop = deriveCabinetHapticPulse("gantry-stop");

    expect(close.weakMagnitude).toBeGreaterThan(stop.weakMagnitude);
    expect(close.strongMagnitude).toBeGreaterThan(stop.strongMagnitude);
  });

  it("scales prize impact haptics from real contact force", () => {
    expect(
      derivePrizeImpactHapticIntensity([]),
    ).toBe(0);

    const light = derivePrizeImpactHapticIntensity([
      {
        audioProfileId: "audio/plush",
        forceNewtons: 4,
      },
    ]);
    const hard = derivePrizeImpactHapticIntensity([
      {
        audioProfileId: "audio/rubber",
        forceNewtons: 20,
      },
    ]);

    expect(light).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(light);
    expect(hard).toBe(1);
  });

  it("clamps requested cue intensity to a safe normalized range", () => {
    const zero = deriveCabinetHapticPulse(
      "prize-impact",
      -1,
    );
    const full = deriveCabinetHapticPulse(
      "prize-impact",
      5,
    );

    expect(zero.weakMagnitude).toBe(0);
    expect(zero.strongMagnitude).toBe(0);
    expect(full.weakMagnitude).toBeLessThanOrEqual(0.4);
    expect(full.strongMagnitude).toBeLessThanOrEqual(0.25);
  });
});
