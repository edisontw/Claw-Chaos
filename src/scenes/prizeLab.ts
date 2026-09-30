import * as THREE from "three";
import { createSeededRandom } from "../core/seededRng";
import type { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { PRIZE_DEFINITIONS } from "../prizes/catalog";
import { createPrize } from "../prizes/PrizeFactory";
import type { SimulationScene } from "./types";

export function createPrizeLabScene(
  scene: THREE.Scene,
  physics: PhysicsRuntime,
  seed: string,
): SimulationScene {
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.05, 1.5),
    new THREE.MeshStandardMaterial({
      color: 0x656c76,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  floor.position.set(0, -0.025, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  physics.createStaticCuboid(
    { x: 0, y: -0.025, z: 0 },
    { x: 1.1, y: 0.025, z: 0.75 },
  );

  const rng = createSeededRandom(seed);
  const bindings = [];
  const massPropertiesDebugTargets = [];

  for (const [index, definition] of PRIZE_DEFINITIONS.entries()) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const prize = createPrize(physics, definition, {
      position: {
        x: -0.45 + column * 0.30,
        y: 0.30 + row * 0.34,
        z: row === 0 ? -0.19 : 0.19,
      },
      rotationYRadians: rng.range(-0.35, 0.35),
      variantSeed: `${seed}:${definition.id}`,
    });

    scene.add(prize.renderObject);
    bindings.push({
      mesh: prize.renderObject,
      body: prize.body,
    });
    massPropertiesDebugTargets.push({
      body: prize.body,
      label: definition.id,
    });
  }

  return {
    bindings,
    massPropertiesDebugTargets,
    milestone: "M05 / PrizeFactory slice 1",
    camera: {
      position: [1.35, 1.05, 1.55],
      target: [0, 0.30, 0],
    },
    debugLines(): string[] {
      return [
        "PrizeFactory      data-driven starter catalog",
        "Shapes            cube box tall flat sphere ellipsoid cylinder capsule",
        "Profiles          4 material | 3 mass | 5 COM",
        "Variants          8 colors x 2 finishes",
        "M                COM/origin debug",
        "D                collider debug",
      ];
    },
  };
}
