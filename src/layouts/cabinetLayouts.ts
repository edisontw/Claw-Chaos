import { createSeededRandom } from "../core/seededRng";

export const CABINET_LAYOUT_IDS = [
  "loose",
  "dense",
  "showcase",
  "bridge",
  "edge",
  "ring",
  "chute",
] as const;

export type CabinetLayoutId =
  (typeof CABINET_LAYOUT_IDS)[number];

export type CabinetLayoutRole =
  | "support"
  | "bridge"
  | "edge_target"
  | "ring_target"
  | "ring_support"
  | "chute_target"
  | "filler";

export interface CabinetLayoutPlacement {
  prizeId: string;
  role?: CabinetLayoutRole;
  x: number;
  z: number;
  yOffsetMeters: number;
  rotationXRadians: number;
  rotationYRadians: number;
  variantSeed: string;
}

export interface CabinetLayout {
  id: CabinetLayoutId;
  seed: string;
  placements: readonly CabinetLayoutPlacement[];
}

export interface CabinetLayoutSelection {
  id: CabinetLayoutId;
  usedFallback: boolean;
}

interface PlacementBase {
  prizeId: string;
  role?: CabinetLayoutRole;
  x: number;
  z: number;
  rotationXRadians?: number;
  rotationYRadians: number;
  yOffsetMeters?: number;
}

const LOOSE_BASE: readonly PlacementBase[] = [
  {
    prizeId: "prize/cube_small",
    x: -0.24,
    z: -0.15,
    rotationYRadians: 0.18,
  },
  {
    prizeId: "prize/sphere_ball",
    x: 0,
    z: 0,
    rotationYRadians: 0,
  },
  {
    prizeId: "prize/teddy_simple",
    x: 0.18,
    z: -0.13,
    rotationYRadians: -0.22,
  },
  {
    prizeId: "prize/pillow_small",
    x: -0.18,
    z: 0.13,
    rotationYRadians: 0.28,
  },
  {
    prizeId: "prize/animal_simple",
    x: 0.06,
    z: 0.14,
    rotationYRadians: -0.12,
  },
];

const DENSE_BASE: readonly PlacementBase[] = [
  {
    prizeId: "prize/cube_small",
    x: -0.23,
    z: -0.15,
    rotationYRadians: 0.10,
  },
  {
    prizeId: "prize/box_standard",
    x: -0.08,
    z: -0.16,
    rotationYRadians: -0.10,
  },
  {
    prizeId: "prize/teddy_simple",
    x: 0.10,
    z: -0.15,
    rotationYRadians: 0.20,
  },
  {
    prizeId: "prize/sphere_ball",
    x: 0.23,
    z: -0.09,
    rotationYRadians: 0,
  },
  {
    prizeId: "prize/pillow_small",
    x: -0.20,
    z: 0.04,
    rotationYRadians: -0.24,
  },
  {
    prizeId: "prize/animal_simple",
    x: -0.03,
    z: 0.05,
    rotationYRadians: 0.14,
  },
  {
    prizeId: "prize/cylinder_can",
    x: 0.14,
    z: 0.04,
    rotationYRadians: -0.16,
  },
  {
    prizeId: "prize/capsule_soft",
    x: 0.24,
    z: 0.13,
    rotationYRadians: 0.18,
  },
];

const SHOWCASE_BASE: readonly PlacementBase[] = [
  {
    prizeId: "prize/box_standard",
    x: -0.22,
    z: -0.13,
    rotationYRadians: 0.03,
  },
  {
    prizeId: "prize/sphere_ball",
    x: 0,
    z: -0.13,
    rotationYRadians: 0,
  },
  {
    prizeId: "prize/cylinder_can",
    x: 0.22,
    z: -0.13,
    rotationYRadians: -0.03,
  },
  {
    prizeId: "prize/teddy_simple",
    x: -0.22,
    z: 0.12,
    rotationYRadians: -0.08,
  },
  {
    prizeId: "prize/pillow_small",
    x: 0,
    z: 0.12,
    rotationYRadians: 0.06,
  },
  {
    prizeId: "prize/animal_simple",
    x: 0.22,
    z: 0.12,
    rotationYRadians: 0.08,
  },
];

