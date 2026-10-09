import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { ResolvedPrizeSpec } from "./types";
import { createRetailPrizeVisual } from "./retailPrizeVisuals";

export const HIGH_FIDELITY_PRIZE_VISUAL_IDS = [
  "prize/box_standard",
  "prize/cylinder_can",
  "prize/teddy_simple",
] as const;

function configureMesh(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function colorShift(baseHex: number, lightnessDelta: number): THREE.Color {
  const color = new THREE.Color(baseHex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(
    hsl.h,
    Math.min(1, hsl.s * 0.94 + 0.04),
    Math.min(0.92, Math.max(0.08, hsl.l + lightnessDelta)),
  );
  return color;
}

function matteMaterial(
  color: THREE.ColorRepresentation,
  roughness = 0.72,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
  });
}

function glossyMaterial(
  color: THREE.ColorRepresentation,
  roughness = 0.28,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.04,
  });
}

function markHighFidelity(
  object: THREE.Object3D,
  modelId: string,
): THREE.Object3D {
  object.userData.prizeVisualFidelity = "high-v1";
  object.userData.prizeVisualModel = modelId;
  return object;
}

function addCapsuleBetween(
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): void {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const bodyLength = Math.max(0.001, length - radius * 2);
  const capsule = configureMesh(
    new THREE.Mesh(
      new THREE.CapsuleGeometry(
        radius,
        bodyLength,
        5,
        14,
      ),
      material,
    ),
  );
  capsule.position.copy(start).add(end).multiplyScalar(0.5);
  if (length > Number.EPSILON) {
    capsule.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
  }
  parent.add(capsule);
}

function createPackagedBoxVisual(
  spec: ResolvedPrizeSpec,
): THREE.Object3D {
  const { x, y, z } = spec.definition.dimensions;
  const group = new THREE.Group();
  const baseColor = spec.variant.colorHex;
  const bodyMaterial =
    spec.variant.finishId === "gloss"
      ? glossyMaterial(baseColor, 0.30)
      : matteMaterial(baseColor, 0.78);
  const sleeveMaterial = glossyMaterial(
    colorShift(baseColor, 0.14),
    0.34,
  );
  const labelMaterial = matteMaterial(
    colorShift(baseColor, -0.20),
    0.56,
  );
  const tapeMaterial = glossyMaterial(0xf1e6cb, 0.42);

  const body = configureMesh(
    new THREE.Mesh(
      new RoundedBoxGeometry(
        x * 0.96,
        y * 0.94,
        z * 0.96,
        4,
        Math.min(x, y, z) * 0.055,
      ),
      bodyMaterial,
    ),
  );
  body.name = "prize-box-body";
  group.add(body);

  const sleeve = configureMesh(
    new THREE.Mesh(
      new RoundedBoxGeometry(
        x * 0.982,
        y * 0.38,
        z * 0.982,
        3,
        Math.min(x, y, z) * 0.035,
      ),
      sleeveMaterial,
    ),
  );
  sleeve.name = "prize-box-sleeve";
  sleeve.position.y = -y * 0.045;
  group.add(sleeve);

  const frontLabel = configureMesh(
    new THREE.Mesh(
      new RoundedBoxGeometry(
        x * 0.54,
        y * 0.23,
        0.003,
        3,
        Math.min(x, y) * 0.04,
      ),
      labelMaterial,
    ),
  );
  frontLabel.name = "prize-box-front-label";
  frontLabel.position.set(0, y * 0.08, z * 0.493);
  group.add(frontLabel);

  const topTape = configureMesh(
    new THREE.Mesh(
      new THREE.BoxGeometry(
        x * 0.19,
        0.0025,
        z * 0.73,
      ),
      tapeMaterial,
    ),
  );
  topTape.name = "prize-box-top-tape";
  topTape.position.y = y * 0.472;
  group.add(topTape);

  for (const side of [-1, 1] as const) {
    const sideBand = configureMesh(
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.0025,
          y * 0.28,
          z * 0.62,
        ),
        labelMaterial,
      ),
    );
    sideBand.name =
      side < 0
        ? "prize-box-side-label-left"
        : "prize-box-side-label-right";
    sideBand.position.set(
      side * x * 0.486,
      -y * 0.045,
      0,
    );
    group.add(sideBand);
  }

  return markHighFidelity(
    group,
    "packaged-box-rounded-v1",
  );
}

