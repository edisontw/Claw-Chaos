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
import type { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  FirstPersonPlayerViewController,
  M07_CAMERA_FOV_DEGREES,
  M07_MOBILE_CAMERA_FOV_DEGREES,
  M07_CABINET_VIEW_TARGETS,
  M07_MOBILE_FIRST_PERSON_VIEW_CONFIG,
} from "../player/firstPersonPlayerView";
import { MobileCabinetControls } from "../player/mobileCabinetControls";
import {
  chooseRenderQualityProfile,
  isTouchLikeEnvironment,
} from "../player/mobileRenderProfile";
import { parseSceneSelection, type SceneSelection } from "../scenes/sceneSelection";
import type { SimulationScene } from "../scenes/types";

type SceneFactory = (
  scene: THREE.Scene,
  physics: PhysicsRuntime,
) => SimulationScene;

async function loadSelectedSceneFactory(
  selection: SceneSelection,
  search: string,
): Promise<SceneFactory> {
  switch (selection.id) {
    case "cabinet-lab": {
      const [
        { createCabinetLabScene },
        { parseCabinetLayoutSelection },
      ] = await Promise.all([
        import("../scenes/cabinetLab"),
        import("../layouts/cabinetLayouts"),
      ]);
      const layoutSelection =
        parseCabinetLayoutSelection(search);
      return (scene, physics) =>
        createCabinetLabScene(scene, physics, {
          layoutId: layoutSelection.id,
          layoutSeed: selection.seed,
        });
    }
    case "gantry-lab": {
      const { createGantryLabScene } = await import("../scenes/gantryLab");
      return (scene, physics) =>
        createGantryLabScene(scene, physics);
    }
    case "prize-lab": {
      const { createPrizeLabScene } = await import("../scenes/prizeLab");
      return (scene, physics) =>
        createPrizeLabScene(scene, physics, selection.seed);
    }
    case "claw-lab": {
      const clawLab = await import("../scenes/clawLab");
      const experiment = clawLab.parseClawLabExperiment(search);

      if (experiment === "pt003") {
        const { createPt003Scene } = await import("../scenes/pt003Scene");
        return (scene, physics) =>
          createPt003Scene(scene, physics);
      }
      if (experiment === "pt004") {
        const { createPt004Scene } = await import("../scenes/pt004Scene");
        return (scene, physics) =>
          createPt004Scene(scene, physics);
      }
      if (experiment === "pt005") {
        const { createPt005Scene } = await import("../scenes/pt005Scene");
        return (scene, physics) =>
          createPt005Scene(scene, physics);
      }
      if (experiment === "oversized") {
        const { createOversizedCloseScene } =
          await import("../scenes/oversizedCloseScene");
        return (scene, physics) =>
          createOversizedCloseScene(scene, physics);
      }

      return (scene, physics) =>
        clawLab.createClawLabScene(scene, physics, search);
    }
    case "falling-cube":
    default: {
      const { createFallingCubeScene } =
        await import("../scenes/fallingCube");
      return (scene, physics) =>
        createFallingCubeScene(scene, physics, selection.seed);
    }
  }
}

