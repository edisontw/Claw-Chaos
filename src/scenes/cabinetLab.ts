import * as THREE from "three";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
  type CabinetPartDefinition,
} from "../cabinet/cabinetGeometry";
import { CabinetResultInventoryState } from "../cabinet/cabinetResultState";
import { CABINET_PLAY_TUNING } from "../cabinet/cabinetPlayTuning";
import { ChuteSensor } from "../cabinet/chuteSensor";
import type { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { getPrizeDefinition } from "../prizes/catalog";
import { createPrize } from "../prizes/PrizeFactory";
import { createGantryLabScene } from "./gantryLab";
import type { SimulationScene } from "./types";

function createPlayDeckWeaveTexture(): THREE.DataTexture {
  const size = 32;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const warp = x % 8 === 0 ? -7 : x % 4 === 0 ? -3 : 0;
      const weft = y % 8 === 0 ? -6 : y % 4 === 0 ? -2 : 0;
      const checker = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) * 3;
      const value = 168 + warp + weft + checker;

      data[index] = value;
      data[index + 1] = value + 7;
      data[index + 2] = value + 15;
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.5, 4.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const PLAY_DECK_WEAVE_TEXTURE = createPlayDeckWeaveTexture();

function createPartMaterial(
  part: CabinetPartDefinition,
): THREE.Material {
  if (part.role === "glass") {
    return new THREE.MeshPhysicalMaterial({
      color: 0xa7d8ff,
      transparent: true,
      opacity: 0.10,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  if (part.role === "chute_wall" || part.role === "chute_bottom") {
    return new THREE.MeshStandardMaterial({
      color: 0x2e3540,
      roughness: 0.82,
      metalness: 0.12,
    });
  }

  if (part.role === "floor") {
    return new THREE.MeshStandardMaterial({
      color: 0x555d68,
      roughness: 0.94,
      metalness: 0.02,
    });
  }

  if (part.role === "play_deck") {
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: PLAY_DECK_WEAVE_TEXTURE,
      roughness: 0.90,
      metalness: 0.01,
    });
  }

  return new THREE.MeshStandardMaterial({
    color: 0x303846,
    roughness: 0.66,
    metalness: 0.28,
  });
}

function addCabinetVisual(
  scene: THREE.Scene,
  part: CabinetPartDefinition,
): void {
  const geometry = new THREE.BoxGeometry(
    part.halfExtents.x * 2,
    part.halfExtents.y * 2,
    part.halfExtents.z * 2,
  );
  const mesh = new THREE.Mesh(
    geometry,
    createPartMaterial(part),
  );
  mesh.position.set(part.center.x, part.center.y, part.center.z);
  mesh.castShadow = part.role !== "glass";
  mesh.receiveShadow = part.role !== "glass";
  scene.add(mesh);

  if (part.role === "glass") {
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0x74bce8,
        transparent: true,
        opacity: 0.58,
      }),
    );
    outline.position.copy(mesh.position);
    scene.add(outline);
  }
}

function addControlPanel(scene: THREE.Scene): void {
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.11, 0.16),
    new THREE.MeshStandardMaterial({
      color: 0x343b46,
      roughness: 0.48,
      metalness: 0.30,
    }),
  );
  panel.position.set(
    0,
    0.11,
    M06_CABINET_CONFIG.interiorHalfZ + 0.12,
  );
  panel.rotation.x = -0.18;
  panel.castShadow = true;
  scene.add(panel);

  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.018, 24),
    new THREE.MeshStandardMaterial({
      color: 0xd94141,
      emissive: 0x5a0808,
      roughness: 0.38,
    }),
  );
  button.rotation.x = Math.PI * 0.5;
  button.position.set(
    0.11,
    0.165,
    M06_CABINET_CONFIG.interiorHalfZ + 0.105,
  );
  scene.add(button);
}

function addChuteTrim(scene: THREE.Scene): void {
  const c = M06_CABINET_CONFIG;
  const t = CABINET_PLAY_TUNING.chuteTrimHalfWidth;
  const halfHeight = CABINET_PLAY_TUNING.chuteTrimHalfHeight;
  const y = c.playDeckY + halfHeight + 0.001;
  const material = new THREE.MeshStandardMaterial({
    color: 0x202630,
    roughness: 0.58,
    metalness: 0.22,
  });

  const pieces = [
    {
      x: c.chuteCenterX - c.chuteOpeningHalfX - t,
      z: c.chuteCenterZ,
      hx: t,
      hz: c.chuteOpeningHalfZ + t * 2,
    },
    {
      x: c.chuteCenterX + c.chuteOpeningHalfX + t,
      z: c.chuteCenterZ,
      hx: t,
      hz: c.chuteOpeningHalfZ + t * 2,
    },
    {
      x: c.chuteCenterX,
      z: c.chuteCenterZ - c.chuteOpeningHalfZ - t,
      hx: c.chuteOpeningHalfX,
      hz: t,
    },
    {
      x: c.chuteCenterX,
      z: c.chuteCenterZ + c.chuteOpeningHalfZ + t,
      hx: c.chuteOpeningHalfX,
      hz: t,
    },
  ] as const;

  for (const piece of pieces) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        piece.hx * 2,
        halfHeight * 2,
        piece.hz * 2,
      ),
      material,
    );
    mesh.position.set(piece.x, y, piece.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    scene.add(mesh);
  }
}

