import * as THREE from "three";
import { createSeededRandom } from "../core/seededRng";
import type {
  DynamicMassPropertiesSpec,
  PhysicsRuntime,
  PrimitiveColliderSpec,
  Quaternion,
  Vec3,
} from "../physics/PhysicsRuntime";
import { createCompoundPrizeProfile } from "./compoundProfiles";
import { createRingLoopGeometry } from "./ringProfile";
import { createHighFidelityPrizeVisual } from "./highFidelityVisuals";
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

function spawnRotationQuaternion(
  rotationXRadians: number,
  rotationYRadians: number,
): Quaternion {
  const halfX = rotationXRadians * 0.5;
  const halfY = rotationYRadians * 0.5;
  const sinX = Math.sin(halfX);
  const cosX = Math.cos(halfX);
  const sinY = Math.sin(halfY);
  const cosY = Math.cos(halfY);

  // qY * qX: tilt the prize in its local X/Z plane, then yaw it in cabinet space.
  return {
    x: cosY * sinX,
    y: sinY * cosX,
    z: -sinY * sinX,
    w: cosY * cosX,
  };
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

function buildRoundedBoxColliders(
  dimensions: Vec3,
  radiusMeters: number,
): PrimitiveColliderSpec[] {
  const hx = dimensions.x * 0.5;
  const hy = dimensions.y * 0.5;
  const hz = dimensions.z * 0.5;
  const r = Math.min(
    radiusMeters,
    hx * 0.45,
    hy * 0.45,
    hz * 0.45,
  );
  const ix = hx - r;
  const iy = hy - r;
  const iz = hz - r;

  const colliders: PrimitiveColliderSpec[] = [
    {
      shape: "cuboid",
      halfExtents: { x: ix, y: iy, z: iz },
    },
    {
      shape: "cuboid",
      center: { x: hx - r * 0.5, y: 0, z: 0 },
      halfExtents: { x: r * 0.5, y: iy, z: iz },
    },
    {
      shape: "cuboid",
      center: { x: -hx + r * 0.5, y: 0, z: 0 },
      halfExtents: { x: r * 0.5, y: iy, z: iz },
    },
    {
      shape: "cuboid",
      center: { x: 0, y: hy - r * 0.5, z: 0 },
      halfExtents: { x: ix, y: r * 0.5, z: iz },
    },
    {
      shape: "cuboid",
      center: { x: 0, y: -hy + r * 0.5, z: 0 },
      halfExtents: { x: ix, y: r * 0.5, z: iz },
    },
    {
      shape: "cuboid",
      center: { x: 0, y: 0, z: hz - r * 0.5 },
      halfExtents: { x: ix, y: iy, z: r * 0.5 },
    },
    {
      shape: "cuboid",
      center: { x: 0, y: 0, z: -hz + r * 0.5 },
      halfExtents: { x: ix, y: iy, z: r * 0.5 },
    },
  ];

  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        colliders.push({
          shape: "sphere",
          center: {
            x: sx * ix,
            y: sy * iy,
            z: sz * iz,
          },
          radius: r,
        });
      }
    }
  }

  for (const sy of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      colliders.push({
        shape: "capsule",
        start: { x: -hx, y: sy * iy, z: sz * iz },
        end: { x: hx, y: sy * iy, z: sz * iz },
        radius: r,
      });
    }
  }
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      colliders.push({
        shape: "capsule",
        start: { x: sx * ix, y: -hy, z: sz * iz },
        end: { x: sx * ix, y: hy, z: sz * iz },
        radius: r,
      });
    }
  }
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      colliders.push({
        shape: "capsule",
        start: { x: sx * ix, y: sy * iy, z: -hz },
        end: { x: sx * ix, y: sy * iy, z: hz },
        radius: r,
      });
    }
  }

  return colliders;
}

