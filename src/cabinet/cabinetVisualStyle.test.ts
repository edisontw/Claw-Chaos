import { describe, expect, it } from "vitest";
import { M06_CABINET_CONFIG } from "./cabinetGeometry";
import {
  M08_CABINET_VISUAL_STYLE,
  M08_GANTRY_VISUAL_STYLE,
  createCabinetFrameTrimSpecs,
  createCabinetLedStripSpecs,
} from "./cabinetVisualStyle";

describe("M08 visual-only cabinet realism configuration", () => {
  it("keeps glass subtle enough for aiming", () => {
    expect(M08_CABINET_VISUAL_STYLE.glass.opacity).toBeLessThanOrEqual(0.10);
    expect(M08_CABINET_VISUAL_STYLE.glass.transmission).toBeGreaterThan(0);
    expect(M08_CABINET_VISUAL_STYLE.glass.roughness).toBeGreaterThan(0);
    expect(M08_CABINET_VISUAL_STYLE.glass.edgeOpacity).toBeLessThanOrEqual(0.10);
    expect(M08_CABINET_VISUAL_STYLE.glass.roughness).toBeGreaterThanOrEqual(0.8);
    expect(M08_CABINET_VISUAL_STYLE.glass.clearcoat).toBe(0);
  });

  it("keeps cabinet highlights matte and LEDs subdued", () => {
    expect(M08_CABINET_VISUAL_STYLE.frame.roughness).toBeGreaterThanOrEqual(0.6);
    expect(M08_CABINET_VISUAL_STYLE.frame.clearcoat).toBe(0);
    expect(M08_CABINET_VISUAL_STYLE.controlPanel.clearcoat).toBe(0);
    expect(M08_CABINET_VISUAL_STYLE.led.emissiveIntensity).toBeLessThanOrEqual(1);
  });

  it("places LED strips inside the upper cabinet envelope", () => {
    const strips = createCabinetLedStripSpecs();

    expect(strips).toHaveLength(3);
    for (const strip of strips) {
      expect(strip.center.y).toBeGreaterThan(
        M06_CABINET_CONFIG.playDeckY + 0.8,
      );
      expect(
        Math.abs(strip.center.x) + strip.halfExtents.x,
      ).toBeLessThanOrEqual(M06_CABINET_CONFIG.interiorHalfX);
      expect(
        Math.abs(strip.center.z) + strip.halfExtents.z,
      ).toBeLessThanOrEqual(M06_CABINET_CONFIG.interiorHalfZ);
    }
  });

  it("keeps frame trim on the existing glass boundary rather than adding a chute rim", () => {
    const trim = createCabinetFrameTrimSpecs();
    const ids = trim.map((part) => part.id);

    expect(ids).toContain("frame-front-left-post");
    expect(ids).toContain("frame-front-right-post");
    expect(ids).toContain("frame-front-header");
    expect(ids.some((id) => id.includes("chute"))).toBe(false);
  });

  it("defines visible but compact bridge and winch detail", () => {
    expect(M08_GANTRY_VISUAL_STYLE.bridgeBeamHalfX).toBeLessThan(0.03);
    expect(M08_GANTRY_VISUAL_STYLE.winchDrumRadius).toBeGreaterThan(0.015);
    expect(M08_GANTRY_VISUAL_STYLE.winchFlangeRadius)
      .toBeGreaterThan(M08_GANTRY_VISUAL_STYLE.winchDrumRadius);
    expect(M08_GANTRY_VISUAL_STYLE.pulleyRadius).toBeLessThan(0.02);
  });
});
