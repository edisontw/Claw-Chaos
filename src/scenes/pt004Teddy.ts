import type { CompoundColliderSpec, Vec3 } from "../physics/PhysicsRuntime";

export interface TeddyPartVisual {
  kind: "sphere" | "capsule";
  name: string;
  center?: Vec3;
  start?: Vec3;
  end?: Vec3;
  radius: number;
}

export const PT004_TEDDY_PARTS: readonly TeddyPartVisual[] = [
  {
    kind: "sphere",
    name: "head",
    center: { x: 0, y: 0.085, z: 0 },
    radius: 0.035,
  },
  {
    kind: "capsule",
    name: "torso",
    start: { x: 0, y: -0.04, z: 0 },
    end: { x: 0, y: 0.04, z: 0 },
    radius: 0.035,
  },
  {
    kind: "capsule",
    name: "left-upper-arm",
    start: { x: -0.03, y: 0.02, z: 0 },
    end: { x: -0.10, y: 0.015, z: 0 },
    radius: 0.013,
  },
  {
    kind: "capsule",
    name: "left-forearm",
    start: { x: -0.10, y: 0.015, z: 0 },
    end: { x: -0.065, y: -0.065, z: 0 },
    radius: 0.013,
  },
  {
    kind: "capsule",
    name: "right-upper-arm",
    start: { x: 0.03, y: 0.02, z: 0 },
    end: { x: 0.10, y: 0.015, z: 0 },
    radius: 0.013,
  },
  {
    kind: "capsule",
    name: "right-forearm",
    start: { x: 0.10, y: 0.015, z: 0 },
    end: { x: 0.065, y: -0.065, z: 0 },
    radius: 0.013,
  },
  {
    kind: "sphere",
    name: "left-paw",
    center: { x: -0.065, y: -0.065, z: 0 },
    radius: 0.030,
  },
  {
    kind: "sphere",
    name: "right-paw",
    center: { x: 0.065, y: -0.065, z: 0 },
    radius: 0.030,
  },
  {
    kind: "capsule",
    name: "left-leg",
    start: { x: -0.02, y: -0.05, z: 0 },
    end: { x: -0.035, y: -0.125, z: 0 },
    radius: 0.018,
  },
  {
    kind: "capsule",
    name: "right-leg",
    start: { x: 0.02, y: -0.05, z: 0 },
    end: { x: 0.035, y: -0.125, z: 0 },
    radius: 0.018,
  },
];

export function createPt004TeddyColliders(): CompoundColliderSpec[] {
  return PT004_TEDDY_PARTS.map((part) => {
    if (part.kind === "sphere") {
      return {
        shape: "sphere" as const,
        center: part.center!,
        radius: part.radius,
      };
    }

    return {
      shape: "capsule" as const,
      start: part.start!,
      end: part.end!,
      radius: part.radius,
    };
  });
}
