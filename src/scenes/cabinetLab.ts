import * as THREE from "three";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
  type CabinetPartDefinition,
} from "../cabinet/cabinetGeometry";
import { CabinetResultInventoryState } from "../cabinet/cabinetResultState";
import {
  M08_CABINET_VISUAL_STYLE,
  createCabinetFrameTrimSpecs,
  createCabinetLedStripSpecs,
  type VisualBoxSpec,
} from "../cabinet/cabinetVisualStyle";
import {
  CABINET_CLAW_PARK_POSITION,
  CABINET_PLAY_TUNING,
} from "../cabinet/cabinetPlayTuning";
import { ChuteSensor } from "../cabinet/chuteSensor";
import type { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  createCabinetLayout,
  type CabinetLayoutId,
} from "../layouts/cabinetLayouts";
import { LayoutSettlePipeline } from "../layouts/layoutSettle";
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
    const glass = M08_CABINET_VISUAL_STYLE.glass;
    return new THREE.MeshPhysicalMaterial({
      color: glass.color,
      transparent: true,
      opacity: glass.opacity,
      roughness: glass.roughness,
      metalness: 0,
      transmission: glass.transmission,
      ior: glass.ior,
      thickness: glass.thicknessMeters,
      clearcoat: glass.clearcoat,
      clearcoatRoughness: glass.clearcoatRoughness,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  if (part.role === "chute_wall" || part.role === "chute_bottom") {
    const chute = M08_CABINET_VISUAL_STYLE.chute;
    return new THREE.MeshStandardMaterial({
      color: chute.color,
      roughness: chute.roughness,
      metalness: chute.metalness,
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

  const frame = M08_CABINET_VISUAL_STYLE.frame;
  return new THREE.MeshPhysicalMaterial({
    color: frame.color,
    roughness: frame.roughness,
    metalness: frame.metalness,
    clearcoat: frame.clearcoat,
    clearcoatRoughness: frame.clearcoatRoughness,
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
        color: M08_CABINET_VISUAL_STYLE.glass.color,
        transparent: true,
        opacity: M08_CABINET_VISUAL_STYLE.glass.edgeOpacity,
      }),
    );
    outline.position.copy(mesh.position);
    scene.add(outline);
  }
}


function addVisualBox(
  scene: THREE.Scene,
  spec: VisualBoxSpec,
  material: THREE.Material,
): void {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      spec.halfExtents.x * 2,
      spec.halfExtents.y * 2,
      spec.halfExtents.z * 2,
    ),
    material,
  );
  mesh.name = spec.id;
  mesh.position.set(spec.center.x, spec.center.y, spec.center.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function addM08CabinetDetails(scene: THREE.Scene): void {
  const frameStyle = M08_CABINET_VISUAL_STYLE.frame;
  const trimMaterial = new THREE.MeshPhysicalMaterial({
    color: frameStyle.color,
    roughness: frameStyle.roughness,
    metalness: frameStyle.metalness,
    clearcoat: frameStyle.clearcoat,
    clearcoatRoughness: frameStyle.clearcoatRoughness,
  });
  for (const spec of createCabinetFrameTrimSpecs()) {
    addVisualBox(scene, spec, trimMaterial);
  }

  const ledStyle = M08_CABINET_VISUAL_STYLE.led;
  const ledMaterial = new THREE.MeshStandardMaterial({
    color: ledStyle.color,
    emissive: ledStyle.emissive,
    emissiveIntensity: ledStyle.emissiveIntensity,
    roughness: 0.24,
    metalness: 0.05,
  });
  for (const spec of createCabinetLedStripSpecs()) {
    addVisualBox(scene, spec, ledMaterial);
  }
}

function addControlPanel(scene: THREE.Scene): void {
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.11, 0.16),
    new THREE.MeshPhysicalMaterial({
      color: M08_CABINET_VISUAL_STYLE.controlPanel.color,
      roughness: M08_CABINET_VISUAL_STYLE.controlPanel.roughness,
      metalness: M08_CABINET_VISUAL_STYLE.controlPanel.metalness,
      clearcoat: M08_CABINET_VISUAL_STYLE.controlPanel.clearcoat,
      clearcoatRoughness: 0.18,
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
    new THREE.MeshPhysicalMaterial({
      color: 0xd94141,
      emissive: 0x6b0b0b,
      emissiveIntensity: 0.7,
      roughness: 0.62,
      metalness: 0.05,
      clearcoat: 0,
      clearcoatRoughness: 1,
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

export interface CabinetLabOptions {
  layoutId?: CabinetLayoutId;
  layoutSeed?: string;
}

export function createCabinetLabScene(
  scene: THREE.Scene,
  physics: PhysicsRuntime,
  options: CabinetLabOptions = {},
): SimulationScene {
  const parts = createCabinetPhysics(physics);
  for (const part of parts) {
    addCabinetVisual(scene, part);
  }

  addControlPanel(scene);
  addM08CabinetDetails(scene);

  const layout = createCabinetLayout(
    options.layoutId ?? "loose",
    options.layoutSeed ?? "m09-default",
  );
  const layoutSettle = new LayoutSettlePipeline();

  const cabinetLight = new THREE.PointLight(0xf4f7ff, 4.2, 2.2, 1.7);
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
      initialPosition: CABINET_CLAW_PARK_POSITION,
      controlsEnabled: () => layoutSettle.ready,
      gripProfile: {
        fingerNodes: CABINET_PLAY_TUNING.fingerNodes,
        fingerFriction: CABINET_PLAY_TUNING.fingerFriction,
        closePickupTorque:
          CABINET_PLAY_TUNING.closePickupTorque,
        retainingTorque:
          CABINET_PLAY_TUNING.retainingTorque,
        holdBoostTorque:
          CABINET_PLAY_TUNING.holdBoostTorque,
        pickupLiftDistanceMeters:
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_PLAY_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters,
      },
      playReturnTarget: CABINET_CLAW_PARK_POSITION,
      milestone: "M09 / Ring layout",
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

  const placements = layout.placements;

  for (const [index, placement] of placements.entries()) {
    const definition = getPrizeDefinition(placement.prizeId);
    const prize = createPrize(
      physics,
      definition,
      {
        position: {
          x: placement.x,
          y:
            M06_CABINET_CONFIG.playDeckY +
            definition.dimensions.y * 0.5 +
            placement.yOffsetMeters,
          z: placement.z,
        },
        rotationXRadians: placement.rotationXRadians,
        rotationYRadians: placement.rotationYRadians,
        variantSeed: placement.variantSeed,
        enableContactAudio: true,
      },
    );

    scene.add(prize.renderObject);
    bindings.push({
      mesh: prize.renderObject,
      body: prize.body,
    });
    massPropertiesDebugTargets.push({
      body: prize.body,
      label: placement.prizeId,
    });
    tracked.push({
      id: `${placement.prizeId}#${index}`,
      body: prize.body,
    });
  }

  return {
    bindings,
    massPropertiesDebugTargets,
    milestone: "M09 / Ring layout",
    layoutId: layout.id,
    camera: gantryScene.camera,
    primaryAction: () =>
      layoutSettle.ready
        ? gantryScene.primaryAction?.() ?? false
        : false,
    getMachineAudioState: gantryScene.getMachineAudioState,
    setManualGantryInput(x: number, z: number): void {
      gantryScene.setManualGantryInput?.(x, z);
    },
    beforePhysicsStep(stepSeconds: number): void {
      if (!layoutSettle.ready) {
        layoutSettle.update(
          stepSeconds,
          tracked.map((prize) => {
            const linear = prize.body.linvel();
            const angular = prize.body.angvel();
            return {
              linearSpeedMetersPerSecond: Math.hypot(
                linear.x,
                linear.y,
                linear.z,
              ),
              angularSpeedRadiansPerSecond: Math.hypot(
                angular.x,
                angular.y,
                angular.z,
              ),
            };
          }),
        );
      }

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
        `Layout            ${layout.id} / seed ${layout.seed}`,
        `Layout settle     ${layoutSettle.status} / ${layoutSettle.elapsedSeconds.toFixed(2)} s`,
        `Layout prizes     ${layout.placements.length}`,
        "Chute target      " +
          M06_CABINET_CONFIG.chuteCenterX.toFixed(3) +
          " / " +
          M06_CABINET_CONFIG.chuteCenterZ.toFixed(3) +
          " m",
        `Sensor wins       ${sensor.winCount}`,
        `Results accepted  ${resultInventory.resultCount}`,
        `Inventory prizes  ${resultInventory.inventoryCount}`,
        `Last result prize ${resultInventory.lastResult?.prizeId ?? "none"}`,
        "Glass             subtle PBR pane + restrained edge reflection",
        "M08 visuals       matte frame / subdued glass / gantry detail",
        "Claw park         starts and returns directly over chute",
        "Machine audio     procedural motors + action transients",
        "Prize audio       material-specific contact-force impacts",
        "Ambience          subtle cabinet hum + distant arcade bed",
        "Haptics           optional gamepad rumble + mobile action pulse",
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
          " / boost " +
          CABINET_PLAY_TUNING.holdBoostTorque.toFixed(3) +
          " / " +
          CABINET_PLAY_TUNING.pickupLiftDistanceMeters.toFixed(3) +
          " m pickup / close " +
          CABINET_PLAY_TUNING.closedAngleRadians.toFixed(2) +
          " rad / pad " +
          Math.round(
            CABINET_PLAY_TUNING.fingerLowerPadRadiusMeters * 1000,
          ) +
          " mm",
        "Depth cues        woven deck + fixed cabinet-light shadows",
        "Chute opening     " +
          Math.round(M06_CABINET_CONFIG.chuteOpeningHalfX * 2000) +
          " x " +
          Math.round(M06_CABINET_CONFIG.chuteOpeningHalfZ * 2000) +
          " mm / no raised trim",
        "Service wires     dual visual control leads",
        layout.id === "loose"
          ? "Loose layout      familiar five-prize starter arrangement"
          : layout.id === "dense"
            ? "Dense layout      seeded compact multi-prize arrangement"
            : layout.id === "showcase"
              ? "Showcase layout   separated material/geometry display rows"
              : layout.id === "bridge"
                ? "Bridge layout     two supports + movable elevated flat-box span"
                : layout.id === "edge"
                  ? "Edge layout       side/back wall targets beyond direct carriage center"
                  : "Ring layout       tilted hollow loops propped for real hook-and-lift play",
      ];
    },
  };
}
