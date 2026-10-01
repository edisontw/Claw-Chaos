import * as THREE from "three";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
  type CabinetPartDefinition,
} from "../cabinet/cabinetGeometry";
import { ChuteSensor } from "../cabinet/chuteSensor";
import type { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { getPrizeDefinition } from "../prizes/catalog";
import { createPrize } from "../prizes/PrizeFactory";
import { createGantryLabScene } from "./gantryLab";
import type { SimulationScene } from "./types";

function createPartMaterial(
  part: CabinetPartDefinition,
): THREE.Material {
  if (part.role === "glass") {
    return new THREE.MeshPhysicalMaterial({
      color: 0xa7d8ff,
      transparent: true,
      opacity: 0.14,
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
      color: 0x8a929d,
      roughness: 0.86,
      metalness: 0.03,
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
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      part.halfExtents.x * 2,
      part.halfExtents.y * 2,
      part.halfExtents.z * 2,
    ),
    createPartMaterial(part),
  );
  mesh.position.set(part.center.x, part.center.y, part.center.z);
  mesh.castShadow = part.role !== "glass";
  mesh.receiveShadow = part.role !== "glass";
  scene.add(mesh);
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

function addSensorDebugVolume(scene: THREE.Scene): void {
  const c = M06_CABINET_CONFIG;
  const geometry = new THREE.BoxGeometry(
    c.chuteSensorHalfX * 2,
    c.chuteSensorHalfY * 2,
    c.chuteSensorHalfZ * 2,
  );
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0x4cff9a,
      transparent: true,
      opacity: 0.85,
    }),
  );
  wire.position.set(
    c.chuteCenterX,
    c.chuteSensorCenterY,
    c.chuteCenterZ,
  );
  scene.add(wire);
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
  addSensorDebugVolume(scene);

  const cabinetLight = new THREE.PointLight(0xf4f7ff, 5.5, 2.2, 1.7);
  cabinetLight.position.set(0, 1.05, 0.02);
  scene.add(cabinetLight);

  const gantryScene = createGantryLabScene(
    scene,
    physics,
    {
      addLabFloor: false,
      playReturnTarget: {
        x: M06_CABINET_CONFIG.chuteCenterX,
        z: M06_CABINET_CONFIG.chuteCenterZ,
      },
      milestone: "M06 / Cabinet play lifecycle",
      camera: {
        position: [1.08, 1.00, 1.30],
        target: [0, 0.66, 0.02],
      },
    },
  );

  const sensor = new ChuteSensor();
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

  let lastWinPrizeId = "none";

  return {
    bindings,
    massPropertiesDebugTargets,
    milestone: "M06 / Cabinet play lifecycle",
    camera: gantryScene.camera,
    beforePhysicsStep(stepSeconds: number): void {
      gantryScene.beforePhysicsStep?.(stepSeconds);

      for (const prize of tracked) {
        const event = sensor.pollPrize(prize.id, prize.body);
        if (event) {
          lastWinPrizeId = event.prizeId;
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
        `Last sensor prize ${lastWinPrizeId}`,
        "Green wire box    chute sensor volume",
        "Center ball       aligned for first physical pickup attempt",
      ];
    },
  };
}
