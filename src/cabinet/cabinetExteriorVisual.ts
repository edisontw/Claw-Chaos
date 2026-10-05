import * as THREE from "three";
import { M06_CABINET_CONFIG } from "./cabinetGeometry";
import type {
  EmissiveMaterialToken,
  SurfaceMaterialToken,
  VisualTheme,
} from "../theme/visualTheme";

export const CABINET_BRAND_NAME = "CLAW CHAOS";
export const CABINET_BRAND_SUBTITLE = "PRIZE STATION";
export const CABINET_EXTERIOR_VISUAL_ONLY = true;

type ExteriorMaterialKey =
  | "body"
  | "bodySecondary"
  | "frame"
  | "metalTrim"
  | "controlPanel"
  | "paymentPanel"
  | "prizeDoor"
  | "accessPanel"
  | "vent"
  | "ledPrimary"
  | "ledSecondary";

export interface CabinetExteriorBoxSpec {
  id: string;
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
  material: ExteriorMaterialKey;
  rotationX?: number;
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
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: token.color,
    roughness: token.roughness,
    metalness: token.metalness,
    clearcoat: token.clearcoat,
    clearcoatRoughness: token.clearcoatRoughness,
    emissive: token.emissive,
    emissiveIntensity: token.emissiveIntensity,
  });
}