function buildColliders(definition: PrizeDefinition): PrimitiveColliderSpec[] {
  const { x, y, z } = definition.dimensions;
  const half = { x: x * 0.5, y: y * 0.5, z: z * 0.5 };

  switch (definition.shapeFamily) {
    case "cube":
      if (definition.colliderProfileId === "box/rounded_v1") {
        return buildRoundedBoxColliders(
          definition.dimensions,
          Math.min(x, y, z) * 0.15,
        );
      }
      return [{ shape: "cuboid", halfExtents: half }];

    case "box":
    case "tall_box":
    case "flat_box":
      return [{ shape: "cuboid", halfExtents: half }];

    case "sphere":
      return [{ shape: "sphere", radius: x * 0.5 }];

    case "cylinder": {
      const radius = Math.min(x, z) * 0.5;
      if (definition.colliderProfileId === "cylinder/rimmed_v1") {
        // Match the real raised metal lips in the high-fidelity can visual.
        // These are attached to the same rigid body, not pickup shortcuts.
        return [
          {
            shape: "cylinder",
            halfHeight: y * 0.45,
            radius: radius * 0.92,
          },
          ...([-1, 1] as const).map((side): PrimitiveColliderSpec => ({
            shape: "cylinder",
            center: { x: 0, y: side * y * 0.466, z: 0 },
            halfHeight: y * 0.018,
            radius,
          })),
        ];
      }
      return [{ shape: "cylinder", halfHeight: y * 0.5, radius }];
    }

    case "capsule": {
      const radius = Math.min(x, z) * 0.5;
      return [{
        shape: "capsule",
        start: { x: 0, y: -y * 0.5, z: 0 },
        end: { x: 0, y: y * 0.5, z: 0 },
        radius,
      }];
    }

    case "ring":
      return [...createRingLoopGeometry().colliders];

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

    case "pillow":
    case "plush_humanoid":
    case "plush_animal":
      return createCompoundPrizeProfile(definition).colliders;

    default:
      throw new Error(
        `PrizeFactory does not implement collider family: ${definition.shapeFamily}`,
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
  if (family.colorIds.length === 0 || family.finishIds.length === 0) {
    throw new Error(`Invalid empty visual variant family: ${family.id}`);
  }

  const colorIndex = Math.floor(rng.next() * family.colorIds.length);
  const finishIndex = Math.floor(rng.next() * family.finishIds.length);
  const colorId = family.colorIds[colorIndex];
  const finishId = family.finishIds[finishIndex];

  if (colorId === undefined || finishId === undefined) {
    throw new Error(`Invalid visual variant family: ${family.id}`);
  }

  const colorHex =
    PRIZE_COLOR_PALETTE[colorId as keyof typeof PRIZE_COLOR_PALETTE];

  if (colorHex === undefined) {
    throw new Error(`Unknown prize color: ${colorId}`);
  }

  return { colorId, colorHex, finishId };
}

export interface PrizeVariantDescriptor {
  definitionId: string;
  colorId: string;
  colorHex: number;
  finishId: "matte" | "gloss";
}

export function enumeratePrizeVisualVariants(
  definitions: readonly PrizeDefinition[],
): PrizeVariantDescriptor[] {
  const variants: PrizeVariantDescriptor[] = [];

  for (const definition of definitions) {
    const family = requireProfile(
      PRIZE_VARIANT_FAMILIES,
      definition.variantFamilyId,
      "variant family",
    );

    for (const colorId of family.colorIds) {
      const colorHex =
        PRIZE_COLOR_PALETTE[
          colorId as keyof typeof PRIZE_COLOR_PALETTE
        ];
      if (colorHex === undefined) {
        throw new Error(`Unknown prize color: ${colorId}`);
      }

      for (const finishId of family.finishIds) {
        variants.push({
          definitionId: definition.id,
          colorId,
          colorHex,
          finishId,
        });
      }
    }
  }

  return variants;
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

function addCapsuleVisual(
  parent: THREE.Object3D,
  start: Vec3,
  end: Vec3,
  radius: number,
  material: THREE.Material,
): void {
  const startVector = new THREE.Vector3(start.x, start.y, start.z);
  const endVector = new THREE.Vector3(end.x, end.y, end.z);
  const direction = endVector.clone().sub(startVector);
  const length = direction.length();
  const cylinderHeight = Math.max(0.001, length - 2 * radius);
  const yAxis = new THREE.Vector3(0, 1, 0);

  const rod = configureMesh(
    new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, cylinderHeight, 16),
      material,
    ),
  );
  rod.position.copy(startVector).add(endVector).multiplyScalar(0.5);
  if (length > Number.EPSILON) {
    rod.quaternion.setFromUnitVectors(yAxis, direction.clone().normalize());
  }
  parent.add(rod);

  for (const point of [startVector, endVector]) {
    const cap = configureMesh(
      new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), material),
    );
    cap.position.copy(point);
    parent.add(cap);
  }
}

function buildCompoundVisual(
  definition: PrizeDefinition,
  material: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  const profile = createCompoundPrizeProfile(definition);

  for (const part of profile.visualParts) {
    if (part.shape === "sphere") {
      const mesh = configureMesh(
        new THREE.Mesh(
          new THREE.SphereGeometry(part.radius, 18, 12),
          material,
        ),
      );
      mesh.position.set(part.center.x, part.center.y, part.center.z);
      group.add(mesh);
    } else if (part.shape === "cuboid") {
      const mesh = configureMesh(
        new THREE.Mesh(
          new THREE.BoxGeometry(
            part.halfExtents.x * 2,
            part.halfExtents.y * 2,
            part.halfExtents.z * 2,
          ),
          material,
        ),
      );
      mesh.position.set(part.center.x, part.center.y, part.center.z);
      group.add(mesh);
    } else {
      addCapsuleVisual(
        group,
        part.start,
        part.end,
        part.radius,
        material,
      );
    }
  }

  return group;
}

function buildVisual(spec: ResolvedPrizeSpec): THREE.Object3D {
  const highFidelityVisual = createHighFidelityPrizeVisual(spec);
  if (highFidelityVisual) {
    return highFidelityVisual;
  }

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
      addCapsuleVisual(
        group,
        { x: 0, y: -y * 0.5, z: 0 },
        { x: 0, y: y * 0.5, z: 0 },
        radius,
        material,
      );
      return group;
    }

    case "ring": {
      const group = new THREE.Group();
      const geometry = createRingLoopGeometry();
      for (const collider of geometry.colliders) {
        if (collider.shape !== "capsule") {
          continue;
        }
        addCapsuleVisual(
          group,
          collider.start,
          collider.end,
          collider.radius,
          material,
        );
      }
      return group;
    }

    case "pillow":
    case "plush_humanoid":
    case "plush_animal":
      return buildCompoundVisual(spec.definition, material);

    default:
      throw new Error(
        `PrizeFactory does not implement visual family: ${spec.definition.shapeFamily}`,
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
  const rotationXRadians = options.rotationXRadians ?? 0;
  const rotationYRadians = options.rotationYRadians ?? 0;
  const body = physics.createDynamicBodyWithMassProperties(
    options.position,
    buildColliders(definition),
    massProperties,
    {
      friction: resolved.material.dynamicFriction,
      restitution: resolved.material.restitution,
      contactAudioProfileId: options.enableContactAudio
        ? resolved.material.audioProfileId
        : undefined,
    },
    spawnRotationQuaternion(
      rotationXRadians,
      rotationYRadians,
    ),
  );

  return {
    body,
    renderObject: buildVisual(resolved),
    resolved,
  };
}
