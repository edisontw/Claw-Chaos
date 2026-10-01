import * as THREE from "three";
import {
  FIXED_TIMESTEP_SECONDS,
  MAX_FRAME_DELTA_SECONDS,
  MAX_PHYSICS_STEPS_PER_FRAME,
} from "../config/simulation";
import { FixedStepLoop } from "../core/FixedStepLoop";
import { DebugOverlay } from "../debug/DebugOverlay";
import { PhysicsDebugRenderer } from "../debug/PhysicsDebugRenderer";
import { RigidBodyMassPropertiesDebugRenderer } from "../debug/RigidBodyMassPropertiesDebug";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createClawLabScene, parseClawLabExperiment } from "../scenes/clawLab";
import { createPt003Scene } from "../scenes/pt003Scene";
import { createPt004Scene } from "../scenes/pt004Scene";
import { createPt005Scene } from "../scenes/pt005Scene";
import { createOversizedCloseScene } from "../scenes/oversizedCloseScene";
import { createFallingCubeScene } from "../scenes/fallingCube";
import { createGantryLabScene } from "../scenes/gantryLab";
import { createPrizeLabScene } from "../scenes/prizeLab";
import { createCabinetLabScene } from "../scenes/cabinetLab";
import { parseSceneSelection } from "../scenes/sceneSelection";
import type { SimulationScene } from "../scenes/types";

export async function startApp(root: HTMLElement): Promise<void> {
  const selection = parseSceneSelection(window.location.search);
  const physics = await PhysicsRuntime.create();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111722);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);

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

  const experiment = parseClawLabExperiment(window.location.search);
  const testScene: SimulationScene =
    selection.id === "gantry-lab"
      ? createGantryLabScene(scene, physics)
      : selection.id === "cabinet-lab"
        ? createCabinetLabScene(scene, physics)
      : selection.id === "prize-lab"
        ? createPrizeLabScene(scene, physics, selection.seed)
      : selection.id === "claw-lab"
        ? experiment === "pt003"
        ? createPt003Scene(scene, physics)
        : experiment === "pt004"
          ? createPt004Scene(scene, physics)
          : experiment === "pt005"
            ? createPt005Scene(scene, physics)
            : experiment === "oversized"
              ? createOversizedCloseScene(scene, physics)
              : createClawLabScene(scene, physics, window.location.search)
      : createFallingCubeScene(scene, physics, selection.seed);

  camera.position.set(...testScene.camera.position);
  camera.lookAt(...testScene.camera.target);

  const debugOverlay = new DebugOverlay(root);
  const physicsDebugRenderer = new PhysicsDebugRenderer(scene, false);
  const massPropertiesDebugRenderer =
    new RigidBodyMassPropertiesDebugRenderer(
      scene,
      testScene.massPropertiesDebugTargets ?? [],
      false,
    );
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
  let firstFrameRendered = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    if (event.code === "KeyD") {
      physicsDebugRenderer.toggle();
    } else if (event.code === "KeyM") {
      massPropertiesDebugRenderer.toggle();
    }
  };
  window.addEventListener("keydown", onKeyDown);

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
      testScene.beforePhysicsStep?.(stepSeconds);
      physics.step();
      physicsTicks += 1;
      simulationSeconds += stepSeconds;
    });
    droppedCatchUpSeconds += result.droppedSeconds;

    syncRenderTransforms();
    physicsDebugRenderer.update(physics.debugRender());
    massPropertiesDebugRenderer.update();
    renderer.render(scene, camera);

    if (!firstFrameRendered) {
      root.dataset.simulationReady = "true";
      firstFrameRendered = true;
    }

    debugOverlay.update({
      milestone: testScene.milestone,
      fps: smoothedFps,
      physicsTicks,
      sceneId: selection.id,
      seed: selection.seed,
      simulationSeconds,
      dynamicBodies: physics.dynamicBodyCount,
      droppedCatchUpSeconds,
      physicsDebugVisible: physicsDebugRenderer.visible,
      massPropertiesDebugVisible: massPropertiesDebugRenderer.visible,
      extraLines: testScene.debugLines?.(),
    });

    requestAnimationFrame(frame);
  };

  syncRenderTransforms();
  requestAnimationFrame(frame);
}
