import { M06_CABINET_CONFIG } from "./cabinetGeometry";
import { DEFAULT_VISUAL_THEME } from "../theme/visualTheme";

export interface VisualBoxSpec {
  id: string;
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
}

const machineTheme = DEFAULT_VISUAL_THEME.machine;

export const M08_CABINET_VISUAL_STYLE = {
  frame: machineTheme.exterior.frame,
  glass: machineTheme.glass,
  chute: machineTheme.interior.chute,
  controlPanel: machineTheme.exterior.controlPanel,
  led: machineTheme.exterior.ledSecondary,
  floor: machineTheme.interior.floor,
  playDeck: machineTheme.interior.playDeck,
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
      halfExtents: {
        x: 0.018,
        y: c.playAreaHeight * 0.5,
        z: 0.018,
      },
    },
    {
      id: "frame-front-right-post",
      center: { x: sideX, y: centerY, z: frontZ },
      halfExtents: {
        x: 0.018,
        y: c.playAreaHeight * 0.5,
        z: 0.018,
      },
    },
    {
      id: "frame-front-header",
      center: {
        x: 0,
        y: c.floorY + c.playAreaHeight - 0.020,
        z: frontZ,
      },
      halfExtents: {
        x: sideX,
        y: 0.020,
        z: 0.018,
      },
    },
  ];
}
