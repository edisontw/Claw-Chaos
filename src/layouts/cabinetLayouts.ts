import { createSeededRandom } from "../core/seededRng";

export const CABINET_LAYOUT_IDS = [
  "loose",
  "dense",
] as const;

export type CabinetLayoutId =
  (typeof CABINET_LAYOUT_IDS)[number];

export interface CabinetLayoutPlacement {
  prizeId: string;
  x: number;
  z: number;
  yOffsetMeters: number;
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
  x: number;
  z: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function materializePlacements(
  layoutId: CabinetLayoutId,
  seed: string,
  bases: readonly PlacementBase[],
): CabinetLayoutPlacement[] {
  const rng = createSeededRandom(`m09:${layoutId}:${seed}`);
  const dense = layoutId === "dense";
  const positionJitter = dense ? 0.009 : 0.006;
  const rotationJitter = dense ? 0.10 : 0.055;

  return bases.map((base, index) => ({
    prizeId: base.prizeId,
    x: clamp(
      base.x + rng.range(-positionJitter, positionJitter),
      -0.265,
      0.265,
    ),
    z: clamp(
      base.z + rng.range(-positionJitter, positionJitter),
      -0.195,
      0.195,
    ),
    yOffsetMeters:
      (base.yOffsetMeters ?? 0.002) +
      (dense ? rng.range(0.006, 0.014) : 0),
    rotationYRadians:
      base.rotationYRadians +
      rng.range(-rotationJitter, rotationJitter),
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
  const bases = id === "dense" ? DENSE_BASE : LOOSE_BASE;
  return {
    id,
    seed,
    placements: materializePlacements(id, seed, bases),
  };
}
