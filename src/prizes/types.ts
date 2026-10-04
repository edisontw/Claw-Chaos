import type * as THREE from "three";
import type {
  RigidBodyHandle,
  Vec3,
} from "../physics/PhysicsRuntime";

export type PrizeShapeFamily =
  | "cube"
  | "box"
  | "tall_box"
  | "flat_box"
  | "sphere"
  | "ellipsoid"
  | "cylinder"
  | "capsule"
  | "ring"
  | "pillow"
  | "plush_humanoid"
  | "plush_animal";

export type PrizeMaterialCategory =
  | "cardboard_matte"
  | "cardboard_glossy"
  | "plastic"
  | "rubber"
  | "fabric"
  | "plush";

export interface PrizeMaterialProfile {
  id: string;
  category: PrizeMaterialCategory;
  staticFriction: number;
  dynamicFriction: number;
  restitution: number;
  visualRoughness: number;
  audioProfileId: string;
}

export interface PrizeMassProfile {
  id: string;
  multiplier: number;
}

export interface PrizeComProfile {
  id: string;
  /**
   * Normalized against each half-dimension. Values should remain inside [-1, 1].
   */
  normalizedOffset: Vec3;
}

export interface PrizeVisualVariantFamily {
  id: string;
  colorIds: readonly string[];
  finishIds: readonly ("matte" | "gloss")[];
}

export interface PrizeDefinition {
  id: string;
  displayName: string;
  shapeFamily: PrizeShapeFamily;
  dimensions: Vec3;
  nominalMassKg: number;
  materialId: string;
  massProfileId: string;
  comProfileId: string;
  colliderProfileId: string;
  variantFamilyId: string;
  tags?: readonly string[];
}

export interface PrizeVisualVariant {
  colorId: string;
  colorHex: number;
  finishId: "matte" | "gloss";
}

export interface ResolvedPrizeSpec {
  definition: PrizeDefinition;
  material: PrizeMaterialProfile;
  massProfile: PrizeMassProfile;
  comProfile: PrizeComProfile;
  massKg: number;
  centerOfMass: Vec3;
  principalAngularInertia: Vec3;
  variant: PrizeVisualVariant;
}

export interface PrizeSpawnOptions {
  position: Vec3;
  rotationYRadians?: number;
  variantSeed?: string | number;
  materialId?: string;
  massProfileId?: string;
  comProfileId?: string;
  enableContactAudio?: boolean;
}

export interface SpawnedPrize {
  body: RigidBodyHandle;
  renderObject: THREE.Object3D;
  resolved: ResolvedPrizeSpec;
}
