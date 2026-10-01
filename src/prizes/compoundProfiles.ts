import type {
  PrimitiveColliderSpec,
  Vec3,
} from "../physics/PhysicsRuntime";
import type { PrizeDefinition } from "./types";

export type PrizeVisualPart =
  | {
      shape: "cuboid";
      center: Vec3;
      halfExtents: Vec3;
    }
  | {
      shape: "sphere";
      center: Vec3;
      radius: number;
    }
  | {
      shape: "capsule";
      start: Vec3;
      end: Vec3;
      radius: number;
    };

export interface CompoundPrizeProfile {
  colliders: PrimitiveColliderSpec[];
  visualParts: PrizeVisualPart[];
}

function toPrimitiveCollider(part: PrizeVisualPart): PrimitiveColliderSpec {
  switch (part.shape) {
    case "cuboid":
      return {
        shape: "cuboid",
        center: part.center,
        halfExtents: part.halfExtents,
      };
    case "sphere":
      return {
        shape: "sphere",
        center: part.center,
        radius: part.radius,
      };
    case "capsule":
      return {
        shape: "capsule",
        start: part.start,
        end: part.end,
        radius: part.radius,
      };
  }
}

function pillowProfile(dimensions: Vec3): CompoundPrizeProfile {
  const radius = Math.min(dimensions.x, dimensions.z) * 0.19;
  const cornerX = dimensions.x * 0.30;
  const cornerZ = dimensions.z * 0.27;
  const centerHalfExtents = {
    x: dimensions.x * 0.34,
    y: dimensions.y * 0.34,
    z: dimensions.z * 0.30,
  };
  const centers = [
    { x: -cornerX, y: 0, z: -cornerZ },
    { x: cornerX, y: 0, z: -cornerZ },
    { x: -cornerX, y: 0, z: cornerZ },
    { x: cornerX, y: 0, z: cornerZ },
  ];

  const parts: PrizeVisualPart[] = [
    {
      shape: "cuboid",
      center: { x: 0, y: 0, z: 0 },
      halfExtents: centerHalfExtents,
    },
    ...centers.map((center) => ({
      shape: "sphere" as const,
      center,
      radius,
    })),
  ];

  return {
    colliders: parts.map(toPrimitiveCollider),
    visualParts: parts,
  };
}

function teddyProfile(dimensions: Vec3): CompoundPrizeProfile {
  const sx = dimensions.x / 0.20;
  const sy = dimensions.y / 0.25;
  const sz = dimensions.z / 0.09;
  const radialScale = Math.min(sx, sz);

  // Keep the M05 data-driven Teddy aligned with the PT-004 Tier-A
  // collision silhouette: two-segment arms and enlarged paws are the
  // physical geometry that makes limb hooking possible.
  const parts: PrizeVisualPart[] = [
    {
      shape: "sphere",
      center: { x: 0, y: 0.085 * sy, z: 0 },
      radius: 0.035 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: 0, y: -0.040 * sy, z: 0 },
      end: { x: 0, y: 0.040 * sy, z: 0 },
      radius: 0.035 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: -0.030 * sx, y: 0.020 * sy, z: 0 },
      end: { x: -0.100 * sx, y: 0.015 * sy, z: 0 },
      radius: 0.013 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: -0.100 * sx, y: 0.015 * sy, z: 0 },
      end: { x: -0.065 * sx, y: -0.065 * sy, z: 0 },
      radius: 0.013 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: 0.030 * sx, y: 0.020 * sy, z: 0 },
      end: { x: 0.100 * sx, y: 0.015 * sy, z: 0 },
      radius: 0.013 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: 0.100 * sx, y: 0.015 * sy, z: 0 },
      end: { x: 0.065 * sx, y: -0.065 * sy, z: 0 },
      radius: 0.013 * radialScale,
    },
    {
      shape: "sphere",
      center: { x: -0.065 * sx, y: -0.065 * sy, z: 0 },
      radius: 0.030 * radialScale,
    },
    {
      shape: "sphere",
      center: { x: 0.065 * sx, y: -0.065 * sy, z: 0 },
      radius: 0.030 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: -0.020 * sx, y: -0.050 * sy, z: 0 },
      end: { x: -0.035 * sx, y: -0.125 * sy, z: 0 },
      radius: 0.018 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: 0.020 * sx, y: -0.050 * sy, z: 0 },
      end: { x: 0.035 * sx, y: -0.125 * sy, z: 0 },
      radius: 0.018 * radialScale,
    },
  ];

  return {
    colliders: parts.map(toPrimitiveCollider),
    visualParts: parts,
  };
}

function animalProfile(dimensions: Vec3): CompoundPrizeProfile {
  const sx = dimensions.x / 0.23;
  const sy = dimensions.y / 0.14;
  const sz = dimensions.z / 0.10;
  const radialScale = Math.min(sy, sz);

  const parts: PrizeVisualPart[] = [
    {
      shape: "capsule",
      start: { x: -0.070 * sx, y: 0.016 * sy, z: 0 },
      end: { x: 0.055 * sx, y: 0.016 * sy, z: 0 },
      radius: 0.034 * radialScale,
    },
    {
      shape: "sphere",
      center: { x: 0.086 * sx, y: 0.035 * sy, z: 0 },
      radius: 0.033 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: -0.050 * sx, y: -0.005 * sy, z: -0.022 * sz },
      end: { x: -0.052 * sx, y: -0.060 * sy, z: -0.024 * sz },
      radius: 0.014 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: 0.030 * sx, y: -0.005 * sy, z: -0.022 * sz },
      end: { x: 0.032 * sx, y: -0.060 * sy, z: -0.024 * sz },
      radius: 0.014 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: -0.050 * sx, y: -0.005 * sy, z: 0.022 * sz },
      end: { x: -0.052 * sx, y: -0.060 * sy, z: 0.024 * sz },
      radius: 0.014 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: 0.030 * sx, y: -0.005 * sy, z: 0.022 * sz },
      end: { x: 0.032 * sx, y: -0.060 * sy, z: 0.024 * sz },
      radius: 0.014 * radialScale,
    },
    {
      shape: "capsule",
      start: { x: -0.085 * sx, y: 0.030 * sy, z: 0 },
      end: { x: -0.118 * sx, y: 0.062 * sy, z: 0 },
      radius: 0.010 * radialScale,
    },
    {
      shape: "sphere",
      center: { x: 0.080 * sx, y: 0.070 * sy, z: -0.018 * sz },
      radius: 0.012 * radialScale,
    },
    {
      shape: "sphere",
      center: { x: 0.080 * sx, y: 0.070 * sy, z: 0.018 * sz },
      radius: 0.012 * radialScale,
    },
  ];

  return {
    colliders: parts.map(toPrimitiveCollider),
    visualParts: parts,
  };
}

export function createCompoundPrizeProfile(
  definition: PrizeDefinition,
): CompoundPrizeProfile {
  switch (definition.shapeFamily) {
    case "pillow":
      return pillowProfile(definition.dimensions);
    case "plush_humanoid":
      return teddyProfile(definition.dimensions);
    case "plush_animal":
      return animalProfile(definition.dimensions);
    default:
      throw new Error(
        `No compound prize profile for shape family: ${definition.shapeFamily}`,
      );
  }
}
