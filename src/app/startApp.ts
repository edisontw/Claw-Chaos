import * as THREE from "three";
import {
  FIXED_TIMESTEP_SECONDS,
  MAX_FRAME_DELTA_SECONDS,
  MAX_PHYSICS_STEPS_PER_FRAME,
} from "../config/simulation";
import { FixedStepLoop } from "../core/FixedStepLoop";
import { DebugOverlay } from "../debug/DebugOverlay";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createFallingCubeScene } from "../scenes/fallingCube";
import { parseSceneSelection } from "../scenes/sceneSelection";

export async function startApp(root: HTMLElement): Promise<void> {
  const selection = parseSceneSelection(window.location.search);
  const physics = await PhysicsRuntime.create();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111722);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(6, 4.5, 7);
  camera.lookAt(0, 1, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x233047, 1.4));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(4, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const testScene = createFallingCubeScene(scene, physics, selection.seed);
  const debugOverlay = new DebugOverlay(root);
  const fixedStep = new FixedStepLoop(
    FIXED_TIMESTEP_SECONDS,
    MAX_PHYSICS_STEPS_PER_FRAME,
    MAX_FRAME_DELTA_SECONDS,
  );

  let physicsTicks = 0;
  let simulationSeconds = 0;
  let droppedCatchUpSeconds = 0;
  let lastFrameSeconds = performance.now() / 1000;
  let smoothedFps = 60;

  const resize = (): void => {
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  resize();
  window.addEventListener("resize", resize);

  const syncRenderTransforms = (): void => {
    for (const binding of testScene.bindings) {
      const position = binding.body.translation();
      const rotation = binding.body.rotation();
      binding.mesh.position.set(position.x, position.y, position.z);
      binding.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  };

  const frame = (nowMilliseconds: number): void => {
    const nowSeconds = nowMilliseconds / 1000;
    const frameDeltaSeconds = Math.max(0, nowSeconds - lastFrameSeconds);
    lastFrameSeconds = nowSeconds;

    if (frameDeltaSeconds > 0) {
      const instantaneousFps = 1 / frameDeltaSeconds;
      smoothedFps += (instantaneousFps - smoothedFps) * 0.08;
    }

    const result = fixedStep.advance(frameDeltaSeconds, (stepSeconds) => {
      physics.step();
      physicsTicks += 1;
      simulationSeconds += stepSeconds;
    });
    droppedCatchUpSeconds += result.droppedSeconds;

    syncRenderTransforms();
    renderer.render(scene, camera);

    debugOverlay.update({
      fps: smoothedFps,
      physicsTicks,
      sceneId: selection.id,
      seed: selection.seed,
      simulationSeconds,
      dynamicBodies: physics.dynamicBodyCount,
      droppedCatchUpSeconds,
    });

    requestAnimationFrame(frame);
  };

  syncRenderTransforms();
  requestAnimationFrame(frame);
}