export function createCabinetExteriorBoxSpecs():
  CabinetExteriorBoxSpec[] {
  const c = M06_CABINET_CONFIG;
  const frontGlassZ =
    c.interiorHalfZ + c.wallHalfThickness * 2;
  const lowerFrontZ = frontGlassZ + 0.030;
  const outerHalfX = c.interiorHalfX + 0.040;
  const headerY = c.floorY + c.playAreaHeight + 0.090;
  const panelCenterZ = frontGlassZ + 0.104;

  const specs: CabinetExteriorBoxSpec[] = [
    {
      id: "theme-a-lower-front-shell",
      center: { x: 0, y: 0.145, z: lowerFrontZ },
      halfExtents: { x: outerHalfX, y: 0.145, z: 0.026 },
      material: "body",
    },
    {
      id: "theme-a-lower-left-side",
      center: { x: -outerHalfX, y: 0.145, z: 0 },
      halfExtents: { x: 0.026, y: 0.145, z: c.interiorHalfZ + 0.030 },
      material: "bodySecondary",
    },
    {
      id: "theme-a-lower-right-side",
      center: { x: outerHalfX, y: 0.145, z: 0 },
      halfExtents: { x: 0.026, y: 0.145, z: c.interiorHalfZ + 0.030 },
      material: "bodySecondary",
    },
    {
      id: "theme-a-front-plinth",
      center: { x: 0, y: 0.034, z: lowerFrontZ + 0.038 },
      halfExtents: { x: outerHalfX + 0.012, y: 0.034, z: 0.038 },
      material: "bodySecondary",
    },
    {
      id: "theme-a-front-left-fascia",
      center: {
        x: -outerHalfX + 0.014,
        y: 0.785,
        z: frontGlassZ + 0.020,
      },
      halfExtents: { x: 0.028, y: 0.505, z: 0.026 },
      material: "body",
    },
    {
      id: "theme-a-front-right-fascia",
      center: {
        x: outerHalfX - 0.014,
        y: 0.785,
        z: frontGlassZ + 0.020,
      },
      halfExtents: { x: 0.028, y: 0.505, z: 0.026 },
      material: "body",
    },
    {
      id: "theme-a-header-shell",
      center: { x: 0, y: headerY, z: 0 },
      halfExtents: {
        x: outerHalfX + 0.016,
        y: 0.090,
        z: c.interiorHalfZ + 0.040,
      },
      material: "body",
    },
    {
      id: "theme-a-header-metal-cap",
      center: {
        x: 0,
        y: headerY + 0.094,
        z: 0,
      },
      halfExtents: {
        x: outerHalfX + 0.021,
        y: 0.008,
        z: c.interiorHalfZ + 0.045,
      },
      material: "metalTrim",
    },
    {
      id: "theme-a-marquee-face",
      center: {
        x: 0,
        y: headerY + 0.004,
        z: frontGlassZ + 0.054,
      },
      halfExtents: { x: 0.445, y: 0.058, z: 0.012 },
      material: "bodySecondary",
      castShadow: false,
    },
    {
      id: "theme-a-marquee-led-pink",
      center: {
        x: 0,
        y: headerY - 0.070,
        z: frontGlassZ + 0.068,
      },
      halfExtents: { x: 0.455, y: 0.005, z: 0.006 },
      material: "ledPrimary",
      castShadow: false,
    },
    {
      id: "theme-a-marquee-led-cyan",
      center: {
        x: 0,
        y: headerY + 0.073,
        z: frontGlassZ + 0.068,
      },
      halfExtents: { x: 0.455, y: 0.005, z: 0.006 },
      material: "ledSecondary",
      castShadow: false,
    },
    {
      id: "theme-a-control-panel-deck",
      center: { x: 0, y: 0.225, z: panelCenterZ },
      halfExtents: { x: 0.350, y: 0.034, z: 0.105 },
      material: "controlPanel",
      rotationX: -0.15,
    },
    {
      id: "theme-a-control-panel-fascia",
      center: {
        x: 0,
        y: 0.164,
        z: panelCenterZ + 0.113,
      },
      halfExtents: { x: 0.355, y: 0.066, z: 0.018 },
      material: "bodySecondary",
    },
    {
      id: "theme-a-payment-panel",
      center: {
        x: 0.305,
        y: 0.112,
        z: lowerFrontZ + 0.030,
      },
      halfExtents: { x: 0.095, y: 0.082, z: 0.012 },
      material: "paymentPanel",
      castShadow: false,
    },
    {
      id: "theme-a-payment-card-reader",
      center: {
        x: 0.305,
        y: 0.137,
        z: lowerFrontZ + 0.045,
      },
      halfExtents: { x: 0.057, y: 0.029, z: 0.006 },
      material: "accessPanel",
      castShadow: false,
    },
    {
      id: "theme-a-payment-coin-slot",
      center: {
        x: 0.305,
        y: 0.084,
        z: lowerFrontZ + 0.046,
      },
      halfExtents: { x: 0.030, y: 0.005, z: 0.006 },
      material: "metalTrim",
      castShadow: false,
    },
    {
      id: "theme-a-prize-output-door",
      center: {
        x: -0.285,
        y: 0.115,
        z: lowerFrontZ + 0.031,
      },
      halfExtents: { x: 0.145, y: 0.082, z: 0.014 },
      material: "prizeDoor",
      castShadow: false,
    },
    {
      id: "theme-a-prize-output-inset",
      center: {
        x: -0.285,
        y: 0.115,
        z: lowerFrontZ + 0.047,
      },
      halfExtents: { x: 0.118, y: 0.059, z: 0.004 },
      material: "frame",
      castShadow: false,
    },
    {
      id: "theme-a-access-panel",
      center: {
        x: 0.035,
        y: 0.102,
        z: lowerFrontZ + 0.030,
      },
      halfExtents: { x: 0.105, y: 0.071, z: 0.010 },
      material: "accessPanel",
      castShadow: false,
    },
    {
      id: "theme-a-lower-accent-pink",
      center: {
        x: -outerHalfX + 0.035,
        y: 0.150,
        z: lowerFrontZ + 0.031,
      },
      halfExtents: { x: 0.006, y: 0.116, z: 0.006 },
      material: "ledPrimary",
      castShadow: false,
    },
    {
      id: "theme-a-lower-accent-cyan",
      center: {
        x: outerHalfX - 0.035,
        y: 0.150,
        z: lowerFrontZ + 0.031,
      },
      halfExtents: { x: 0.006, y: 0.116, z: 0.006 },
      material: "ledSecondary",
      castShadow: false,
    },
  ];

  for (let index = 0; index < 5; index += 1) {
    specs.push({
      id: `theme-a-vent-slat-${index + 1}`,
      center: {
        x: 0.095,
        y: 0.052 + index * 0.019,
        z: lowerFrontZ + 0.043,
      },
      halfExtents: { x: 0.047, y: 0.004, z: 0.005 },
      material: "vent",
      castShadow: false,
    });
  }

  return specs;
}

function cssHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function createBrandTexture(
  theme: VisualTheme,
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#273342";
  context.font =
    "800 116px Inter, Arial, sans-serif";
  context.fillText(CABINET_BRAND_NAME, 512, 106);

  context.fillStyle = cssHex(
    theme.machine.exterior.ledPrimary.color,
  );
  context.fillRect(278, 174, 218, 8);
  context.fillStyle = cssHex(
    theme.machine.exterior.ledSecondary.color,
  );
  context.fillRect(528, 174, 218, 8);

  context.fillStyle = "#657181";
  context.font =
    "600 32px Inter, Arial, sans-serif";
  context.fillText(CABINET_BRAND_SUBTITLE, 512, 214);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addBrandFace(
  root: THREE.Group,
  theme: VisualTheme,
): void {
  const c = M06_CABINET_CONFIG;
  const frontGlassZ =
    c.interiorHalfZ + c.wallHalfThickness * 2;
  const headerY = c.floorY + c.playAreaHeight + 0.090;
  const texture = createBrandTexture(theme);
  if (!texture) {
    return;
  }

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.84, 0.145),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sign.name = "theme-a-claw-chaos-brand";
  sign.position.set(
    0,
    headerY + 0.004,
    frontGlassZ + 0.067,
  );
  sign.renderOrder = 4;
  root.add(sign);
}

