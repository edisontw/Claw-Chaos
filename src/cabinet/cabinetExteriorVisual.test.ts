import { describe, expect, it } from "vitest";
import { M06_CABINET_CONFIG } from "./cabinetGeometry";
import {
  CABINET_BRAND_NAME,
  CABINET_EXTERIOR_VISUAL_ONLY,
  createCabinetExteriorBoxSpecs,
} from "./cabinetExteriorVisual";

describe("Art Slice 1 cabinet exterior", () => {
  it("adds a production-machine silhouette without changing physics geometry", () => {
    expect(CABINET_EXTERIOR_VISUAL_ONLY).toBe(true);
    const specs = createCabinetExteriorBoxSpecs();
    const ids = specs.map((spec) => spec.id);

    expect(ids).toContain("theme-a-header-shell");
    expect(ids).toContain("theme-a-marquee-face");
    expect(ids).toContain("theme-a-control-panel-deck");
    expect(ids).toContain("theme-a-payment-panel");
    expect(ids).toContain("theme-a-prize-output-door");
    expect(ids).toContain("theme-a-access-panel");
    expect(
      ids.filter((id) => id.includes("vent-slat")),
    ).toHaveLength(5);
    expect(ids.some((id) => id.includes("chute-rim"))).toBe(false);
  });

  it("keeps the marquee outside the established play volume", () => {
    const header = createCabinetExteriorBoxSpecs().find(
      (spec) => spec.id === "theme-a-header-shell",
    );
    expect(header).toBeDefined();
    expect(
      header!.center.y - header!.halfExtents.y,
    ).toBeGreaterThanOrEqual(
      M06_CABINET_CONFIG.floorY +
        M06_CABINET_CONFIG.playAreaHeight,
    );
  });

  it("keeps player-facing hardware in front of the physical glass", () => {
    const c = M06_CABINET_CONFIG;
    const glassFront =
      c.interiorHalfZ + c.wallHalfThickness;
    for (const id of [
      "theme-a-control-panel-deck",
      "theme-a-payment-panel",
      "theme-a-prize-output-door",
    ]) {
      const spec = createCabinetExteriorBoxSpecs().find(
        (entry) => entry.id === id,
      );
      expect(spec).toBeDefined();
      expect(spec!.center.z).toBeGreaterThan(glassFront);
    }
  });

  it("uses original Claw Chaos branding", () => {
    expect(CABINET_BRAND_NAME).toBe("CLAW CHAOS");
  });
});
