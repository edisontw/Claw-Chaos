import { M06_CABINET_CONFIG } from "./cabinetGeometry";

export interface VisualBoxSpec {
  id: string;
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
}

export const M08_CABINET_VISUAL_STYLE = {
  frame: {
    color: 0x26313d,
    roughness: 0.28,
    metalness: 0.72,
    clearcoat: 0.32,
    clearcoatRoughness: 0.24,
  },
  glass: {
    color: 0xc6e8ff,
    opacity: 0.075,
    roughness: 0.12,
    transmission: 0.22,
    ior: 1.45,
    thicknessMeters: 0.006,
    clearcoat: 0.28,
    clearcoatRoughness: 0.10,
    edgeOpacity: 0.24,
  },
  chute: {
    color: 0x4f5966,
    roughness: 0.34,
    metalness: 0.82,
  },
  controlPanel: {
    color: 0x222a34,
    roughness: 0.30,
    metalness: 0.64,
    clearcoat: 0.24,
  },
  led: {
    color: 0xd9f3ff,
    emissive: 0xa9e3ff,
    emissiveIntensity: 2.4,
  },
} as const;

export const M08_GANTRY_VISUAL_STYLE = {
  bridgeBeamHalfX: 0.018,
  bridgeBeamHalfY: 0.014,
  bridgeExtraHalfSpanZ: 0.070,
  bridgeEndBlockHalfX: 0.026,
  bridgeEndBlockHalfY: 0.022,
  bridgeEndBlockHalfZ: 0.034,
  winchDrumRadius: 0.022,
  winchDrumLength: 0.070,
  winchFlangeRadius: 0.029,
  winchFlangeThickness: 0.006,
  pulleyRadius: 0.014,
  pulleyThickness: 0.010,
} as const;

export function createCabinetLedStripSpecs(): VisualBoxSpec[] {
  const c = M06_CABINET_CONFIG;
  const y = c.floorY + c.playAreaHeight - 0.032;

  return [
    {
      id: "led-top-front",
      center: { x: 0, y, z: c.interiorHalfZ - 0.022 },
      halfExtents: {
        x: c.interiorHalfX - 0.028,
        y: 0.005,
        z: 0.005,
      },
    },
    {
      id: "led-top-left",
      center: { x: -c.interiorHalfX + 0.022, y, z: 0 },
      halfExtents: {
        x: 0.005,
        y: 0.005,
        z: c.interiorHalfZ - 0.028,
      },
    },
    {
      id: "led-top-right",
      center: { x: c.interiorHalfX - 0.022, y, z: 0 },
      halfExtents: {
        x: 0.005,
        y: 0.005,
        z: c.interiorHalfZ - 0.028,
      },
    },
  ];
}

export function createCabinetFrameTrimSpecs(): VisualBoxSpec[] {
  const c = M06_CABINET_CONFIG;
  const frontZ = c.interiorHalfZ + c.wallHalfThickness * 2;
  const sideX = c.interiorHalfX + c.wallHalfThickness * 2;
  const centerY = c.floorY + c.playAreaHeight * 0.5;

  return [
    {
      id: "frame-front-left-post",
      center: { x: -sideX, y: centerY, z: frontZ },
      halfExtents: { x: 0.018, y: c.playAreaHeight * 0.5, z: 0.018 },
    },
    {
      id: "frame-front-right-post",
      center: { x: sideX, y: centerY, z: frontZ },
      halfExtents: { x: 0.018, y: c.playAreaHeight * 0.5, z: 0.018 },
    },
    {
      id: "frame-front-header",
      center: {
        x: 0,
        y: c.floorY + c.playAreaHeight - 0.020,
        z: frontZ,
      },
      halfExtents: { x: sideX, y: 0.020, z: 0.018 },
    },
  ];
}
