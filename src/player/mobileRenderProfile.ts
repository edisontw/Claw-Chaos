export type ArcadeBackgroundDetail =
  | "full"
  | "reduced"
  | "minimal";

export type RenderQualityLevel =
  | "high"
  | "medium"
  | "low";

export type RenderQualityMode =
  | "auto"
  | RenderQualityLevel;

export interface RenderQualityProfile {
  id: RenderQualityLevel;
  pixelRatioCap: number;
  shadowsEnabled: boolean;
  softShadows: boolean;
  shadowMapSize: number;
  cabinetLightCastsShadow: boolean;
  cabinetLightShadowMapSize: number;
  arcadeBackgroundDetail: ArcadeBackgroundDetail;
  toneMappingExposure: number;
}

export const HIGH_RENDER_QUALITY: RenderQualityProfile = {
  id: "high",
  pixelRatioCap: 2,
  shadowsEnabled: true,
  softShadows: true,
  shadowMapSize: 1024,
  cabinetLightCastsShadow: true,
  cabinetLightShadowMapSize: 512,
  arcadeBackgroundDetail: "full",
  toneMappingExposure: 1.04,
};

export const MEDIUM_RENDER_QUALITY: RenderQualityProfile = {
  id: "medium",
  pixelRatioCap: 1.35,
  shadowsEnabled: true,
  softShadows: false,
  shadowMapSize: 512,
  cabinetLightCastsShadow: false,
  cabinetLightShadowMapSize: 256,
  arcadeBackgroundDetail: "reduced",
  toneMappingExposure: 1.02,
};

export const LOW_RENDER_QUALITY: RenderQualityProfile = {
  id: "low",
  pixelRatioCap: 1,
  shadowsEnabled: false,
  softShadows: false,
  shadowMapSize: 256,
  cabinetLightCastsShadow: false,
  cabinetLightShadowMapSize: 128,
  arcadeBackgroundDetail: "minimal",
  toneMappingExposure: 1,
};

export const DESKTOP_RENDER_QUALITY = HIGH_RENDER_QUALITY;
export const MOBILE_RENDER_QUALITY = MEDIUM_RENDER_QUALITY;

export const AUTO_QUALITY_WARMUP_SECONDS = 5;
export const AUTO_QUALITY_SUSTAIN_SECONDS = 3;
export const AUTO_HIGH_DOWNGRADE_FPS = 48;
export const AUTO_MEDIUM_DOWNGRADE_FPS = 34;

export function getRenderQualityProfile(
  level: RenderQualityLevel,
): RenderQualityProfile {
  switch (level) {
    case "high": return HIGH_RENDER_QUALITY;
    case "medium": return MEDIUM_RENDER_QUALITY;
    case "low": return LOW_RENDER_QUALITY;
  }
}

export function parseRenderQualityMode(
  search: string,
): RenderQualityMode {
  const params = new URLSearchParams(search);
  const requested =
    params.get("quality") ?? params.get("graphics");
  return requested === "high" ||
    requested === "medium" ||
    requested === "low"
    ? requested
    : "auto";
}

export function chooseInitialRenderQualityProfile(
  mode: RenderQualityMode,
  touchLike: boolean,
): RenderQualityProfile {
  if (mode === "auto") {
    return touchLike
      ? MEDIUM_RENDER_QUALITY
      : HIGH_RENDER_QUALITY;
  }
  return getRenderQualityProfile(mode);
}

export function chooseRenderQualityProfile(
  touchLike: boolean,
): RenderQualityProfile {
  return chooseInitialRenderQualityProfile(
    "auto",
    touchLike,
  );
}

export function isTouchLikeEnvironment(): boolean {
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function lowerQualityLevel(
  level: RenderQualityLevel,
): RenderQualityLevel | null {
  if (level === "high") return "medium";
  if (level === "medium") return "low";
  return null;
}

export class AdaptiveRenderQualityController {
  private modeValue: RenderQualityMode;
  private profileValue: RenderQualityProfile;
  private warmupSeconds = 0;
  private lowFpsSeconds = 0;
  private downgradeCountValue = 0;

  constructor(
    mode: RenderQualityMode,
    touchLike: boolean,
  ) {
    this.modeValue = mode;
    this.profileValue =
      chooseInitialRenderQualityProfile(
        mode,
        touchLike,
      );
  }

  get mode(): RenderQualityMode {
    return this.modeValue;
  }

  get profile(): RenderQualityProfile {
    return this.profileValue;
  }

  get downgradeCount(): number {
    return this.downgradeCountValue;
  }

  setMode(
    mode: RenderQualityMode,
    touchLike: boolean,
  ): RenderQualityProfile {
    this.modeValue = mode;
    this.profileValue =
      chooseInitialRenderQualityProfile(
        mode,
        touchLike,
      );
    this.warmupSeconds = 0;
    this.lowFpsSeconds = 0;
    this.downgradeCountValue = 0;
    return this.profileValue;
  }

  update(
    smoothedFps: number,
    frameDeltaSeconds: number,
  ): RenderQualityProfile | null {
    if (
      this.modeValue !== "auto" ||
      this.profileValue.id === "low" ||
      frameDeltaSeconds <= 0
    ) {
      return null;
    }

    const observedSeconds = Math.min(
      frameDeltaSeconds,
      0.25,
    );
    this.warmupSeconds += observedSeconds;
    if (
      this.warmupSeconds <
      AUTO_QUALITY_WARMUP_SECONDS
    ) {
      return null;
    }

    const threshold =
      this.profileValue.id === "high"
        ? AUTO_HIGH_DOWNGRADE_FPS
        : AUTO_MEDIUM_DOWNGRADE_FPS;

    if (smoothedFps < threshold) {
      this.lowFpsSeconds += observedSeconds;
    } else {
      this.lowFpsSeconds = Math.max(
        0,
        this.lowFpsSeconds - observedSeconds * 1.5,
      );
    }

    if (
      this.lowFpsSeconds <
      AUTO_QUALITY_SUSTAIN_SECONDS
    ) {
      return null;
    }

    const nextLevel = lowerQualityLevel(
      this.profileValue.id,
    );
    if (!nextLevel) return null;

    this.profileValue =
      getRenderQualityProfile(nextLevel);
    this.lowFpsSeconds = 0;
    this.downgradeCountValue += 1;
    return this.profileValue;
  }
}
