import { describe, expect, it } from "vitest";
import { M06_CABINET_CONFIG } from "./cabinetGeometry";
import {
  CABINET_INTERIOR_VISUAL_ONLY,
  createCabinetInteriorBoxSpecs,
} from "./cabinetInteriorVisual";

describe("Art Slice 2 cabinet interior", () => {
  it("keeps all added interior dressing visual-only", () => {
    expect(CABINET_INTERIOR_VISUAL_ONLY).toBe(true);
  });

  it("adds backing, trim, accents and ceiling light panels", () => {
    const ids = createCabinetInteriorBoxSpecs().map(
      (spec) => spec.id,
    );
    expect(ids).toContain("theme-a-interior-backdrop");
    expect(ids).toContain("theme-a-interior-accent-pink");
    expect(ids).toContain("theme-a-interior-accent-cyan");
    expect(ids).toContain("theme-a-ceiling-light-left");
    expect(ids).toContain("theme-a-ceiling-light-right");
    expect(ids.some((id) => id.includes("chute"))).toBe(false);
  });

  it("keeps dressing inside the existing cabinet envelope", () => {
    const c = M06_CABINET_CONFIG;
    for (const spec of createCabinetInteriorBoxSpecs()) {
      expect(
        Math.abs(spec.center.x) + spec.halfExtents.x,
      ).toBeLessThanOrEqual(c.interiorHalfX);
      expect(
        Math.abs(spec.center.z) + spec.halfExtents.z,
      ).toBeLessThanOrEqual(c.interiorHalfZ);
      expect(
        spec.center.y + spec.halfExtents.y,
      ).toBeLessThanOrEqual(c.floorY + c.playAreaHeight);
      expect(
        spec.center.y - spec.halfExtents.y,
      ).toBeGreaterThanOrEqual(c.playDeckY);
    }
  });

  it("keeps ceiling illumination shallow for aiming clearance", () => {
    const ceiling = createCabinetInteriorBoxSpecs().filter(
      (spec) => spec.id.includes("ceiling-light"),
    );
    expect(ceiling.length).toBeGreaterThanOrEqual(2);
    for (const spec of ceiling) {
      expect(spec.halfExtents.y).toBeLessThanOrEqual(0.01);
    }
  });
});