function addCylinder(
  root: THREE.Group,
  id: string,
  radius: number,
  height: number,
  position: [number, number, number],
  material: THREE.Material,
  radialSegments = 20,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      radialSegments,
    ),
    material,
  );
  mesh.name = id;
  mesh.position.set(...position);
  mesh.castShadow = true;
  root.add(mesh);
  return mesh;
}

function addControls(
  root: THREE.Group,
  theme: VisualTheme,
): void {
  const c = M06_CABINET_CONFIG;
  const panelZ =
    c.interiorHalfZ + c.wallHalfThickness * 2 + 0.095;
  const exterior = theme.machine.exterior;

  const joystickBase = addCylinder(
    root,
    "theme-a-joystick-base",
    0.040,
    0.016,
    [-0.115, 0.273, panelZ],
    surfaceMaterial(exterior.joystickBase),
    24,
  );
  joystickBase.scale.set(1.15, 1, 1.15);

  addCylinder(
    root,
    "theme-a-joystick-stick",
    0.010,
    0.075,
    [-0.115, 0.318, panelZ],
    surfaceMaterial(exterior.joystickStick),
    18,
  );

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 24, 16),
    surfaceMaterial(exterior.joystickBall),
  );
  ball.name = "theme-a-joystick-ball";
  ball.position.set(-0.115, 0.365, panelZ);
  ball.castShadow = true;
  root.add(ball);

  const button = addCylinder(
    root,
    "theme-a-action-button",
    0.033,
    0.020,
    [0.115, 0.278, panelZ],
    emissiveMaterial(exterior.actionButton),
    28,
  );
  button.scale.set(1.08, 1, 1.08);
}

function addConstructionDetails(
  root: THREE.Group,
  theme: VisualTheme,
): void {
  const c = M06_CABINET_CONFIG;
  const frontZ =
    c.interiorHalfZ + c.wallHalfThickness * 2 + 0.061;
  const screwMaterial =
    surfaceMaterial(theme.machine.exterior.screw);

  for (const [x, y] of [
    [-0.058, 0.155],
    [0.128, 0.155],
    [-0.058, 0.050],
    [0.128, 0.050],
  ] as const) {
    const screw = new THREE.Mesh(
      new THREE.SphereGeometry(0.006, 12, 8),
      screwMaterial,
    );
    screw.name = `theme-a-access-screw-${x}-${y}`;
    screw.position.set(x, y, frontZ);
    root.add(screw);
  }

  const seamMaterial = new THREE.LineBasicMaterial({
    color: theme.machine.exterior.metalTrim.color,
    transparent: true,
    opacity: 0.52,
  });
  const seam = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(0.214, 0.146, 0.002),
    ),
    seamMaterial,
  );
  seam.name = "theme-a-access-panel-seam";
  seam.position.set(0.035, 0.102, frontZ + 0.001);
  root.add(seam);
}

export function addCabinetExteriorVisual(
  scene: THREE.Scene,
  theme: VisualTheme,
): THREE.Group {
  const root = new THREE.Group();
  root.name = "art-theme-cabinet-exterior";
  root.userData.visualOnly = true;

  const exterior = theme.machine.exterior;
  const materials: Record<
    ExteriorMaterialKey,
    THREE.Material
  > = {
    body: surfaceMaterial(exterior.body),
    bodySecondary: surfaceMaterial(exterior.bodySecondary),
    frame: surfaceMaterial(exterior.frame),
    metalTrim: surfaceMaterial(exterior.metalTrim),
    controlPanel: surfaceMaterial(exterior.controlPanel),
    paymentPanel: surfaceMaterial(exterior.paymentPanel),
    prizeDoor: surfaceMaterial(exterior.prizeDoor),
    accessPanel: surfaceMaterial(exterior.accessPanel),
    vent: surfaceMaterial(exterior.vent),
    ledPrimary: emissiveMaterial(exterior.ledPrimary),
    ledSecondary: emissiveMaterial(exterior.ledSecondary),
  };

  for (const spec of createCabinetExteriorBoxSpecs()) {
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
    mesh.rotation.x = spec.rotationX ?? 0;
    mesh.castShadow = spec.castShadow ?? true;
    mesh.receiveShadow = true;
    mesh.userData.visualOnly = true;
    root.add(mesh);
  }

  addControls(root, theme);
  addConstructionDetails(root, theme);
  addBrandFace(root, theme);

  scene.add(root);
  return root;
}
