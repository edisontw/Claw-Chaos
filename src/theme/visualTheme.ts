export type VisualThemeId =
  | "modern-japanese-arcade"
  | "cute-pastel-prize-shop"
  | "futuristic-neon-arcade"
  | "premium-retro-modern";

export type ImplementedVisualThemeId =
  "modern-japanese-arcade";

export interface SurfaceMaterialToken {
  color: number;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
}

export interface EmissiveMaterialToken
  extends SurfaceMaterialToken {
  emissive: number;
  emissiveIntensity: number;
}

export interface GlassMaterialToken {
  color: number;
  opacity: number;
  roughness: number;
  transmission: number;
  ior: number;
  thicknessMeters: number;
  clearcoat: number;
  clearcoatRoughness: number;
  edgeOpacity: number;
}

export interface MachineVisualTheme {
  exterior: {
    body: SurfaceMaterialToken;
    bodySecondary: SurfaceMaterialToken;
    frame: SurfaceMaterialToken;
    metalTrim: SurfaceMaterialToken;
    controlPanel: SurfaceMaterialToken;
    joystickBase: SurfaceMaterialToken;
    joystickStick: SurfaceMaterialToken;
    joystickBall: SurfaceMaterialToken;
    actionButton: EmissiveMaterialToken;
    paymentPanel: SurfaceMaterialToken;
    prizeDoor: SurfaceMaterialToken;
    accessPanel: SurfaceMaterialToken;
    vent: SurfaceMaterialToken;
    screw: SurfaceMaterialToken;
    marquee: SurfaceMaterialToken;
    ledPrimary: EmissiveMaterialToken;
    ledSecondary: EmissiveMaterialToken;
  };
  glass: GlassMaterialToken;
  interior: {
    backdrop: SurfaceMaterialToken;
    floor: SurfaceMaterialToken;
    playDeck: SurfaceMaterialToken;
    chute: SurfaceMaterialToken;
    gantryRail: SurfaceMaterialToken;
    gantryBridge: SurfaceMaterialToken;
    gantryCarriage: SurfaceMaterialToken;
    winchMetal: SurfaceMaterialToken;
    winchDark: SurfaceMaterialToken;
    clawChrome: SurfaceMaterialToken;
    clawBrushed: SurfaceMaterialToken;
    clawBand: SurfaceMaterialToken;
    clawTip: SurfaceMaterialToken;
    cable: SurfaceMaterialToken;
    serviceWireColor: number;
    lighting: {
      color: number;
      intensity: number;
      distance: number;
      decay: number;
    };
  };
}

export interface EnvironmentVisualTheme {
  backgroundColor: number;
  floor: SurfaceMaterialToken;
  wall: SurfaceMaterialToken;
  signage: EmissiveMaterialToken;
  neighboringMachineBody: SurfaceMaterialToken;
  ceilingFixture: SurfaceMaterialToken;
  backgroundEmissive: EmissiveMaterialToken;
  hemisphere: {
    skyColor: number;
    groundColor: number;
    intensity: number;
  };
  keyLight: {
    color: number;
    intensity: number;
  };
  colorTemperature: "warm" | "neutral" | "cool";
}

export interface StaffVisualTheme {
  skinColor: number;
  hairColor: number;
  hairAccessoryColor: number;
  uniformPrimaryColor: number;
  uniformSecondaryColor: number;
  blouseColor: number;
  skirtColor: number;
  trimColor: number;
  badgeColor: number;
  stockingColor: number;
  shoeColor: number;
}

export interface VisualTheme {
  id: ImplementedVisualThemeId;
  label: string;
  machine: MachineVisualTheme;
  environment: EnvironmentVisualTheme;
  staff: StaffVisualTheme;
}

const surface = (
  color: number,
  roughness: number,
  metalness: number,
  clearcoat = 0,
  clearcoatRoughness = 1,
): SurfaceMaterialToken => ({
  color,
  roughness,
  metalness,
  clearcoat,
  clearcoatRoughness,
});

const emissive = (
  color: number,
  emissiveColor: number,
  emissiveIntensity: number,
  roughness = 0.34,
  metalness = 0.04,
): EmissiveMaterialToken => ({
  ...surface(color, roughness, metalness, 0, 1),
  emissive: emissiveColor,
  emissiveIntensity,
});

