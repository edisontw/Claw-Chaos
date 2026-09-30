import * as THREE from "three";
import { createSeededRandom } from "../core/seededRng";
import type {
  DynamicMassPropertiesSpec,
  PhysicsRuntime,
  PrimitiveColliderSpec,
  Quaternion,
  Vec3,
} from "../physics/PhysicsRuntime";
import {
  PRIZE_COLOR_PALETTE,
  PRIZE_COM_PROFILES,
  PRIZE_MASS_PROFILES,
  PRIZE_MATERIAL_PROFILES,
  PRIZE_VARIANT_FAMILIES,
} from "./catalog";
import type {
  PrizeDefinition,
  PrizeSpawnOptions,
  PrizeVisualVariant,
  ResolvedPrizeSpec,
  SpawnedPrize,
} from "./types";

function requireProfile<T>(
  map: Record<string, T>,
  id: string,
  kind: string,
): T {
  const value = map[id];
  if (!value) {
    throw new Error(`Unknown ${kind}: ${id}`);
  }
  return value;
}

function rotationYQuaternion(radians: number): Quaternion {
  const half = radians * 0.5;
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
}

function resolveCenterOfMass(
  dimensions: Vec3,
  normalizedOffset: Vec3,
): Vec3 {
  return {
    x: normalizedOffset.x * dimensions.x * 0.5,
    y: normalizedOffset.y * dimensions.y * 0.5,
    z: normalizedOffset.z * dimensions.z * 0.5,
  };
}

function estimatePrincipalAngularInertia(
  definition: PrizeDefinition,
  massKg: number,
): Vec3 {
  const { x, y, z } = definition.dimensions;

  if (definition.shapeFamily === "sphere") {
    const radius = x * 0.5;
    const inertia = (2 / 5) * massKg * radius ** 2;
    return { x: inertia, y: inertia, z: inertia };
  }

  if (definition.shapeFamily === "cylinder") {
    const radius = Math.min(x, z) * 0.5;
    const ixz = (massKg / 12) * (3 * radius ** 2 + y ** 2);
    const iy = 0.5 * massKg * radius ** 2;
    return { x: ixz, y: iy, z: ixz };
  }

  if (definition.shapeFamily === "ellipsoid") {
    const a = x * 0.5;
    const b = y * 0.5;
    const c = z * 0.5;
    return {
      x: (massKg / 5) * (b ** 2 + c ** 2),
      y: (massKg / 5) * (a ** 2 + c ** 2),
      z: (massKg / 5) * (a ** 2 + b ** 2),
    };
  }

  return {
    x: (massKg / 12) * (y ** 2 + z ** 2),
    y: (massKg / 12) * (x ** 2 + z ** 2),
    z: (massKg / 12) * (x ** 2 + y ** 2),
  };
}

function buildColliders(definition: PrizeDefinition): PrimitiveColliderSpec[] {
  const { x, y, z } = definition.dimensions;
  const half = { x: x * 0.5, y: y * 0.5, z: z * 0.5 };

  switch (definition.shapeFamily) {
    case "cube":
    case "box":
    case "tall_box":
    case "flat_box":
      return [{ shape: "cuboid", halfExtents: half }];

    case "sphere":
      return [{ shape: "sphere", radius: x * 0.5 }];

    case "cylinder":
      return [{
        shape: "cylinder",
        halfHeight: y * 0.5,
        radius: Math.min(x, z) * 0.5,
      }];

    case "capsule": {
      const radius = Math.min(x, z) * 0.5;
      return [{
        shape: "capsule",
        start: { x: 0, y: -y * 0.5, z: 0 },
        end: { x: 0, y: y * 0.5, z: 0 },
        radius,
      }];
    }

    case "ellipsoid": {
      const centralRadius = Math.min(x, z) * 0.5;
      const endRadius = centralRadius * 0.8;
      const offset = Math.max(0, y * 0.5 - endRadius);
      return [
        { shape: "sphere", center: { x: 0, y: 0, z: 0 }, radius: centralRadius },
        { shape: "sphere", center: { x: 0, y: offset, z: 0 }, radius: endRadius },
        { shape: "sphere", center: { x: 0, y: -offset, z: 0 }, radius: endRadius },
      ];
    }

    default:
      throw new Error(
        `M05 slice 1 does not yet implement collider family: ${definition.shapeFamily}`,
      );
  }
}