function createPrizeCanVisual(
  spec: ResolvedPrizeSpec,
): THREE.Object3D {
  const { x, y, z } = spec.definition.dimensions;
  const radius = Math.min(x, z) * 0.5;
  const group = new THREE.Group();
  const baseColor = spec.variant.colorHex;
  const bodyMaterial =
    spec.variant.finishId === "gloss"
      ? glossyMaterial(baseColor, 0.22)
      : matteMaterial(baseColor, 0.58);
  const labelMaterial = glossyMaterial(
    colorShift(baseColor, 0.16),
    0.30,
  );
  const stripeMaterial = matteMaterial(
    colorShift(baseColor, -0.20),
    0.50,
  );
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8dde2,
    roughness: 0.28,
    metalness: 0.78,
  });
  const tabMaterial = new THREE.MeshStandardMaterial({
    color: 0x7f868c,
    roughness: 0.34,
    metalness: 0.86,
  });

  const body = configureMesh(
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * 0.92,
        radius * 0.92,
        y * 0.88,
        32,
      ),
      bodyMaterial,
    ),
  );
  body.name = "prize-can-body";
  group.add(body);

  const labelBand = configureMesh(
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * 0.945,
        radius * 0.945,
        y * 0.48,
        32,
      ),
      labelMaterial,
    ),
  );
  labelBand.name = "prize-can-label-band";
  labelBand.position.y = -y * 0.02;
  group.add(labelBand);

  const stripe = configureMesh(
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * 0.953,
        radius * 0.953,
        y * 0.095,
        32,
      ),
      stripeMaterial,
    ),
  );
  stripe.name = "prize-can-stripe";
  stripe.position.y = y * 0.13;
  group.add(stripe);

  for (const side of [-1, 1] as const) {
    const rim = configureMesh(
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          radius,
          radius,
          y * 0.036,
          32,
        ),
        metalMaterial,
      ),
    );
    rim.name =
      side < 0
        ? "prize-can-bottom-rim"
        : "prize-can-top-rim";
    rim.position.y = side * y * 0.466;
    group.add(rim);
  }

  const topDisc = configureMesh(
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * 0.90,
        radius * 0.90,
        0.0024,
        32,
      ),
      metalMaterial,
    ),
  );
  topDisc.name = "prize-can-top-disc";
  topDisc.position.y = y * 0.486;
  group.add(topDisc);

  const pullTab = configureMesh(
    new THREE.Mesh(
      new THREE.TorusGeometry(
        radius * 0.24,
        radius * 0.055,
        8,
        18,
      ),
      tabMaterial,
    ),
  );
  pullTab.name = "prize-can-pull-tab";
  pullTab.rotation.x = Math.PI / 2;
  pullTab.scale.set(1.15, 0.72, 1);
  pullTab.position.set(
    radius * 0.07,
    y * 0.493,
    -radius * 0.05,
  );
  group.add(pullTab);

  return markHighFidelity(
    group,
    "prize-can-rim-tab-v1",
  );
}

