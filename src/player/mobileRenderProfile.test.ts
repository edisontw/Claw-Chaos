import { describe, expect, it } from "vitest";
import {
  DESKTOP_RENDER_QUALITY,
  MOBILE_RENDER_QUALITY,
  chooseRenderQualityProfile,
} from "./mobileRenderProfile";

describe("mobile render quality profile", () => {
  it("keeps desktop presentation at full art detail", () => {
    expect(chooseRenderQualityProfile(false)).toEqual(
      DESKTOP_RENDER_QUALITY,
    );
    expect(DESKTOP_RENDER_QUALITY.pixelRatioCap).toBe(2);
    expect(DESKTOP_RENDER_QUALITY.shadowMapSize).toBe(1024);
    expect(
      DESKTOP_RENDER_QUALITY.cabinetLightCastsShadow,
    ).toBe(true);
    expect(
      DESKTOP_RENDER_QUALITY.cabinetLightShadowMapSize,
    ).toBe(512);
    expect(
      DESKTOP_RENDER_QUALITY.arcadeBackgroundDetail,
    ).toBe("full");
  });

  it("uses a lower mobile GPU budget without changing physics", () => {
    expect(chooseRenderQualityProfile(true)).toEqual(
      MOBILE_RENDER_QUALITY,
    );
    expect(MOBILE_RENDER_QUALITY.pixelRatioCap).toBe(1.5);
    expect(MOBILE_RENDER_QUALITY.shadowMapSize).toBe(512);
    expect(
      MOBILE_RENDER_QUALITY.cabinetLightCastsShadow,
    ).toBe(false);
    expect(
      MOBILE_RENDER_QUALITY.cabinetLightShadowMapSize,
    ).toBeLessThanOrEqual(256);
    expect(
      MOBILE_RENDER_QUALITY.arcadeBackgroundDetail,
    ).toBe("reduced");
  });
});