const BRIDGE_BASE: readonly PlacementBase[] = [
  {
    prizeId: "prize/box_standard",
    role: "support",
    x: -0.09,
    z: -0.02,
    rotationYRadians: 0,
  },
  {
    prizeId: "prize/box_standard",
    role: "support",
    x: 0.09,
    z: -0.02,
    rotationYRadians: 0,
  },
  {
    prizeId: "prize/box_flat",
    role: "bridge",
    x: 0,
    z: -0.02,
    yOffsetMeters: 0.087,
    rotationYRadians: 0,
  },
  {
    prizeId: "prize/sphere_ball",
    role: "filler",
    x: -0.22,
    z: 0.14,
    rotationYRadians: 0,
  },
  {
    prizeId: "prize/teddy_simple",
    role: "filler",
    x: 0.20,
    z: 0.14,
    rotationYRadians: -0.10,
  },
];

const EDGE_BASE: readonly PlacementBase[] = [
  {
    prizeId: "prize/box_standard",
    role: "edge_target",
    x: 0.38,
    z: -0.04,
    rotationYRadians: 0.08,
  },
  {
    prizeId: "prize/cylinder_can",
    role: "edge_target",
    x: 0.10,
    z: -0.305,
    rotationYRadians: 0,
  },
  {
    prizeId: "prize/cube_small",
    role: "filler",
    x: -0.03,
    z: -0.08,
    rotationYRadians: 0.12,
  },
  {
    prizeId: "prize/pillow_small",
    role: "filler",
    x: -0.20,
    z: -0.03,
    rotationYRadians: -0.16,
  },
  {
    prizeId: "prize/animal_simple",
    role: "filler",
    x: 0.08,
    z: 0.13,
    rotationYRadians: 0.10,
  },
];

const RING_BASE: readonly PlacementBase[] = [
  {
    prizeId: "prize/ring_loop",
    role: "ring_target",
    x: -0.16,
    z: -0.025,
    yOffsetMeters: 0.030,
    rotationXRadians: 0.52,
    rotationYRadians: 0.04,
  },
  {
    prizeId: "prize/cube_small",
    role: "ring_support",
    x: -0.16,
    z: -0.1375,
    rotationYRadians: 0.02,
  },
  {
    prizeId: "prize/ring_loop",
    role: "ring_target",
    x: 0.16,
    z: 0.025,
    yOffsetMeters: 0.030,
    rotationXRadians: -0.52,
    rotationYRadians: -0.05,
  },
  {
    prizeId: "prize/cube_small",
    role: "ring_support",
    x: 0.16,
    z: 0.1375,
    rotationYRadians: -0.02,
  },
  {
    prizeId: "prize/cube_small",
    role: "filler",
    x: 0,
    z: 0.16,
    rotationYRadians: 0.10,
  },
];

