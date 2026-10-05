import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISUAL_THEME,
  DEFAULT_VISUAL_THEME_ID,
  THEME_A_MODERN_JAPANESE_ARCADE,
  VISUAL_THEME_CATALOG,
  getVisualTheme,
  parseVisualThemeId,
} from "./visualTheme";

describe("visual theme architecture", () => {
  it("keeps all four planned visual directions in one catalog", () => {
    expect(VISUAL_THEME_CATALOG.map((theme) => theme.id)).toEqual([
      "modern-japanese-arcade",
      "cute-pastel-prize-shop",
      "futuristic-neon-arcade",
      "premium-retro-modern",
    ]);
    expect(
      VISUAL_THEME_CATALOG.filter((theme) => theme.implemented)
        .map((theme) => theme.id),
    ).toEqual(["modern-japanese-arcade"]);
  });

  it("uses Theme A as the implemented default and safe URL fallback", () => {
    expect(DEFAULT_VISUAL_THEME_ID).toBe(
      "modern-japanese-arcade",
    );
    expect(DEFAULT_VISUAL_THEME.id).toBe(
      "modern-japanese-arcade",
    );
    expect(
      parseVisualThemeId("?theme=modern-japanese-arcade"),
    ).toBe("modern-japanese-arcade");
    expect(
      parseVisualThemeId("?theme=futuristic-neon-arcade"),
    ).toBe("modern-japanese-arcade");
    expect(parseVisualThemeId("")).toBe(
      "modern-japanese-arcade",
    );
  });

  it("centralizes machine, environment and staff palettes", () => {
    const theme = getVisualTheme();
    expect(theme.machine.exterior.body.color).toBe(0xf7f8fb);
    expect(theme.machine.exterior.ledPrimary.emissiveIntensity)
      .toBeLessThanOrEqual(1);
    expect(theme.machine.exterior.ledSecondary.emissiveIntensity)
      .toBeLessThanOrEqual(1);
    expect(theme.machine.glass.opacity).toBeLessThanOrEqual(0.10);
    expect(theme.machine.glass.roughness).toBeGreaterThanOrEqual(0.8);
    expect(theme.machine.interior.gantryRail.color).toBeTypeOf("number");
    expect(theme.machine.interior.gantryBridge.color).toBeTypeOf("number");
    expect(theme.machine.interior.gantryCarriage.color).toBeTypeOf("number");
    expect(theme.machine.interior.winchMetal.color).toBeTypeOf("number");
    expect(theme.machine.interior.clawChrome.color).toBeTypeOf("number");
    expect(theme.machine.interior.clawTip.color).toBeTypeOf("number");
    expect(theme.machine.interior.lighting.intensity).toBeGreaterThan(0);
    expect(theme.environment.backgroundColor).toBeTypeOf("number");
    expect(theme.environment.floor.color).toBeTypeOf("number");
    expect(theme.environment.wall.color).toBeTypeOf("number");
    expect(theme.environment.signage.emissiveIntensity)
      .toBeLessThanOrEqual(1);
    expect(theme.environment.neighboringMachineBody.color)
      .toBeTypeOf("number");
    expect(theme.environment.ceilingFixture.color)
      .toBeTypeOf("number");
    expect(theme.environment.backgroundEmissive.emissiveIntensity)
      .toBeLessThanOrEqual(1);
    expect(theme.staff.uniformPrimaryColor).toBeTypeOf("number");
    expect(theme.staff.trimColor).not.toBe(
      theme.staff.uniformPrimaryColor,
    );
  });

  it("keeps the named Theme A preset stable", () => {
    expect(THEME_A_MODERN_JAPANESE_ARCADE.label).toBe(
      "Modern Japanese Arcade",
    );
    expect(
      THEME_A_MODERN_JAPANESE_ARCADE.environment.colorTemperature,
    ).toBe("neutral");
  });
});
