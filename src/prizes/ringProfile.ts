import type { PrimitiveColliderSpec, Vec3 } from "../physics/PhysicsRuntime";

export const RING_LOOP_PROFILE = {
  outerHalfX: 0.075,
  outerHalfZ: 0.065,
  tubeRadius: 0.010,
  segmentCount: 12,
} as const;

export interface RingLoopGeometry {
  centerlineRadiusX: number;
  centerlineRadiusZ: number;
  innerHalfX: number;
  innerHalfZ: number;
  points: readonly Vec3[];
  colliders: readonly PrimitiveColliderSpec[];
}

export function createRingLoopGeometry(): RingLoopGeometry {
  const centerlineRadiusX =
    RING_LOOP_PROFILE.outerHalfX - RING_LOOP_PROFILE.tubeRadius;
  const centerlineRadiusZ =
    RING_LOOP_PROFILE.outerHalfZ - RING_LOOP_PROFILE.tubeRadius;
  const innerHalfX =
    centerlineRadiusX - RING_LOOP_PROFILE.tubeRadius;
  const innerHalfZ =
    centerlineRadiusZ - RING_LOOP_PROFILE.tubeRadius;

  const points = Array.from(
    { length: RING_LOOP_PROFILE.segmentCount },
    (_, index): Vec3 => {
      const angle =
        (index / RING_LOOP_PROFILE.segmentCount) *
        Math.PI *
        2;
      return {
        x: Math.cos(angle) * centerlineRadiusX,
        y: 0,
        z: Math.sin(angle) * centerlineRadiusZ,
      };
    },
  );

  const colliders = points.map(
    (start, index): PrimitiveColliderSpec => ({
      shape: "capsule",
      start,
      end: points[(index + 1) % points.length]!,
      radius: RING_LOOP_PROFILE.tubeRadius,
    }),
  );

  return {
    centerlineRadiusX,
    centerlineRadiusZ,
    innerHalfX,
    innerHalfZ,
    points,
    colliders,
  };
}
