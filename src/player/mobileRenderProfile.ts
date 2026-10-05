export type ArcadeBackgroundDetail =
  | "full"
  | "reduced";

export interface RenderQualityProfile {
  id: "desktop" | "mobile";
  pixelRatioCap: number;
  shadowMapSize: number;
  cabinetLightCastsShadow: boolean;
  cabinetLightShadowMapSize: number;
  arcadeBackgroundDetail: ArcadeBackgroundDetail;
}

export const DESKTOP_RENDER_QUALITY: RenderQualityProfile = {
  id: "desktop",
  pixelRatioCap: 2,
  shadowMapSize: 1024,
  cabinetLightCastsShadow: true,
  cabinetLightShadowMapSize: 512,
  arcadeBackgroundDetail: "full",
};

export const MOBILE_RENDER_QUALITY: RenderQualityProfile = {
  id: "mobile",
  pixelRatioCap: 1.5,
  shadowMapSize: 512,
  cabinetLightCastsShadow: false,
  cabinetLightShadowMapSize: 256,
  arcadeBackgroundDetail: "reduced",
};

export function chooseRenderQualityProfile(
  touchLike: boolean,
): RenderQualityProfile {
  return touchLike
    ? MOBILE_RENDER_QUALITY
    : DESKTOP_RENDER_QUALITY;
}

export function isTouchLikeEnvironment(): boolean {
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}
