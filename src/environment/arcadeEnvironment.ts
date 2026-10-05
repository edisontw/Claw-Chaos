import * as THREE from "three";
import type {
  EmissiveMaterialToken,
  SurfaceMaterialToken,
  VisualTheme,
} from "../theme/visualTheme";

export const ARCADE_ENVIRONMENT_VISUAL_ONLY = true;
export const ARCADE_ENVIRONMENT_ID =
  "theme-a-modern-japanese-arcade-room";

export interface NeighborMachinePlacement {
  id: string;
  x: number;
  z: number;
  accent: "primary" | "secondary";
  scale: number;
}

export const ARCADE_NEIGHBOR_MACHINE_PLACEMENTS:
  readonly NeighborMachinePlacement[] = [
    {
      id: "neighbor-left-near",
      x: -1.18,
      z: 0.02,
      accent: "primary",
      scale: 1,
    },
    {
      id: "neighbor-right-near",
      x: 1.18,
      z: 0.02,
      accent: "secondary",
      scale: 1,
    },
    {
      id: "neighbor-left-far",
      x: -1.92,
      z: -0.12,
      accent: "secondary",
      scale: 0.92,
    },
    {
      id: "neighbor-right-far",
      x: 1.92,
      z: -0.12,
      accent: "primary",
      scale: 0.92,
    },
  ] as const;

export interface CeilingFixturePlacement {
  id: string;
  x: number;
  z: number;
}

export const ARCADE_CEILING_FIXTURES:
  readonly CeilingFixturePlacement[] = [
    { id: "ceiling-left-back", x: -1.45, z: -0.65 },
    { id: "ceiling-center-back", x: 0, z: -0.65 },
    { id: "ceiling-right-back", x: 1.45, z: -0.65 },
    { id: "ceiling-left-front", x: -1.45, z: 0.75 },
    { id: "ceiling-center-front", x: 0, z: 0.75 },
    { id: "ceiling-right-front", x: 1.45, z: 0.75 },
  ] as const;

function physicalMaterial(
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
  intensityScale = 1,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: token.color,
    roughness: token.roughness,
    metalness: token.metalness,
    emissive: token.emissive,
    emissiveIntensity:
      token.emissiveIntensity * intensityScale,
  });
}

function makeCanvasSign(
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
  context.fillStyle = "#f7f9fb";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#263442";
  context.font = "800 92px Inter, Arial, sans-serif";
  context.fillText("CLAW CHAOS ARCADE", 512, 102);

  const pink = theme.machine.exterior.ledPrimary.color
    .toString(16)
    .padStart(6, "0");
  const cyan = theme.machine.exterior.ledSecondary.color
    .toString(16)
    .padStart(6, "0");
  context.fillStyle = `#${pink}`;
  context.fillRect(260, 172, 225, 10);
  context.fillStyle = `#${cyan}`;
  context.fillRect(539, 172, 225, 10);

  context.fillStyle = "#667483";
  context.font = "600 28px Inter, Arial, sans-serif";
  context.fillText("PRIZE FLOOR", 512, 220);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addWallAndFloor(
  root: THREE.Group,
  theme: VisualTheme,
): void {
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.035, 4.2),
    physicalMaterial(theme.environment.floor),
  );
  floor.name = "theme-a-arcade-floor";
  floor.position.set(0, -0.038, 0.30);
  floor.receiveShadow = true;
  floor.userData.visualOnly = true;
  root.add(floor);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 2.35, 0.08),
    physicalMaterial(theme.environment.wall),
  );
  wall.name = "theme-a-arcade-back-wall";
  wall.position.set(0, 1.14, -1.42);
  wall.receiveShadow = true;
  wall.userData.visualOnly = true;
  root.add(wall);

  const columnGeometry = new THREE.BoxGeometry(
    0.18,
    2.30,
    0.24,
  );
  const columnMaterial = physicalMaterial(
    theme.environment.ceilingFixture,
  );
  for (const x of [-2.38, 2.38]) {
    const column = new THREE.Mesh(
      columnGeometry,
      columnMaterial,
    );
    column.name =
      x < 0
        ? "theme-a-arcade-column-left"
        : "theme-a-arcade-column-right";
    column.position.set(x, 1.12, -0.45);
    column.castShadow = true;
    column.receiveShadow = true;
    column.userData.visualOnly = true;
    root.add(column);
  }
}