export const THEME_A_MODERN_JAPANESE_ARCADE: VisualTheme = {
  id: "modern-japanese-arcade",
  label: "Modern Japanese Arcade",
  machine: {
    exterior: {
      body: surface(0xf7f8fb, 0.38, 0.03, 0.32, 0.28),
      bodySecondary: surface(0xe9edf2, 0.46, 0.03, 0.18, 0.36),
      frame: surface(0xf1f3f6, 0.64, 0.08, 0, 1),
      metalTrim: surface(0xb9c3ce, 0.36, 0.56, 0.10, 0.42),
      controlPanel: surface(0xf5f7fa, 0.62, 0.06, 0, 1),
      joystickBase: surface(0x3b4552, 0.54, 0.22),
      joystickStick: surface(0xaeb9c5, 0.38, 0.62),
      joystickBall: surface(0x63cede, 0.42, 0.05, 0.12, 0.34),
      actionButton: emissive(
        0xf28aa9,
        0x7c2442,
        0.62,
        0.46,
        0.04,
      ),
      paymentPanel: surface(0x28323e, 0.50, 0.24),
      prizeDoor: surface(0x1f2934, 0.58, 0.16),
      accessPanel: surface(0xe4e9ef, 0.52, 0.04),
      vent: surface(0x65717f, 0.66, 0.18),
      screw: surface(0xaeb7c1, 0.42, 0.58),
      marquee: surface(0xffffff, 0.40, 0.02, 0.24, 0.30),
      ledPrimary: emissive(
        0xffd4e2,
        0xff89b1,
        0.92,
        0.30,
        0.02,
      ),
      ledSecondary: emissive(
        0xd1f8ff,
        0x63d9ea,
        0.92,
        0.30,
        0.02,
      ),
    },
    glass: {
      color: 0xd8f5ff,
      opacity: 0.045,
      roughness: 0.82,
      transmission: 0.025,
      ior: 1.45,
      thicknessMeters: 0.006,
      clearcoat: 0,
      clearcoatRoughness: 1,
      edgeOpacity: 0.09,
    },
    interior: {
      backdrop: surface(0xf4f6f8, 0.70, 0.02),
      floor: surface(0x65707c, 0.92, 0.02),
      playDeck: surface(0xffffff, 0.88, 0.01),
      chute: surface(0xaeb9c4, 0.58, 0.38),
      gantryRail: surface(0x8e99a5, 0.58, 0.42),
      gantryBridge: surface(0xaab5c0, 0.56, 0.40),
      gantryCarriage: surface(0xd2d8df, 0.56, 0.38),
      winchMetal: surface(0xbfc8d1, 0.54, 0.46),
      winchDark: surface(0x27313b, 0.52, 0.52),
      clawChrome: surface(0xb7c2cc, 0.30, 0.36),
      clawBrushed: surface(0x8795a3, 0.40, 0.32),
      clawBand: surface(0x26313b, 0.56, 0.22),
      clawTip: surface(0x36424e, 0.58, 0.20),
      cable: surface(0x3c4650, 0.70, 0.38),
      serviceWireColor: 0x252c34,
      lighting: {
        color: 0xfff7ef,
        intensity: 4.4,
        distance: 2.25,
        decay: 1.7,
      },
    },
  },
  environment: {
    backgroundColor: 0xdce5ec,
    floor: surface(0xe9edf1, 0.34, 0.04, 0.16, 0.34),
    wall: surface(0xf4f2ef, 0.72, 0.01),
    signage: emissive(0xf7f9fb, 0x8addeb, 0.70, 0.42, 0.02),
    neighboringMachineBody: surface(0xf2f4f7, 0.52, 0.04),
    ceilingFixture: surface(0xf7f8fa, 0.58, 0.04),
    backgroundEmissive: emissive(
      0xffd8e5,
      0xff9aba,
      0.58,
      0.42,
      0.02,
    ),
    hemisphere: {
      skyColor: 0xffffff,
      groundColor: 0xb7c4cf,
      intensity: 1.55,
    },
    keyLight: {
      color: 0xfff5ec,
      intensity: 2.55,
    },
    colorTemperature: "neutral",
  },
  staff: {
    skinColor: 0xf1c7a8,
    hairColor: 0x2a1d1a,
    hairAccessoryColor: 0xe98daa,
    uniformPrimaryColor: 0x263a54,
    uniformSecondaryColor: 0x364f6b,
    blouseColor: 0xf7f3ef,
    skirtColor: 0x223149,
    trimColor: 0xe98daa,
    badgeColor: 0xdabf72,
    stockingColor: 0x292a30,
    shoeColor: 0x15171b,
  },
};

export const VISUAL_THEME_CATALOG = [
  {
    id: "modern-japanese-arcade",
    label: "Modern Japanese Arcade",
    implemented: true,
  },
  {
    id: "cute-pastel-prize-shop",
    label: "Cute Pastel Prize Shop",
    implemented: false,
  },
  {
    id: "futuristic-neon-arcade",
    label: "Futuristic Neon Arcade",
    implemented: false,
  },
  {
    id: "premium-retro-modern",
    label: "Premium Retro-Modern",
    implemented: false,
  },
] as const satisfies ReadonlyArray<{
  id: VisualThemeId;
  label: string;
  implemented: boolean;
}>;

export const DEFAULT_VISUAL_THEME_ID:
  ImplementedVisualThemeId =
  "modern-japanese-arcade";

export const DEFAULT_VISUAL_THEME =
  THEME_A_MODERN_JAPANESE_ARCADE;

export function parseVisualThemeId(
  search: string,
): ImplementedVisualThemeId {
  const requested = new URLSearchParams(search).get("theme");
  return requested === "modern-japanese-arcade"
    ? requested
    : DEFAULT_VISUAL_THEME_ID;
}

export function getVisualTheme(
  id: ImplementedVisualThemeId = DEFAULT_VISUAL_THEME_ID,
): VisualTheme {
  switch (id) {
    case "modern-japanese-arcade":
      return THEME_A_MODERN_JAPANESE_ARCADE;
  }
}