export function createCabinetLabScene(
  scene: THREE.Scene,
  physics: PhysicsRuntime,
): SimulationScene {
  const parts = createCabinetPhysics(physics);
  for (const part of parts) {
    addCabinetVisual(scene, part);
  }

  addControlPanel(scene);
  addChuteTrim(scene);

  const cabinetLight = new THREE.PointLight(0xf4f7ff, 5.0, 2.2, 1.7);
  cabinetLight.position.set(-0.08, 1.08, 0.10);
  cabinetLight.castShadow = true;
  cabinetLight.shadow.mapSize.set(1024, 1024);
  cabinetLight.shadow.bias = -0.00035;
  cabinetLight.shadow.normalBias = 0.012;
  scene.add(cabinetLight);

  const gantryScene = createGantryLabScene(
    scene,
    physics,
    {
      addLabFloor: false,
      verticalHomeOffset:
        CABINET_PLAY_TUNING.verticalHomeOffsetMeters,
      addServiceWires: true,
      gripProfile: {
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque:
          CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque:
          CABINET_PLAY_TUNING.retainingTorque,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
      },
      playReturnTarget: {
        x: M06_CABINET_CONFIG.chuteCenterX,
        z: M06_CABINET_CONFIG.chuteCenterZ,
      },
      milestone: "M07 / First-person player view",
      camera: {
        position: [1.08, 1.00, 1.30],
        target: [0, 0.66, 0.02],
      },
    },
  );

  const sensor = new ChuteSensor();
  const resultInventory = new CabinetResultInventoryState();
  const bindings: SimulationScene["bindings"] = [
    ...gantryScene.bindings,
  ];
  const massPropertiesDebugTargets: NonNullable<
    SimulationScene["massPropertiesDebugTargets"]
  > = [
    ...(gantryScene.massPropertiesDebugTargets ?? []),
  ];
  const tracked: Array<{
    id: string;
    body: ReturnType<typeof createPrize>["body"];
  }> = [];

  const placements = [
    {
      id: "prize/cube_small",
      x: -0.24,
      z: -0.15,
      rotationYRadians: 0.18,
    },
    {
      id: "prize/sphere_ball",
      x: 0,
      z: 0,
      rotationYRadians: 0,
    },
    {
      id: "prize/teddy_simple",
      x: 0.18,
      z: -0.13,
      rotationYRadians: -0.22,
    },
    {
      id: "prize/pillow_small",
      x: -0.18,
      z: 0.13,
      rotationYRadians: 0.28,
    },
    {
      id: "prize/animal_simple",
      x: 0.06,
      z: 0.14,
      rotationYRadians: -0.12,
    },
  ];

  for (const [index, placement] of placements.entries()) {
    const definition = getPrizeDefinition(placement.id);
    const prize = createPrize(
      physics,
      definition,
      {
        position: {
          x: placement.x,
          y:
            M06_CABINET_CONFIG.playDeckY +
            definition.dimensions.y * 0.5 +
            0.002,
          z: placement.z,
        },
        rotationYRadians: placement.rotationYRadians,
        variantSeed: `m06-cabinet-${index}`,
      },
    );

    scene.add(prize.renderObject);
    bindings.push({
      mesh: prize.renderObject,
      body: prize.body,
    });
    massPropertiesDebugTargets.push({
      body: prize.body,
      label: placement.id,
    });
    tracked.push({
      id: `${placement.id}#${index}`,
      body: prize.body,
    });
  }

  return {
    bindings,
    massPropertiesDebugTargets,
    milestone: "M07 / First-person player view",
    camera: gantryScene.camera,
    primaryAction: () => gantryScene.primaryAction?.() ?? false,
    setManualGantryInput(x: number, z: number): void {
      gantryScene.setManualGantryInput?.(x, z);
    },
    beforePhysicsStep(stepSeconds: number): void {
      gantryScene.beforePhysicsStep?.(stepSeconds);

      for (const prize of tracked) {
        const event = sensor.pollPrize(prize.id, prize.body);
        if (event) {
          resultInventory.consume(event);
        }
      }
    },
    debugLines(): string[] {
      return [
        ...(gantryScene.debugLines?.() ?? []),
        "Cabinet           physical deck / walls / glass / ceiling",
        "Chute target      " +
          M06_CABINET_CONFIG.chuteCenterX.toFixed(3) +
          " / " +
          M06_CABINET_CONFIG.chuteCenterZ.toFixed(3) +
          " m",
        `Sensor wins       ${sensor.winCount}`,
        `Results accepted  ${resultInventory.resultCount}`,
        `Inventory prizes  ${resultInventory.inventoryCount}`,
        `Last result prize ${resultInventory.lastResult?.prizeId ?? "none"}`,
        "Glass             low-opacity pane + visible boundary outline",
        "Cabinet claw      +" +
          Math.round(
            CABINET_PLAY_TUNING.verticalHomeOffsetMeters * 1000,
          ) +
          " mm idle height / extended drop travel",
        "Cabinet grip      " +
          CABINET_PLAY_TUNING.fingerFriction.toFixed(2) +
          " / " +
          CABINET_PLAY_TUNING.closePickupTorque.toFixed(3) +
          " / " +
          CABINET_PLAY_TUNING.retainingTorque.toFixed(3) +
          " / " +
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters.toFixed(3) +
          " m pickup",
        "Depth cues        woven deck + fixed cabinet-light shadows",
        "Chute trim        raised solid rim / sensor debug hidden",
        "Service wires     dual visual control leads",
        "Center ball       aligned for first physical pickup attempt",
      ];
    },
  };
}