function addBackWallSign(
  root: THREE.Group,
  theme: VisualTheme,
): void {
  const signMaterial = emissiveMaterial(
    theme.environment.signage,
    0.78,
  );
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 0.38, 0.045),
    signMaterial,
  );
  backing.name = "theme-a-arcade-back-sign";
  backing.position.set(0, 1.92, -1.365);
  backing.castShadow = false;
  backing.userData.visualOnly = true;
  root.add(backing);

  const texture = makeCanvasSign(theme);
  if (!texture) {
    return;
  }

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.42, 0.32),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  face.name = "theme-a-arcade-back-sign-face";
  face.position.set(0, 1.92, -1.339);
  face.userData.visualOnly = true;
  root.add(face);
}

function addCeilingFixtures(
  root: THREE.Group,
  theme: VisualTheme,
): void {
  const fixtureGeometry = new THREE.BoxGeometry(
    0.78,
    0.035,
    0.16,
  );
  const shellMaterial = physicalMaterial(
    theme.environment.ceilingFixture,
  );
  const lightMaterial = emissiveMaterial(
    theme.environment.backgroundEmissive,
    0.82,
  );
  const diffuserGeometry = new THREE.BoxGeometry(
    0.68,
    0.012,
    0.11,
  );

  for (const fixture of ARCADE_CEILING_FIXTURES) {
    const shell = new THREE.Mesh(
      fixtureGeometry,
      shellMaterial,
    );
    shell.name = `theme-a-${fixture.id}-shell`;
    shell.position.set(fixture.x, 2.22, fixture.z);
    shell.castShadow = false;
    shell.userData.visualOnly = true;
    root.add(shell);

    const diffuser = new THREE.Mesh(
      diffuserGeometry,
      lightMaterial,
    );
    diffuser.name = `theme-a-${fixture.id}-diffuser`;
    diffuser.position.set(fixture.x, 2.195, fixture.z);
    diffuser.castShadow = false;
    diffuser.userData.visualOnly = true;
    root.add(diffuser);
  }
}

function addNeighborMachine(
  root: THREE.Group,
  placement: NeighborMachinePlacement,
  theme: VisualTheme,
  shared: {
    body: THREE.Material;
    trim: THREE.Material;
    dark: THREE.Material;
    primary: THREE.Material;
    secondary: THREE.Material;
    lowerGeometry: THREE.BoxGeometry;
    postGeometry: THREE.BoxGeometry;
    headerGeometry: THREE.BoxGeometry;
    windowGeometry: THREE.BoxGeometry;
    shelfGeometry: THREE.BoxGeometry;
    prizeGeometry: THREE.SphereGeometry;
  },
): void {
  const group = new THREE.Group();
  group.name = `theme-a-${placement.id}`;
  group.position.set(placement.x, 0, placement.z);
  group.scale.setScalar(placement.scale);
  group.userData.visualOnly = true;

  const lower = new THREE.Mesh(
    shared.lowerGeometry,
    shared.body,
  );
  lower.position.set(0, 0.26, 0);
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  for (const x of [-0.31, 0.31]) {
    const post = new THREE.Mesh(
      shared.postGeometry,
      shared.trim,
    );
    post.position.set(x, 1.03, 0.245);
    post.castShadow = true;
    group.add(post);
  }

  const header = new THREE.Mesh(
    shared.headerGeometry,
    placement.accent === "primary"
      ? shared.primary
      : shared.secondary,
  );
  header.position.set(0, 1.72, 0.22);
  header.castShadow = false;
  group.add(header);

  const window = new THREE.Mesh(
    shared.windowGeometry,
    shared.dark,
  );
  window.position.set(0, 1.02, 0.275);
  window.castShadow = false;
  group.add(window);

  const shelf = new THREE.Mesh(
    shared.shelfGeometry,
    shared.trim,
  );
  shelf.position.set(0, 0.63, 0.17);
  shelf.castShadow = true;
  group.add(shelf);

  const accentMaterials = [
    shared.primary,
    shared.secondary,
    shared.body,
  ];
  for (let index = 0; index < 3; index += 1) {
    const prize = new THREE.Mesh(
      shared.prizeGeometry,
      accentMaterials[index]!,
    );
    prize.position.set(
      -0.19 + index * 0.19,
      0.76 + (index % 2) * 0.035,
      0.205,
    );
    prize.scale.set(
      1,
      0.88 + index * 0.04,
      0.92,
    );
    prize.castShadow = false;
    group.add(prize);
  }

  root.add(group);
}

