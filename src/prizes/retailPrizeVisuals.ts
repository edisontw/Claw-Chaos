import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { ResolvedPrizeSpec } from "./types";

// Product decoration is render-only: the existing physical body, friction,
// mass and collider envelopes remain the only sources of contact and pickup.
function material(color: THREE.ColorRepresentation, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.01 });
}

function attach(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function finish(group: THREE.Group, model: string): THREE.Group {
  group.userData.prizeVisualFidelity = "high-v1";
  group.userData.prizeVisualModel = model;
  return group;
}

function giftBox(spec: ResolvedPrizeSpec): THREE.Object3D {
  const { x, y, z } = spec.definition.dimensions;
  const group = new THREE.Group();
  const boxMaterial = material(spec.variant.colorHex, 0.66);
  const ribbonMaterial = material(0xffe3ab, 0.52);
  const sealMaterial = material(0xffffff, 0.78);
  const top = y * 0.465;
  const ribbonThickness = Math.min(y * 0.065, 0.0045);
  attach(
    group, "gift-box-body",
    new RoundedBoxGeometry(x * 0.96, y * 0.92, z * 0.96, 3, Math.min(x, y, z) * 0.075),
    boxMaterial, 0, 0, 0,
  );
  // A ribbon wraps across all visible sides, rather than being a floating
  // block or a plain geometric test cube.
  attach(group, "gift-ribbon-x", new THREE.BoxGeometry(x * 0.14, ribbonThickness, z * 0.94),
    ribbonMaterial, 0, top, 0);
  attach(group, "gift-ribbon-z", new THREE.BoxGeometry(x * 0.94, ribbonThickness, z * 0.14),
    ribbonMaterial, 0, top + ribbonThickness * 0.1, 0);
  for (const side of [-1, 1]) {
    attach(group, `gift-front-ribbon-${side}`,
      new THREE.BoxGeometry(x * 0.14, y * 0.75, ribbonThickness),
      ribbonMaterial, 0, 0, side * z * 0.473);
    attach(group, `gift-side-ribbon-${side}`,
      new THREE.BoxGeometry(ribbonThickness, y * 0.75, z * 0.14),
      ribbonMaterial, side * x * 0.473, 0, 0);
  }
  const loopRadius = Math.min(x, z) * 0.12;
  for (const side of [-1, 1]) {
    const loop = attach(group, `gift-bow-loop-${side}`,
      new THREE.TorusGeometry(loopRadius, loopRadius * 0.24, 6, 14),
      ribbonMaterial, side * loopRadius * 0.72, top + ribbonThickness * 0.8, 0);
    loop.rotation.x = Math.PI / 2;
    loop.rotation.y = side * 0.24;
  }
  attach(group, "gift-seal", new THREE.SphereGeometry(loopRadius * 0.30, 10, 8),
    sealMaterial, 0, top + ribbonThickness, 0);
  return finish(group, "retail-gift-ribbon-v1");
}

function plushCushion(spec: ResolvedPrizeSpec): THREE.Object3D {
  const { x, y, z } = spec.definition.dimensions;
  const group = new THREE.Group();
  const fabric = material(spec.variant.colorHex, 0.98);
  const seam = material(0xffe5d2, 0.95);
  const detail = material(0x513d51, 0.90);
  attach(
    group, "cushion-fabric",
    new RoundedBoxGeometry(x * 0.96, y * 0.92, z * 0.96, 4, y * 0.29),
    fabric, 0, 0, 0,
  );
  const front = z * 0.475;
  const applique = attach(group, "cushion-cloud-patch",
    new THREE.SphereGeometry(x * 0.145, 16, 12), seam, 0, 0, front);
  applique.scale.set(1.55, 0.55, 0.14);
  for (const side of [-1, 1]) {
    attach(group, `cushion-embroidered-eye-${side}`,
      new THREE.SphereGeometry(x * 0.013, 10, 8), detail,
      side * x * 0.040, y * 0.025, front + x * 0.016);
  }
  const smile = attach(group, "cushion-embroidered-smile",
    new THREE.TorusGeometry(x * 0.028, x * 0.006, 5, 12, Math.PI),
    detail, 0, -y * 0.044, front + x * 0.016);
  smile.rotation.z = Math.PI;
  return finish(group, "embroidered-plush-cushion-v1");
}

function animalPlush(spec: ResolvedPrizeSpec): THREE.Object3D {
  const { x, y, z } = spec.definition.dimensions;
  const sx = x / 0.23, sy = y / 0.14, sz = z / 0.10;
  const group = new THREE.Group();
  const fur = material(spec.variant.colorHex, 0.97);
  const cream = material(0xf7ead9, 0.96);
  const blush = material(0xe5a1a9, 0.92);
  const dark = material(0x332e39, 0.85);

  // Long soft body and four legs match the existing 4-legged compound
  // contact silhouette. Features are decorative, not hidden hooks.
  const torso = attach(group, "animal-torso",
    new THREE.CapsuleGeometry(0.033 * Math.min(sy, sz), 0.118 * sx, 5, 14),
    fur, -0.009 * sx, 0.014 * sy, 0);
  torso.rotation.z = Math.PI / 2;
  attach(group, "animal-head",
    new THREE.SphereGeometry(0.035 * Math.min(sy, sz), 20, 14),
    fur, 0.076 * sx, 0.034 * sy, 0);
  for (const side of [-1, 1]) {
    const paw = attach(group, `animal-soft-paw-${side}-near`,
      new THREE.CapsuleGeometry(0.014 * sz, 0.037 * sy, 4, 10),
      fur, side < 0 ? -0.055 * sx : 0.032 * sx, -0.040 * sy, 0.025 * sz);
    paw.rotation.z = 0.05;
    attach(group, `animal-soft-paw-${side}-far`,
      new THREE.CapsuleGeometry(0.013 * sz, 0.037 * sy, 4, 10),
      fur, side < 0 ? -0.055 * sx : 0.032 * sx, -0.040 * sy, -0.025 * sz);
    // Small ears and embroidered face, within the calibrated plush envelope.
    const ear = attach(group, `animal-ear-${side}`,
      new THREE.ConeGeometry(0.013 * sx, 0.031 * sy, 7),
      fur, (0.077 + side * 0.022) * sx, 0.075 * sy, side * 0.017 * sz);
    ear.rotation.z = side * -0.10;
    attach(group, `animal-eye-${side}`,
      new THREE.SphereGeometry(0.005 * Math.min(sx, sy), 12, 8),
      dark, (0.074 + side * 0.019) * sx, 0.043 * sy, 0.032 * sz);
  }
  const muzzle = attach(group, "animal-muzzle",
    new THREE.SphereGeometry(0.018 * sy, 16, 12),
    cream, 0.077 * sx, 0.019 * sy, 0.028 * sz);
  muzzle.scale.set(1.15, 0.72, 0.65);
  attach(group, "animal-nose", new THREE.SphereGeometry(0.005 * sz, 12, 8),
    blush, 0.078 * sx, 0.026 * sy, 0.041 * sz);
  const tail = attach(group, "animal-tail",
    new THREE.CapsuleGeometry(0.010 * sz, 0.026 * sx, 4, 10),
    fur, -0.100 * sx, 0.039 * sy, 0);
  tail.rotation.z = 0.85;
  return finish(group, "soft-animal-face-paws-v1");
}

export function createRetailPrizeVisual(spec: ResolvedPrizeSpec): THREE.Object3D | null {
  switch (spec.definition.id) {
    case "prize/box_tall":
    case "prize/box_flat":
      return giftBox(spec);
    case "prize/pillow_small":
      return plushCushion(spec);
    case "prize/animal_simple":
      return animalPlush(spec);
    default:
      return null;
  }
}
