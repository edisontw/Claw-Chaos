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
import { StaffCallControl } from "../player/staffCallControl";
import { CabinetRewardFeedback } from "../player/cabinetRewardFeedback";
import {
  AdaptiveRenderQualityController,
  isTouchLikeEnvironment,
  parseRenderQualityMode,
  type RenderQualityMode,
  type RenderQualityProfile,
} from "../player/mobileRenderProfile";
import { parseSceneSelection, type SceneSelection } from "../scenes/sceneSelection";
import type { SimulationScene } from "../scenes/types";
import {
  getVisualTheme,
  parseVisualThemeId,
  type ImplementedVisualThemeId,
} from "../theme/visualTheme";

type SceneFactory = (
  scene: THREE.Scene,
  physics: PhysicsRuntime,
) => SimulationScene;

async function loadSelectedSceneFactory(
  selection: SceneSelection,
  search: string,
  themeId: ImplementedVisualThemeId,
  renderQuality: RenderQualityProfile,
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
          themeId,
          renderQuality,
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
  const visualThemeId = parseVisualThemeId(
    window.location.search,
  );
  const visualTheme = getVisualTheme(visualThemeId);
  const touchLike = isTouchLikeEnvironment();
  const initialQualityMode = parseRenderQualityMode(
    window.location.search,
  );
  const adaptiveRenderQuality =
    new AdaptiveRenderQualityController(
      initialQualityMode,
      touchLike,
    );
  let renderQuality = adaptiveRenderQuality.profile;
  root.dataset.sceneId = selection.id;
  root.dataset.visualTheme = visualTheme.id;
  root.dataset.renderProfile = renderQuality.id;
  root.dataset.renderMode = adaptiveRenderQuality.mode;
  root.dataset.renderAdaptive =
    adaptiveRenderQuality.mode === "auto"
      ? "armed"
      : "manual";
  root.dataset.renderFps = "60";
  root.dataset.renderDowngrades = "0";
  root.dataset.loading = "true";

  const physicsPromise =
    physicsReady ??
    import("../physics/PhysicsRuntime").then(
      ({ PhysicsRuntime }) => PhysicsRuntime.create(),
    );

  const [physics, sceneFactory] = await Promise.all([
    physicsPromise,
    loadSelectedSceneFactory(
      selection,
      window.location.search,
      visualThemeId,
      renderQuality,
    ),
  ]);
  root.dataset.physicsBackend = "native-wasm";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(
    visualTheme.environment.backgroundColor,
  );

  const camera = new THREE.PerspectiveCamera(
    touchLike
      ? M07_MOBILE_CAMERA_FOV_DEGREES
      : M07_CAMERA_FOV_DEGREES,
    1,
    0.01,
    100,
  );

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
  renderer.shadowMap.enabled =
    renderQuality.shadowsEnabled;
  renderer.shadowMap.type = renderQuality.softShadows
    ? THREE.PCFSoftShadowMap
    : THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure =
    renderQuality.toneMappingExposure;
  root.dataset.toneMapping = "aces-filmic";
  root.append(renderer.domElement);

  const hemisphere = visualTheme.environment.hemisphere;
  scene.add(
    new THREE.HemisphereLight(
      hemisphere.skyColor,
      hemisphere.groundColor,
      hemisphere.intensity,
    ),
  );

  const keyLight = new THREE.DirectionalLight(
    visualTheme.environment.keyLight.color,
    visualTheme.environment.keyLight.intensity,
  );
  keyLight.position.set(4, 8, 5);
  keyLight.castShadow =
    renderQuality.shadowsEnabled;
  keyLight.shadow.mapSize.set(
    renderQuality.shadowMapSize,
    renderQuality.shadowMapSize,
  );
  keyLight.shadow.camera.left = -2.6;
  keyLight.shadow.camera.right = 2.6;
  keyLight.shadow.camera.top = 2.8;
  keyLight.shadow.camera.bottom = -0.5;
  keyLight.shadow.camera.near = 1.0;
  keyLight.shadow.camera.far = 15;
  keyLight.shadow.bias = -0.00018;
  keyLight.shadow.normalBias = 0.018;
  scene.add(keyLight);

  const testScene = sceneFactory(scene, physics);
  if (testScene.layoutId) {
    root.dataset.layoutId = testScene.layoutId;
  }
  if (testScene.environmentId) {
    root.dataset.arcadeEnvironment =
      testScene.environmentId;
  }
  if (testScene.staffCharacterVariant) {
    root.dataset.staffCharacter =
      testScene.staffCharacterVariant;
  }
  const initialStaffVisualStatus =
    testScene.getStaffVisualStatus?.();
  if (initialStaffVisualStatus) {
    root.dataset.staffVisual =
      initialStaffVisualStatus;
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

  let qualityStatus: HTMLSpanElement | null = null;

  const setLightShadowMapSize = (
    light: THREE.DirectionalLight | THREE.PointLight,
    mapSize: number,
  ): void => {
    if (
      light.shadow.mapSize.width === mapSize &&
      light.shadow.mapSize.height === mapSize
    ) {
      return;
    }
    light.shadow.mapSize.set(mapSize, mapSize);
    light.shadow.map?.dispose();
    light.shadow.map = null;
  };

  const applyRenderQuality = (
    profile: RenderQualityProfile,
  ): void => {
    renderQuality = profile;
    root.dataset.renderProfile = profile.id;
    root.dataset.renderMode =
      adaptiveRenderQuality.mode;
    root.dataset.renderAdaptive =
      adaptiveRenderQuality.mode === "auto"
        ? "armed"
        : "manual";
    root.dataset.renderDowngrades =
      adaptiveRenderQuality.downgradeCount.toString();

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        profile.pixelRatioCap,
      ),
    );
    renderer.shadowMap.enabled =
      profile.shadowsEnabled;
    renderer.shadowMap.type = profile.softShadows
      ? THREE.PCFSoftShadowMap
      : THREE.PCFShadowMap;
    renderer.toneMappingExposure =
      profile.toneMappingExposure;

    keyLight.castShadow = profile.shadowsEnabled;
    setLightShadowMapSize(
      keyLight,
      profile.shadowMapSize,
    );
    testScene.setRenderQuality?.(profile);

    if (qualityStatus) {
      qualityStatus.textContent =
        profile.id.toUpperCase();
    }
  };

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

  let staffCallControl: StaffCallControl | null = null;

  if (
    selection.id === "cabinet-lab" &&
    testScene.requestStaff &&
    testScene.getStaffCallState
  ) {
    staffCallControl = new StaffCallControl(
      root,
      () => testScene.requestStaff?.() ?? false,
    );
    staffCallControl.update(
      testScene.getStaffCallState(),
    );
  }

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
      (direction) =>
        playerViewController?.adjustZoom(direction),
    );
  }

  const rewardFeedback =
    selection.id === "cabinet-lab" &&
    testScene.consumeRewardEvents
      ? new CabinetRewardFeedback(root)
      : null;

  const reducedRewardEffects = (): boolean =>
    renderQuality.id === "low" ||
    window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

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
  let renderTelemetryElapsedSeconds = 0;
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
    } else if (
      event.code === "KeyS" &&
      selection.id === "cabinet-lab"
    ) {
      event.preventDefault();
      testScene.requestStaff?.();
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

  const graphicsControl =
    document.createElement("label");
  graphicsControl.className =
    "graphics-quality-control";
  graphicsControl.title =
    "Graphics quality. Auto only downgrades after sustained low FPS.";

  const graphicsLabel =
    document.createElement("span");
  graphicsLabel.textContent = "GRAPHICS";

  const qualitySelect =
    document.createElement("select");
  qualitySelect.className =
    "graphics-quality-select";
  qualitySelect.setAttribute(
    "aria-label",
    "Graphics quality",
  );

  const qualityModes: readonly RenderQualityMode[] = [
    "auto",
    "high",
    "medium",
    "low",
  ];
  for (const mode of qualityModes) {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode.toUpperCase();
    qualitySelect.append(option);
  }
  qualitySelect.value = adaptiveRenderQuality.mode;

  qualityStatus = document.createElement("span");
  qualityStatus.className =
    "graphics-quality-effective";
  qualityStatus.textContent =
    renderQuality.id.toUpperCase();

  graphicsControl.append(
    graphicsLabel,
    qualitySelect,
    qualityStatus,
  );
  root.append(graphicsControl);

  qualitySelect.addEventListener(
    "change",
    () => {
      const mode =
        qualitySelect.value as RenderQualityMode;
      const profile = adaptiveRenderQuality.setMode(
        mode,
        touchLike,
      );
      applyRenderQuality(profile);
      resize();
    },
  );

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

    const adaptiveProfile =
      adaptiveRenderQuality.update(
        smoothedFps,
        frameDeltaSeconds,
      );
    if (adaptiveProfile) {
      applyRenderQuality(adaptiveProfile);
      resize();
    }

    renderTelemetryElapsedSeconds += frameDeltaSeconds;
    if (renderTelemetryElapsedSeconds >= 0.5) {
      root.dataset.renderFps = Math.max(
        0,
        Math.round(smoothedFps),
      ).toString();
      root.dataset.renderDowngrades =
        adaptiveRenderQuality.downgradeCount.toString();
      renderTelemetryElapsedSeconds = 0;
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
    const staffCallState = testScene.getStaffCallState?.();
    if (staffCallState) {
      staffCallControl?.update(staffCallState);
    }
    const staffVisualStatus =
      testScene.getStaffVisualStatus?.();
    if (staffVisualStatus) {
      root.dataset.staffVisual =
        staffVisualStatus;
    }
    const staffAssetPath =
      testScene.getStaffAssetPath?.();
    if (staffAssetPath) {
      root.dataset.staffAsset =
        staffAssetPath;
    }

    const rewardEvents =
      testScene.consumeRewardEvents?.() ?? [];
    for (const rewardEvent of rewardEvents) {
      rewardFeedback?.show(
        rewardEvent,
        reducedRewardEffects(),
      );
      if (machineAudio) {
        void machineAudio.playRewardCue(
          rewardEvent.kind,
        );
      } else {
        void ensureMachineAudio().then((audio) => {
          if (audio) {
            void audio.playRewardCue(
              rewardEvent.kind,
            );
          }
        });
      }
    }

    const staffCameraView =
      testScene.getStaffCameraView?.() ?? null;
    playerViewController?.setTemporaryCameraView(
      staffCameraView
        ? {
            position: {
              x: staffCameraView.position[0],
              y: staffCameraView.position[1],
              z: staffCameraView.position[2],
            },
            target: {
              x: staffCameraView.target[0],
              y: staffCameraView.target[1],
              z: staffCameraView.target[2],
            },
          }
        : null,
    );
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
        "Graphics          " +
          adaptiveRenderQuality.mode +
          " / " +
          renderQuality.id +
          " / " +
          Math.round(smoothedFps) +
          " fps / downgrades " +
          adaptiveRenderQuality.downgradeCount,
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