function addNeighborMachines(
  root: THREE.Group,
  theme: VisualTheme,
): void {
  const darkWindow = new THREE.MeshStandardMaterial({
    color: 0x26323e,
    roughness: 0.50,
    metalness: 0.08,
    transparent: true,
    opacity: 0.82,
  });

  const shared = {
    body: physicalMaterial(
      theme.environment.neighboringMachineBody,
    ),
    trim: physicalMaterial(
      theme.machine.exterior.metalTrim,
    ),
    dark: darkWindow,
    primary: emissiveMaterial(
      theme.machine.exterior.ledPrimary,
      0.64,
    ),
    secondary: emissiveMaterial(
      theme.machine.exterior.ledSecondary,
      0.64,
    ),
    lowerGeometry: new THREE.BoxGeometry(0.70, 0.52, 0.54),
    postGeometry: new THREE.BoxGeometry(0.055, 0.95, 0.055),
    headerGeometry: new THREE.BoxGeometry(0.70, 0.18, 0.08),
    windowGeometry: new THREE.BoxGeometry(0.55, 0.67, 0.028),
    shelfGeometry: new THREE.BoxGeometry(0.52, 0.035, 0.30),
    prizeGeometry: new THREE.SphereGeometry(0.09, 12, 9),
  };

  for (const placement of ARCADE_NEIGHBOR_MACHINE_PLACEMENTS) {
    addNeighborMachine(root, placement, theme, shared);
  }
}

function addPrizeDisplay(
  root: THREE.Group,
  theme: VisualTheme,
): void {
  const frameMaterial = physicalMaterial(
    theme.environment.neighboringMachineBody,
  );
  const shelfMaterial = physicalMaterial(
    theme.machine.exterior.metalTrim,
  );
  const primary = emissiveMaterial(
    theme.machine.exterior.ledPrimary,
    0.42,
  );
  const secondary = emissiveMaterial(
    theme.machine.exterior.ledSecondary,
    0.42,
  );
  const geometry = new THREE.SphereGeometry(0.085, 12, 9);

  for (const x of [-1.05, 1.05]) {
    const display = new THREE.Group();
    display.name =
      x < 0
        ? "theme-a-prize-display-left"
        : "theme-a-prize-display-right";
    display.position.set(x, 0, -1.31);
    display.userData.visualOnly = true;

    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.72, 0.055),
      frameMaterial,
    );
    backing.position.y = 0.88;
    backing.castShadow = false;
    display.add(backing);

    for (const y of [0.68, 0.93, 1.18]) {
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.025, 0.13),
        shelfMaterial,
      );
      shelf.position.set(0, y, 0.075);
      shelf.castShadow = false;
      display.add(shelf);
    }

    let index = 0;
    for (const y of [0.77, 1.02]) {
      for (const px of [-0.20, 0, 0.20]) {
        const prize = new THREE.Mesh(
          geometry,
          index % 2 === 0 ? primary : secondary,
        );
        prize.position.set(px, y, 0.095);
        prize.scale.set(1, 0.86, 0.94);
        prize.castShadow = false;
        display.add(prize);
        index += 1;
      }
    }

    root.add(display);
  }
}

export function addArcadeEnvironment(
  scene: THREE.Scene,
  theme: VisualTheme,
): THREE.Group {
  const root = new THREE.Group();
  root.name = ARCADE_ENVIRONMENT_ID;
  root.userData.visualOnly = true;

  addWallAndFloor(root, theme);
  addBackWallSign(root, theme);
  addCeilingFixtures(root, theme);
  addNeighborMachines(root, theme);
  addPrizeDisplay(root, theme);

  scene.add(root);
  return root;
}
