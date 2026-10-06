import { describe, expect, it } from "vitest";
import {
  AUTO_HIGH_DOWNGRADE_FPS,
  AUTO_MEDIUM_DOWNGRADE_FPS,
  AUTO_QUALITY_SUSTAIN_SECONDS,
  AUTO_QUALITY_WARMUP_SECONDS,
  AdaptiveRenderQualityController,
  DESKTOP_RENDER_QUALITY,
  HIGH_RENDER_QUALITY,
  LOW_RENDER_QUALITY,
  MEDIUM_RENDER_QUALITY,
  MOBILE_RENDER_QUALITY,
  chooseInitialRenderQualityProfile,
  chooseRenderQualityProfile,
  parseRenderQualityMode,
} from "./mobileRenderProfile";

describe("adaptive render quality profiles", () => {
  it("keeps high quality as the desktop auto default", () => {
    expect(chooseRenderQualityProfile(false)).toEqual(
      DESKTOP_RENDER_QUALITY,
    );
    expect(
      chooseInitialRenderQualityProfile("auto", false),
    ).toEqual(HIGH_RENDER_QUALITY);
    expect(HIGH_RENDER_QUALITY.pixelRatioCap).toBe(2);
    expect(HIGH_RENDER_QUALITY.shadowMapSize).toBe(1024);
    expect(HIGH_RENDER_QUALITY.shadowsEnabled).toBe(true);
    expect(HIGH_RENDER_QUALITY.softShadows).toBe(true);
    expect(
      HIGH_RENDER_QUALITY.cabinetLightCastsShadow,
    ).toBe(true);
    expect(
      HIGH_RENDER_QUALITY.arcadeBackgroundDetail,
    ).toBe("full");
  });

  it("starts touch-like auto devices at a safer medium budget", () => {
    expect(chooseRenderQualityProfile(true)).toEqual(
      MOBILE_RENDER_QUALITY,
    );
    expect(
      chooseInitialRenderQualityProfile("auto", true),
    ).toEqual(MEDIUM_RENDER_QUALITY);
    expect(MEDIUM_RENDER_QUALITY.pixelRatioCap)
      .toBeLessThan(HIGH_RENDER_QUALITY.pixelRatioCap);
    expect(
      MEDIUM_RENDER_QUALITY.cabinetLightCastsShadow,
    ).toBe(false);
    expect(
      MEDIUM_RENDER_QUALITY.arcadeBackgroundDetail,
    ).toBe("reduced");
  });

  it("provides a low profile that removes dynamic shadow cost", () => {
    expect(LOW_RENDER_QUALITY.pixelRatioCap).toBe(1);
    expect(LOW_RENDER_QUALITY.shadowsEnabled).toBe(false);
    expect(
      LOW_RENDER_QUALITY.arcadeBackgroundDetail,
    ).toBe("minimal");
  });

  it("parses explicit manual quality overrides", () => {
    expect(parseRenderQualityMode("?quality=high")).toBe("high");
    expect(parseRenderQualityMode("?quality=medium")).toBe("medium");
    expect(parseRenderQualityMode("?graphics=low")).toBe("low");
    expect(parseRenderQualityMode("?quality=unknown")).toBe("auto");
  });

  it("downgrades only after warmup plus sustained low FPS", () => {
    const controller =
      new AdaptiveRenderQualityController("auto", false);

    const run = (seconds: number, fps: number) => {
      let changed = null;
      for (let t = 0; t < seconds; t += 0.1) {
        changed = controller.update(fps, 0.1) ?? changed;
      }
      return changed;
    };

    run(AUTO_QUALITY_WARMUP_SECONDS, 60);
    const medium = run(
      AUTO_QUALITY_SUSTAIN_SECONDS + 0.2,
      AUTO_HIGH_DOWNGRADE_FPS - 8,
    );
    expect(medium?.id).toBe("medium");

    const low = run(
      AUTO_QUALITY_SUSTAIN_SECONDS + 0.2,
      AUTO_MEDIUM_DOWNGRADE_FPS - 8,
    );
    expect(low?.id).toBe("low");
    expect(controller.downgradeCount).toBe(2);
  });

  it("never auto-downgrades a manual quality selection", () => {
    const controller =
      new AdaptiveRenderQualityController("high", false);
    for (let i = 0; i < 200; i += 1) {
      expect(controller.update(10, 0.1)).toBeNull();
    }
    expect(controller.profile.id).toBe("high");
  });
});