function chooseVariant(
  definition: PrizeDefinition,
  seed: string | number,
): PrizeVisualVariant {
  const family = requireProfile(
    PRIZE_VARIANT_FAMILIES,
    definition.variantFamilyId,
    "variant family",
  );
  const rng = createSeededRandom(seed);
  const colorIndex = Math.floor(rng.next() * family.colorIds.length);
  const finishIndex = Math.floor(rng.next() * family.finishIds.length);
  const colorId = family.colorIds[colorIndex] ?? family.colorIds[0];
  const finishId = family.finishIds[finishIndex] ?? family.finishIds[0];
  const colorHex =
    PRIZE_COLOR_PALETTE[colorId as keyof typeof PRIZE_COLOR_PALETTE];

  if (colorHex === undefined || finishId === undefined) {
    throw new Error(`Invalid visual variant family: ${family.id}`);
  }

  return { colorId, colorHex, finishId };
}

export function resolvePrizeSpec(
  definition: PrizeDefinition,
  options: Omit<PrizeSpawnOptions, "position" | "rotationYRadians"> = {},
): ResolvedPrizeSpec {
  const material = requireProfile(
    PRIZE_MATERIAL_PROFILES,
    options.materialId ?? definition.materialId,
    "material profile",
  );
  const massProfile = requireProfile(
    PRIZE_MASS_PROFILES,
    options.massProfileId ?? definition.massProfileId,
    "mass profile",
  );
  const comProfile = requireProfile(
    PRIZE_COM_PROFILES,
    options.comProfileId ?? definition.comProfileId,
    "COM profile",
  );
  const massKg = definition.nominalMassKg * massProfile.multiplier;
  const centerOfMass = resolveCenterOfMass(
    definition.dimensions,
    comProfile.normalizedOffset,
  );

  return {
    definition,
    material,
    massProfile,
    comProfile,
    massKg,
    centerOfMass,
    principalAngularInertia:
      estimatePrincipalAngularInertia(definition, massKg),
    variant: chooseVariant(
      definition,
      options.variantSeed ?? definition.id,
    ),
  };
}

function createVisualMaterial(
  spec: ResolvedPrizeSpec,
): THREE.MeshStandardMaterial {
  const glossy = spec.variant.finishId === "gloss";
  return new THREE.MeshStandardMaterial({
    color: spec.variant.colorHex,
    roughness: glossy
      ? Math.max(0.18, spec.material.visualRoughness - 0.28)
      : spec.material.visualRoughness,
    metalness: 0.02,
  });
}

function configureMesh(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildVisual(spec: ResolvedPrizeSpec): THREE.Object3D {
  const { x, y, z } = spec.definition.dimensions;
  const material = createVisualMaterial(spec);

  switch (spec.definition.shapeFamily) {
    case "cube":
    case "box":
    case "tall_box":
    case "flat_box":
      return configureMesh(
        new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material),
      );

    case "sphere":
      return configureMesh(
        new THREE.Mesh(new THREE.SphereGeometry(x * 0.5, 24, 16), material),
      );

    case "ellipsoid": {
      const mesh = configureMesh(
        new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), material),
      );
      mesh.scale.set(x, y, z);
      return mesh;
    }

    case "cylinder":
      return configureMesh(
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            Math.min(x, z) * 0.5,
            Math.min(x, z) * 0.5,
            y,
            24,
          ),
          material,
        ),
      );

    case "capsule": {
      const group = new THREE.Group();
      const radius = Math.min(x, z) * 0.5;
      const cylinderHeight = Math.max(0.001, y - 2 * radius);
      const cylinder = configureMesh(
        new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, cylinderHeight, 20),
          material,
        ),
      );
      const top = configureMesh(
        new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 12), material),
      );
      const bottom = configureMesh(
        new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 12), material),
      );
      top.position.y = cylinderHeight * 0.5;
      bottom.position.y = -cylinderHeight * 0.5;
      group.add(cylinder, top, bottom);
      return group;
    }

    default:
      throw new Error(
        `M05 slice 1 does not yet implement visual family: ${spec.definition.shapeFamily}`,
      );
  }
}

export function createPrize(
  physics: PhysicsRuntime,
  definition: PrizeDefinition,
  options: PrizeSpawnOptions,
): SpawnedPrize {
  const resolved = resolvePrizeSpec(definition, options);
  const massProperties: DynamicMassPropertiesSpec = {
    massKg: resolved.massKg,
    centerOfMass: resolved.centerOfMass,
    principalAngularInertia: resolved.principalAngularInertia,
  };
  const rotationYRadians = options.rotationYRadians ?? 0;
  const body = physics.createDynamicBodyWithMassProperties(
    options.position,
    buildColliders(definition),
    massProperties,
    {
      friction: resolved.material.dynamicFriction,
      restitution: resolved.material.restitution,
    },
    rotationYQuaternion(rotationYRadians),
  );

  return {
    body,
    renderObject: buildVisual(resolved),
    resolved,
  };
}
