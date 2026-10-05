import * as THREE from "three";
import { M06_CABINET_CONFIG } from "./cabinetGeometry";
import type {
  EmissiveMaterialToken,
  SurfaceMaterialToken,
  VisualTheme,
} from "../theme/visualTheme";

export const CABINET_INTERIOR_VISUAL_ONLY = true;

type InteriorMaterialKey =
  | "backdrop"
  | "metalTrim"
  | "ledPrimary"
  | "ledSecondary";

export interface CabinetInteriorBoxSpec {
  id: string;
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
  material: InteriorMaterialKey;
  castShadow?: boolean;
}

function surfaceMaterial(
  token: SurfaceMaterialToken,
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: token.color,
    roughness: token.roughness,
    metalness: token.metalness,
    clearcoat: token.clearcoat,
    clearcoatRoughness: token.clearcoatRoughness,
  });
}

function emissiveMaterial(
  token: EmissiveMaterialToken,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: token.color,
    roughness: token.roughness,
    metalness: token.metalness,
    emissive: token.emissive,
    emissiveIntensity: token.emissiveIntensity,
  });
}

export function createCabinetInteriorBoxSpecs():
  CabinetInteriorBoxSpec[] {
  const c = M06_CABINET_CONFIG;
  const backZ = -c.interiorHalfZ + 0.015;
  const ceilingY = c.floorY + c.playAreaHeight - 0.024;

  return [
    {
      id: "theme-a-interior-backdrop",
      center: { x: 0, y: 0.79, z: backZ },
      halfExtents: { x: 0.405, y: 0.455, z: 0.006 },
      material: "backdrop",
    },
    {
      id: "theme-a-interior-backdrop-top-trim",
      center: { x: 0, y: 1.236, z: backZ + 0.008 },
      halfExtents: { x: 0.410, y: 0.008, z: 0.008 },
      material: "metalTrim",
    },
    {
      id: "theme-a-interior-backdrop-left-trim",
      center: { x: -0.414, y: 0.79, z: backZ + 0.008 },
      halfExtents: { x: 0.008, y: 0.455, z: 0.008 },
      material: "metalTrim",
    },
    {
      id: "theme-a-interior-backdrop-right-trim",
      center: { x: 0.414, y: 0.79, z: backZ + 0.008 },
      halfExtents: { x: 0.008, y: 0.455, z: 0.008 },
      material: "metalTrim",
    },
    {
      id: "theme-a-interior-accent-pink",
      center: { x: -0.385, y: 0.82, z: backZ + 0.015 },
      halfExtents: { x: 0.004, y: 0.390, z: 0.004 },
      material: "ledPrimary",
      castShadow: false,
    },
    {
      id: "theme-a-interior-accent-cyan",
      center: { x: 0.385, y: 0.82, z: backZ + 0.015 },
      halfExtents: { x: 0.004, y: 0.390, z: 0.004 },
      material: "ledSecondary",
      castShadow: false,
    },
    {
      id: "theme-a-ceiling-light-left",
      center: { x: -0.205, y: ceilingY, z: -0.045 },
      halfExtents: { x: 0.145, y: 0.006, z: 0.115 },
      material: "ledSecondary",
      castShadow: false,
    },
    {
      id: "theme-a-ceiling-light-right",
      center: { x: 0.205, y: ceilingY, z: -0.045 },
      halfExtents: { x: 0.145, y: 0.006, z: 0.115 },
      material: "ledPrimary",
      castShadow: false,
    },
    {
      id: "theme-a-ceiling-light-front-trim",
      center: { x: 0, y: ceilingY - 0.010, z: 0.095 },
      halfExtents: { x: 0.355, y: 0.006, z: 0.008 },
      material: "metalTrim",
    },
  ];
}

export function addCabinetInteriorVisual(
  scene: THREE.Scene,
  theme: VisualTheme,
): THREE.Group {
  const root = new THREE.Group();
  root.name = "art-theme-cabinet-interior";
  root.userData.visualOnly = true;

  const materials: Record<InteriorMaterialKey, THREE.Material> = {
    backdrop: surfaceMaterial(theme.machine.interior.backdrop),
    metalTrim: surfaceMaterial(theme.machine.exterior.metalTrim),
    ledPrimary: emissiveMaterial(
      theme.machine.exterior.ledPrimary,
    ),
    ledSecondary: emissiveMaterial(
      theme.machine.exterior.ledSecondary,
    ),
  };

  for (const spec of createCabinetInteriorBoxSpecs()) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        spec.halfExtents.x * 2,
        spec.halfExtents.y * 2,
        spec.halfExtents.z * 2,
      ),
      materials[spec.material],
    );
    mesh.name = spec.id;
    mesh.position.set(
      spec.center.x,
      spec.center.y,
      spec.center.z,
    );
    mesh.castShadow = spec.castShadow ?? true;
    mesh.receiveShadow = true;
    mesh.userData.visualOnly = true;
    root.add(mesh);
  }

  scene.add(root);
  return root;
}
