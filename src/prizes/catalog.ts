import type {
  PrizeComProfile,
  PrizeDefinition,
  PrizeMassProfile,
  PrizeMaterialProfile,
  PrizeVisualVariantFamily,
} from "./types";

export const PRIZE_COLOR_PALETTE = {
  red: 0xd85858,
  orange: 0xe48b3c,
  yellow: 0xe0c04c,
  green: 0x57a86b,
  cyan: 0x45aeb8,
  blue: 0x507bc5,
  purple: 0x8759b5,
  pink: 0xd36d99,
} as const;

export const PRIZE_MATERIAL_PROFILES: Record<
  string,
  PrizeMaterialProfile
> = {
  "material/cardboard_matte": {
    id: "material/cardboard_matte",
    category: "cardboard_matte",
    staticFriction: 0.62,
    dynamicFriction: 0.56,
    restitution: 0.03,
    visualRoughness: 0.88,
    audioProfileId: "audio/cardboard",
  },
  "material/plastic": {
    id: "material/plastic",
    category: "plastic",
    staticFriction: 0.48,
    dynamicFriction: 0.42,
    restitution: 0.08,
    visualRoughness: 0.40,
    audioProfileId: "audio/plastic",
  },
  "material/rubber": {
    id: "material/rubber",
    category: "rubber",
    staticFriction: 0.90,
    dynamicFriction: 0.82,
    restitution: 0.10,
    visualRoughness: 0.72,
    audioProfileId: "audio/rubber",
  },
  "material/plush": {
    id: "material/plush",
    category: "plush",
    staticFriction: 0.78,
    dynamicFriction: 0.70,
    restitution: 0.02,
    visualRoughness: 0.96,
    audioProfileId: "audio/plush",
  },
  "material/fabric": {
    id: "material/fabric",
    category: "fabric",
    staticFriction: 0.70,
    dynamicFriction: 0.62,
    restitution: 0.025,
    visualRoughness: 0.90,
    audioProfileId: "audio/fabric",
  },
};

export const PRIZE_MASS_PROFILES: Record<string, PrizeMassProfile> = {
  "mass/light": {
    id: "mass/light",
    multiplier: 0.75,
  },
  "mass/standard": {
    id: "mass/standard",
    multiplier: 1.0,
  },
  "mass/heavy": {
    id: "mass/heavy",
    multiplier: 1.35,
  },
};

export const PRIZE_COM_PROFILES: Record<string, PrizeComProfile> = {
  "com/centered": {
    id: "com/centered",
    normalizedOffset: { x: 0, y: 0, z: 0 },
  },
  "com/bottom_heavy": {
    id: "com/bottom_heavy",
    normalizedOffset: { x: 0, y: -0.30, z: 0 },
  },
  "com/top_heavy": {
    id: "com/top_heavy",
    normalizedOffset: { x: 0, y: 0.24, z: 0 },
  },
  "com/left_offset": {
    id: "com/left_offset",
    normalizedOffset: { x: -0.28, y: 0, z: 0 },
  },
  "com/right_offset": {
    id: "com/right_offset",
    normalizedOffset: { x: 0.28, y: 0, z: 0 },
  },
};

export const PRIZE_VARIANT_FAMILIES: Record<
  string,
  PrizeVisualVariantFamily
> = {
  "variant/basic": {
    id: "variant/basic",
    colorIds: Object.keys(PRIZE_COLOR_PALETTE),
    finishIds: ["matte", "gloss"],
  },
};

