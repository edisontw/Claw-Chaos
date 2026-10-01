import type {
  PhysicsRuntime,
  Vec3,
} from "../physics/PhysicsRuntime";

export type CabinetPartRole =
  | "floor"
  | "frame"
  | "glass"
  | "ceiling"
  | "chute_wall"
  | "chute_bottom";

export interface CabinetPartDefinition {
  id: string;
  role: CabinetPartRole;
  center: Vec3;
  halfExtents: Vec3;
  friction: number;
}

export const M06_CABINET_CONFIG = {
  floorY: 0,
  floorHalfThickness: 0.02,
  interiorHalfX: 0.46,
  interiorHalfZ: 0.36,
  wallHalfThickness: 0.012,
  playAreaHeight: 0.62,
  chuteCenterX: 0.28,
  chuteCenterZ: 0.20,
  chuteOpeningHalfX: 0.070,
  chuteOpeningHalfZ: 0.055,
  chuteWallHalfThickness: 0.010,
  chuteBottomY: -0.30,
  chuteSensorCenterY: -0.12,
  chuteSensorHalfX: 0.055,
  chuteSensorHalfY: 0.045,
  chuteSensorHalfZ: 0.045,
  floorFriction: 0.80,
  wallFriction: 0.68,
  chuteFriction: 0.62,
} as const;

function floorParts(): CabinetPartDefinition[] {
  const c = M06_CABINET_CONFIG;
  const minX = -c.interiorHalfX;
  const maxX = c.interiorHalfX;
  const minZ = -c.interiorHalfZ;
  const maxZ = c.interiorHalfZ;
  const openingMinX = c.chuteCenterX - c.chuteOpeningHalfX;
  const openingMaxX = c.chuteCenterX + c.chuteOpeningHalfX;
  const openingMinZ = c.chuteCenterZ - c.chuteOpeningHalfZ;
  const openingMaxZ = c.chuteCenterZ + c.chuteOpeningHalfZ;
  const y = c.floorY - c.floorHalfThickness;

  const make = (
    id: string,
    left: number,
    right: number,
    back: number,
    front: number,
  ): CabinetPartDefinition => ({
    id,
    role: "floor",
    center: {
      x: (left + right) * 0.5,
      y,
      z: (back + front) * 0.5,
    },
    halfExtents: {
      x: (right - left) * 0.5,
      y: c.floorHalfThickness,
      z: (front - back) * 0.5,
    },
    friction: c.floorFriction,
  });

  return [
    make("floor-left", minX, openingMinX, minZ, maxZ),
    make("floor-right", openingMaxX, maxX, minZ, maxZ),
    make("floor-back", openingMinX, openingMaxX, minZ, openingMinZ),
    make("floor-front", openingMinX, openingMaxX, openingMaxZ, maxZ),
  ];
}

function boundaryParts(): CabinetPartDefinition[] {
  const c = M06_CABINET_CONFIG;
  const t = c.wallHalfThickness;
  const halfY = c.playAreaHeight * 0.5;
  const centerY = c.floorY + halfY;

  return [
    {
      id: "glass-left",
      role: "glass",
      center: { x: -c.interiorHalfX - t, y: centerY, z: 0 },
      halfExtents: { x: t, y: halfY, z: c.interiorHalfZ + t * 2 },
      friction: c.wallFriction,
    },
    {
      id: "glass-right",
      role: "glass",
      center: { x: c.interiorHalfX + t, y: centerY, z: 0 },
      halfExtents: { x: t, y: halfY, z: c.interiorHalfZ + t * 2 },
      friction: c.wallFriction,
    },
    {
      id: "back-wall",
      role: "frame",
      center: { x: 0, y: centerY, z: -c.interiorHalfZ - t },
      halfExtents: { x: c.interiorHalfX + t * 2, y: halfY, z: t },
      friction: c.wallFriction,
    },
    {
      id: "front-glass",
      role: "glass",
      center: { x: 0, y: centerY, z: c.interiorHalfZ + t },
      halfExtents: { x: c.interiorHalfX + t * 2, y: halfY, z: t },
      friction: c.wallFriction,
    },
    {
      id: "ceiling",
      role: "ceiling",
      center: {
        x: 0,
        y: c.floorY + c.playAreaHeight + t,
        z: 0,
      },
      halfExtents: {
        x: c.interiorHalfX + t * 2,
        y: t,
        z: c.interiorHalfZ + t * 2,
      },
      friction: c.wallFriction,
    },
  ];
}

function chuteParts(): CabinetPartDefinition[] {
  const c = M06_CABINET_CONFIG;
  const t = c.chuteWallHalfThickness;
  const channelTopY = c.floorY;
  const channelBottomY = c.chuteBottomY;
  const centerY = (channelTopY + channelBottomY) * 0.5;
  const halfY = (channelTopY - channelBottomY) * 0.5;

  return [
    {
      id: "chute-left",
      role: "chute_wall",
      center: {
        x: c.chuteCenterX - c.chuteOpeningHalfX - t,
        y: centerY,
        z: c.chuteCenterZ,
      },
      halfExtents: {
        x: t,
        y: halfY,
        z: c.chuteOpeningHalfZ + t * 2,
      },
      friction: c.chuteFriction,
    },
    {
      id: "chute-right",
      role: "chute_wall",
      center: {
        x: c.chuteCenterX + c.chuteOpeningHalfX + t,
        y: centerY,
        z: c.chuteCenterZ,
      },
      halfExtents: {
        x: t,
        y: halfY,
        z: c.chuteOpeningHalfZ + t * 2,
      },
      friction: c.chuteFriction,
    },
    {
      id: "chute-back",
      role: "chute_wall",
      center: {
        x: c.chuteCenterX,
        y: centerY,
        z: c.chuteCenterZ - c.chuteOpeningHalfZ - t,
      },
      halfExtents: {
        x: c.chuteOpeningHalfX + t * 2,
        y: halfY,
        z: t,
      },
      friction: c.chuteFriction,
    },
    {
      id: "chute-front",
      role: "chute_wall",
      center: {
        x: c.chuteCenterX,
        y: centerY,
        z: c.chuteCenterZ + c.chuteOpeningHalfZ + t,
      },
      halfExtents: {
        x: c.chuteOpeningHalfX + t * 2,
        y: halfY,
        z: t,
      },
      friction: c.chuteFriction,
    },
    {
      id: "chute-bottom",
      role: "chute_bottom",
      center: {
        x: c.chuteCenterX,
        y: c.chuteBottomY - t,
        z: c.chuteCenterZ,
      },
      halfExtents: {
        x: c.chuteOpeningHalfX + t * 2,
        y: t,
        z: c.chuteOpeningHalfZ + t * 2,
      },
      friction: c.chuteFriction,
    },
  ];
}

export function createCabinetPartDefinitions(): CabinetPartDefinition[] {
  return [
    ...floorParts(),
    ...boundaryParts(),
    ...chuteParts(),
  ];
}

export function createCabinetPhysics(
  physics: PhysicsRuntime,
): CabinetPartDefinition[] {
  const parts = createCabinetPartDefinitions();

  for (const part of parts) {
    physics.createStaticCuboid(
      part.center,
      part.halfExtents,
      part.friction,
    );
  }

  return parts;
}