const CHUTE_BASE: readonly PlacementBase[] = [
  {
    prizeId: "prize/sphere_ball",
    role: "chute_target",
    x: -0.068,
    z: 0.20,
    rotationYRadians: 0,
  },
  {
    prizeId: "prize/cube_small",
    role: "chute_target",
    x: -0.24,
    z: 0.030,
    rotationYRadians: 0.08,
  },
  {
    prizeId: "prize/pillow_small",
    role: "filler",
    x: 0.05,
    z: -0.10,
    rotationYRadians: -0.12,
  },
  {
    prizeId: "prize/animal_simple",
    role: "filler",
    x: 0.20,
    z: 0.10,
    rotationYRadians: 0.10,
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function materializePlacements(
  layoutId: CabinetLayoutId,
  seed: string,
  bases: readonly PlacementBase[],
): CabinetLayoutPlacement[] {
  const rng = createSeededRandom(`m09:${layoutId}:${seed}`);
  const variation =
    layoutId === "dense"
      ? {
          positionJitter: 0.009,
          rotationJitter: 0.10,
          verticalJitterMin: 0.006,
          verticalJitterMax: 0.014,
        }
      : layoutId === "showcase"
        ? {
            positionJitter: 0.003,
            rotationJitter: 0.025,
            verticalJitterMin: 0,
            verticalJitterMax: 0,
          }
        : layoutId === "bridge"
          ? {
              positionJitter: 0.0015,
              rotationJitter: 0.012,
              verticalJitterMin: 0,
              verticalJitterMax: 0,
            }
          : layoutId === "edge"
            ? {
                positionJitter: 0.001,
                rotationJitter: 0.010,
                verticalJitterMin: 0,
                verticalJitterMax: 0,
              }
            : layoutId === "ring"
              ? {
                  positionJitter: 0.0015,
                  rotationJitter: 0.015,
                  verticalJitterMin: 0,
                  verticalJitterMax: 0,
                }
              : layoutId === "chute"
                ? {
                    positionJitter: 0.001,
                    rotationJitter: 0.010,
                    verticalJitterMin: 0,
                    verticalJitterMax: 0,
                  }
                : {
            positionJitter: 0.006,
            rotationJitter: 0.055,
            verticalJitterMin: 0,
            verticalJitterMax: 0,
          };

  const bounds =
    layoutId === "edge"
      ? {
          minX: -0.40,
          maxX: 0.40,
          minZ: -0.315,
          maxZ: 0.315,
        }
      : layoutId === "chute"
        ? {
            minX: -0.42,
            maxX: 0.265,
            minZ: -0.195,
            maxZ: 0.315,
          }
        : {
          minX: -0.265,
          maxX: 0.265,
          minZ: -0.195,
          maxZ: 0.195,
        };

  return bases.map((base, index) => ({
    prizeId: base.prizeId,
    role: base.role,
    x: clamp(
      base.x + rng.range(-variation.positionJitter, variation.positionJitter),
      bounds.minX,
      bounds.maxX,
    ),
    z: clamp(
      base.z + rng.range(-variation.positionJitter, variation.positionJitter),
      bounds.minZ,
      bounds.maxZ,
    ),
    yOffsetMeters:
      (base.yOffsetMeters ?? 0.002) +
      (variation.verticalJitterMax > 0
        ? rng.range(
            variation.verticalJitterMin,
            variation.verticalJitterMax,
          )
        : 0),
    rotationXRadians: base.rotationXRadians ?? 0,
    rotationYRadians:
      base.rotationYRadians +
      rng.range(-variation.rotationJitter, variation.rotationJitter),
    variantSeed: `m09:${layoutId}:${seed}:${index}`,
  }));
}

export function parseCabinetLayoutSelection(
  search: string,
): CabinetLayoutSelection {
  const requested =
    new URLSearchParams(search).get("layout")?.trim() || "loose";
  const valid = CABINET_LAYOUT_IDS.includes(
    requested as CabinetLayoutId,
  );

  return {
    id: valid ? (requested as CabinetLayoutId) : "loose",
    usedFallback: !valid,
  };
}

export function createCabinetLayout(
  id: CabinetLayoutId,
  seed: string,
): CabinetLayout {
  const bases =
    id === "dense"
      ? DENSE_BASE
      : id === "showcase"
        ? SHOWCASE_BASE
        : id === "bridge"
          ? BRIDGE_BASE
          : id === "edge"
            ? EDGE_BASE
            : id === "ring"
              ? RING_BASE
              : id === "chute"
                ? CHUTE_BASE
                : LOOSE_BASE;
  return {
    id,
    seed,
    placements: materializePlacements(id, seed, bases),
  };
}