export const PRIZE_DEFINITIONS: readonly PrizeDefinition[] = [
  {
    id: "prize/cube_small",
    displayName: "Small Cube",
    shapeFamily: "cube",
    dimensions: { x: 0.095, y: 0.095, z: 0.095 },
    nominalMassKg: 0.085,
    materialId: "material/plastic",
    massProfileId: "mass/standard",
    comProfileId: "com/centered",
    colliderProfileId: "box/basic",
    variantFamilyId: "variant/basic",
    tags: ["rigid", "starter"],
  },
  {
    id: "prize/box_standard",
    displayName: "Standard Box",
    shapeFamily: "box",
    dimensions: { x: 0.135, y: 0.085, z: 0.105 },
    nominalMassKg: 0.120,
    materialId: "material/cardboard_matte",
    massProfileId: "mass/standard",
    comProfileId: "com/centered",
    colliderProfileId: "box/basic",
    variantFamilyId: "variant/basic",
    tags: ["rigid", "box"],
  },
  {
    id: "prize/box_tall",
    displayName: "Tall Box",
    shapeFamily: "tall_box",
    dimensions: { x: 0.090, y: 0.165, z: 0.080 },
    nominalMassKg: 0.135,
    materialId: "material/cardboard_matte",
    massProfileId: "mass/standard",
    comProfileId: "com/bottom_heavy",
    colliderProfileId: "box/basic",
    variantFamilyId: "variant/basic",
    tags: ["rigid", "box", "tall"],
  },
  {
    id: "prize/box_flat",
    displayName: "Flat Box",
    shapeFamily: "flat_box",
    dimensions: { x: 0.160, y: 0.045, z: 0.120 },
    nominalMassKg: 0.110,
    materialId: "material/cardboard_matte",
    massProfileId: "mass/light",
    comProfileId: "com/centered",
    colliderProfileId: "box/basic",
    variantFamilyId: "variant/basic",
    tags: ["rigid", "box", "flat"],
  },
  {
    id: "prize/sphere_ball",
    displayName: "Rubber Ball",
    shapeFamily: "sphere",
    dimensions: { x: 0.105, y: 0.105, z: 0.105 },
    nominalMassKg: 0.075,
    materialId: "material/rubber",
    massProfileId: "mass/standard",
    comProfileId: "com/centered",
    colliderProfileId: "sphere/basic",
    variantFamilyId: "variant/basic",
    tags: ["round", "rolling"],
  },
  {
    id: "prize/ellipsoid_egg",
    displayName: "Egg Plush",
    shapeFamily: "ellipsoid",
    dimensions: { x: 0.100, y: 0.155, z: 0.100 },
    nominalMassKg: 0.080,
    materialId: "material/plush",
    massProfileId: "mass/light",
    comProfileId: "com/bottom_heavy",
    colliderProfileId: "ellipsoid/spheres_v1",
    variantFamilyId: "variant/basic",
    tags: ["soft", "compound"],
  },
  {
    id: "prize/cylinder_can",
    displayName: "Prize Can",
    shapeFamily: "cylinder",
    dimensions: { x: 0.080, y: 0.125, z: 0.080 },
    nominalMassKg: 0.125,
    materialId: "material/plastic",
    massProfileId: "mass/standard",
    comProfileId: "com/bottom_heavy",
    colliderProfileId: "cylinder/basic",
    variantFamilyId: "variant/basic",
    tags: ["rigid", "cylinder"],
  },
  {
    id: "prize/capsule_soft",
    displayName: "Capsule Plush",
    shapeFamily: "capsule",
    dimensions: { x: 0.095, y: 0.170, z: 0.095 },
    nominalMassKg: 0.090,
    materialId: "material/plush",
    massProfileId: "mass/standard",
    comProfileId: "com/centered",
    colliderProfileId: "capsule/basic",
    variantFamilyId: "variant/basic",
    tags: ["soft", "capsule"],
  },
  {
    id: "prize/pillow_small",
    displayName: "Small Pillow",
    shapeFamily: "pillow",
    dimensions: { x: 0.160, y: 0.060, z: 0.120 },
    nominalMassKg: 0.070,
    materialId: "material/fabric",
    massProfileId: "mass/light",
    comProfileId: "com/centered",
    colliderProfileId: "pillow/rounded_v1",
    variantFamilyId: "variant/basic",
    tags: ["soft", "pillow", "compound"],
  },
  {
    id: "prize/teddy_simple",
    displayName: "Simple Teddy",
    shapeFamily: "plush_humanoid",
    dimensions: { x: 0.200, y: 0.250, z: 0.090 },
    nominalMassKg: 0.095,
    materialId: "material/plush",
    massProfileId: "mass/standard",
    comProfileId: "com/bottom_heavy",
    colliderProfileId: "plush/teddy_v1",
    variantFamilyId: "variant/basic",
    tags: ["soft", "teddy", "compound"],
  },
  {
    id: "prize/animal_simple",
    displayName: "Simple Animal",
    shapeFamily: "plush_animal",
    dimensions: { x: 0.230, y: 0.140, z: 0.100 },
    nominalMassKg: 0.100,
    materialId: "material/plush",
    massProfileId: "mass/standard",
    comProfileId: "com/centered",
    colliderProfileId: "plush/animal_v1",
    variantFamilyId: "variant/basic",
    tags: ["soft", "animal", "compound"],
  },
] as const;

export function getPrizeDefinition(id: string): PrizeDefinition {
  const definition = PRIZE_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) {
    throw new Error(`Unknown prize definition: ${id}`);
  }
  return definition;
}