export async function startApp(
  root: HTMLElement,
  physicsReady?: Promise<PhysicsRuntime>,
  bootstrapStartedAtMs = performance.now(),
): Promise<void> {
  const selection = parseSceneSelection(window.location.search);
  root.dataset.sceneId = selection.id;
  root.dataset.loading = "true";

  const physicsPromise =
    physicsReady ??
    import("../physics/PhysicsRuntime").then(
      ({ PhysicsRuntime }) => PhysicsRuntime.create(),
    );

  const [physics, sceneFactory] = await Promise.all([
    physicsPromise,
    loadSelectedSceneFactory(selection, window.location.search),
  ]);
  root.dataset.physicsBackend = "native-wasm";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111722);

  const touchLike = isTouchLikeEnvironment();
  const camera = new THREE.PerspectiveCamera(
    touchLike
      ? M07_MOBILE_CAMERA_FOV_DEGREES
      : M07_CAMERA_FOV_DEGREES,
    1,
    0.01,
    100,
  );

  const renderQuality = chooseRenderQualityProfile(
    touchLike,
  );
  root.dataset.renderProfile = renderQuality.id;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      renderQuality.pixelRatioCap,
    ),
  );
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = touchLike
    ? THREE.PCFShadowMap
    : THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x233047, 1.4));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(4, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(
    renderQuality.shadowMapSize,
    renderQuality.shadowMapSize,
  );
  scene.add(keyLight);

  const testScene = sceneFactory(scene, physics);
  if (testScene.layoutId) {
    root.dataset.layoutId = testScene.layoutId;
  }

  type MachineAudioController = InstanceType<
    typeof import("../audio/CabinetMachineAudio").CabinetMachineAudio
  >;
  type CabinetHapticsController = InstanceType<
    typeof import("../haptics/cabinetHaptics").CabinetHaptics
  >;

  const machineAudioEligible =
    selection.id === "cabinet-lab" &&
    Boolean(testScene.getMachineAudioState);
  let machineAudio: MachineAudioController | null = null;
  let machineAudioPromise: Promise<MachineAudioController> | null = null;
  let cabinetHaptics: CabinetHapticsController | null = null;
  let cabinetHapticsPromise: Promise<CabinetHapticsController> | null =
    null;

  if (machineAudioEligible) {
    root.dataset.machineAudio = "armed";
    root.dataset.controllerHaptics = "armed";
  }

  const ensureMachineAudio = (): Promise<MachineAudioController | null> => {
    if (!machineAudioEligible) {
      return Promise.resolve(null);
    }
    if (machineAudio) {
      return Promise.resolve(machineAudio);
    }
    if (!machineAudioPromise) {
      machineAudioPromise = import("../audio/CabinetMachineAudio")
        .then(({ CabinetMachineAudio }) => {
          machineAudio = new CabinetMachineAudio(root);
          return machineAudio;
        });
    }
    return machineAudioPromise;
  };

  void ensureMachineAudio();

  const ensureCabinetHaptics =
    (): Promise<CabinetHapticsController | null> => {
      if (!machineAudioEligible) {
        return Promise.resolve(null);
      }
      if (cabinetHaptics) {
        return Promise.resolve(cabinetHaptics);
      }
      if (!cabinetHapticsPromise) {
        cabinetHapticsPromise = import(
          "../haptics/cabinetHaptics"
        ).then(({ CabinetHaptics }) => {
          cabinetHaptics = new CabinetHaptics(root);
          return cabinetHaptics;
        });
      }
      return cabinetHapticsPromise;
    };

  void ensureCabinetHaptics();

  const unlockMachineAudio = (): void => {
    if (machineAudio) {
      void machineAudio.unlock();
      return;
    }
    void ensureMachineAudio().then((audio) => audio?.unlock());
  };
  window.addEventListener(
    "pointerdown",
    unlockMachineAudio,
    { capture: true, passive: true },
  );

  scene.traverse((object) => {
    if (
      object instanceof THREE.DirectionalLight ||
      object instanceof THREE.PointLight
    ) {
      object.shadow.mapSize.set(
        Math.min(
          object.shadow.mapSize.width,
          renderQuality.shadowMapSize,
        ),
        Math.min(
          object.shadow.mapSize.height,
          renderQuality.shadowMapSize,
        ),
      );
    }
  });

  camera.position.set(...testScene.camera.position);
  camera.lookAt(...testScene.camera.target);

  const playerViewController =
    selection.id === "cabinet-lab"
      ? new FirstPersonPlayerViewController(
          camera,
          renderer.domElement,
          M07_CABINET_VIEW_TARGETS,
          () => testScene.primaryAction?.() ?? false,
          touchLike
            ? M07_MOBILE_FIRST_PERSON_VIEW_CONFIG
            : undefined,
        )
      : null;

  if (selection.id === "cabinet-lab") {
    new MobileCabinetControls(
      root,
      (x, z) => testScene.setManualGantryInput?.(x, z),
      () => testScene.primaryAction?.() ?? false,
      (direction) =>
        playerViewController?.adjustEyeHeight(
          direction *
            M07_MOBILE_FIRST_PERSON_VIEW_CONFIG
              .eyeHeightStepMeters,
        ),
    );
  }

  const debugRequested =
    new URLSearchParams(window.location.search).get("debug") === "1";
  const debugOverlay = new DebugOverlay(
    root,
    selection.id !== "cabinet-lab" || debugRequested,
  );
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
    unlockMachineAudio();

    if (event.repeat) {
      return;
    }

    if (event.code === "F2") {
      event.preventDefault();
      debugOverlay.toggle();
    } else if (
      event.code === "F3" ||
      (event.code === "KeyD" && selection.id !== "cabinet-lab")
    ) {
      event.preventDefault();
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

    const contactAudioImpacts =
      physics.consumeContactAudioImpacts();
    if (contactAudioImpacts.length > 0) {
      machineAudio?.playPrizeImpacts(contactAudioImpacts);
      cabinetHaptics?.playPrizeImpacts(contactAudioImpacts);
    }

    const machineAudioState = testScene.getMachineAudioState?.();
    if (machineAudioState) {
      machineAudio?.update(machineAudioState);
      cabinetHaptics?.updateMachineState(machineAudioState);
    }
    playerViewController?.update(frameDeltaSeconds);
    if (physicsDebugRenderer.visible) {
      physicsDebugRenderer.update(physics.debugRender());
    }
    if (massPropertiesDebugRenderer.visible) {
      massPropertiesDebugRenderer.update();
    }
    renderer.render(scene, camera);

    if (!firstFrameRendered) {
      root.dataset.simulationReady = "true";
      root.dataset.loading = "false";
      root.dataset.startupMs = Math.max(
        0,
        Math.round(performance.now() - bootstrapStartedAtMs),
      ).toString();
      root.querySelector(".loading-shell")?.remove();
      firstFrameRendered = true;
    }

    if (debugOverlay.visible) {
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
      extraLines: [
        ...(testScene.debugLines?.() ?? []),
        ...(playerViewController?.debugLines() ?? []),
        ],
      });
    }

    requestAnimationFrame(frame);
  };

  syncRenderTransforms();
  requestAnimationFrame(frame);
}