function createTeddyVisual(
  spec: ResolvedPrizeSpec,
): THREE.Object3D {
  const { x, y, z } = spec.definition.dimensions;
  const sx = x / 0.20;
  const sy = y / 0.25;
  const sz = z / 0.09;
  const radialScale = Math.min(sx, sz);
  const group = new THREE.Group();
  const baseColor = spec.variant.colorHex;
  const furMaterial = matteMaterial(
    colorShift(baseColor, 0.03),
    0.95,
  );
  const muzzleMaterial = matteMaterial(0xe8cfad, 0.92);
  const bellyMaterial = matteMaterial(0xf0dcc1, 0.94);
  const darkMaterial = matteMaterial(0x2e2928, 0.86);
  const accentMaterial = matteMaterial(
    colorShift(baseColor, -0.24),
    0.88,
  );

  const bodyStart = new THREE.Vector3(
    0,
    -0.048 * sy,
    0,
  );
  const bodyEnd = new THREE.Vector3(
    0,
    0.034 * sy,
    0,
  );
  addCapsuleBetween(
    group,
    bodyStart,
    bodyEnd,
    0.035 * radialScale,
    furMaterial,
  );

  const head = configureMesh(
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.042 * radialScale,
        24,
        16,
      ),
      furMaterial,
    ),
  );
  head.name = "prize-teddy-head";
  head.position.set(0, 0.078 * sy, 0);
  group.add(head);

  for (const side of [-1, 1] as const) {
    const ear = configureMesh(
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.017 * radialScale,
          18,
          12,
        ),
        furMaterial,
      ),
    );
    ear.name =
      side < 0
        ? "prize-teddy-ear-left"
        : "prize-teddy-ear-right";
    ear.position.set(
      side * 0.031 * sx,
      0.108 * sy,
      -0.004 * sz,
    );
    group.add(ear);

    addCapsuleBetween(
      group,
      new THREE.Vector3(
        side * 0.027 * sx,
        0.020 * sy,
        0,
      ),
      new THREE.Vector3(
        side * 0.083 * sx,
        -0.019 * sy,
        0,
      ),
      0.014 * radialScale,
      furMaterial,
    );

    addCapsuleBetween(
      group,
      new THREE.Vector3(
        side * 0.020 * sx,
        -0.050 * sy,
        0,
      ),
      new THREE.Vector3(
        side * 0.034 * sx,
        -0.108 * sy,
        0,
      ),
      0.018 * radialScale,
      furMaterial,
    );

    const eye = configureMesh(
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.0055 * radialScale,
          14,
          10,
        ),
        darkMaterial,
      ),
    );
    eye.name =
      side < 0
        ? "prize-teddy-eye-left"
        : "prize-teddy-eye-right";
    eye.position.set(
      side * 0.015 * sx,
      0.086 * sy,
      0.035 * sz,
    );
    group.add(eye);

    const paw = configureMesh(
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.010 * radialScale,
          14,
          10,
        ),
        accentMaterial,
      ),
    );
    paw.name =
      side < 0
        ? "prize-teddy-paw-left"
        : "prize-teddy-paw-right";
    paw.scale.set(1, 0.62, 0.36);
    paw.position.set(
      side * 0.034 * sx,
      -0.112 * sy,
      0.017 * sz,
    );
    group.add(paw);
  }

  const muzzle = configureMesh(
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.020 * radialScale,
        18,
        12,
      ),
      muzzleMaterial,
    ),
  );
  muzzle.name = "prize-teddy-muzzle";
  muzzle.scale.set(1.2, 0.82, 0.48);
  muzzle.position.set(
    0,
    0.067 * sy,
    0.035 * sz,
  );
  group.add(muzzle);

  const nose = configureMesh(
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.006 * radialScale,
        14,
        10,
      ),
      darkMaterial,
    ),
  );
  nose.name = "prize-teddy-nose";
  nose.scale.set(1.15, 0.78, 0.72);
  nose.position.set(
    0,
    0.071 * sy,
    0.047 * sz,
  );
  group.add(nose);

  const belly = configureMesh(
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.025 * radialScale,
        18,
        12,
      ),
      bellyMaterial,
    ),
  );
  belly.name = "prize-teddy-belly";
  belly.scale.set(0.92, 1.18, 0.32);
  belly.position.set(
    0,
    -0.015 * sy,
    0.034 * sz,
  );
  group.add(belly);

  const bow = configureMesh(
    new THREE.Mesh(
      new THREE.TorusGeometry(
        0.009 * radialScale,
        0.0033 * radialScale,
        6,
        14,
      ),
      accentMaterial,
    ),
  );
  bow.name = "prize-teddy-neck-accent";
  bow.scale.set(1.65, 0.72, 1);
  bow.position.set(
    0,
    0.039 * sy,
    0.037 * sz,
  );
  group.add(bow);

  return markHighFidelity(
    group,
    "teddy-detailed-face-v1",
  );
}

export function createHighFidelityPrizeVisual(
  spec: ResolvedPrizeSpec,
): THREE.Object3D | null {
  switch (spec.definition.id) {
    case "prize/box_standard":
      return createPackagedBoxVisual(spec);
    case "prize/cylinder_can":
      return createPrizeCanVisual(spec);
    case "prize/teddy_simple":
      return createTeddyVisual(spec);
    default:
      return createRetailPrizeVisual(spec);
  }
}
