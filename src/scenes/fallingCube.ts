import * as THREE from "three";
import { createSeededRandom } from "../core/seededRng";
import type { PhysicsRuntime } from "../physics/PhysicsRuntime";
import type { SimulationScene } from "./types";

export function createFallingCubeScene(
  scene: THREE.Scene,
  physics: PhysicsRuntime,
  seed: string,
): SimulationScene {
  const rng = createSeededRandom(seed);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.2, 10),
    new THREE.MeshStandardMaterial({
      color: 0x6a7079,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  floor.position.set(0, -0.1, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  physics.createStaticCuboid({ x: 0, y: -0.1, z: 0 }, { x: 5, y: 0.1, z: 5 });

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0xf19a3e,
      roughness: 0.55,
      metalness: 0.08,
    }),
  );
  cube.castShadow = true;
  cube.receiveShadow = true;
  scene.add(cube);

  const body = physics.createDynamicCuboid(
    { x: 0, y: 3, z: 0 },
    { x: 0.5, y: 0.5, z: 0.5 },
    rng.range(-0.18, 0.18),
  );

  return {
    bindings: [{ mesh: cube, body }],
    milestone: "M00",
    camera: {
      position: [6, 4.5, 7],
      target: [0, 1, 0],
    },
  };
}
