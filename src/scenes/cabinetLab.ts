import * as THREE from "three";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
  type CabinetPartDefinition,
} from "../cabinet/cabinetGeometry";
import { CabinetResultInventoryState } from "../cabinet/cabinetResultState";
import {
  createCabinetRewardEvent,
  type CabinetRewardEvent,
} from "../cabinet/cabinetRewardFeedback";
import { CabinetInventoryServiceState } from "../cabinet/cabinetInventoryService";
import { isPrizeBelowChuteOpening } from "../cabinet/cabinetPlayableStock";
import { addCabinetExteriorVisual } from "../cabinet/cabinetExteriorVisual";
import { addCabinetInteriorVisual } from "../cabinet/cabinetInteriorVisual";
import {
  addArcadeEnvironment,
  applyArcadeEnvironmentDetail,
  arcadeEnvironmentId,
} from "../environment/arcadeEnvironment";
import {
  createCabinetFrameTrimSpecs,
  createCabinetLedStripSpecs,
  type VisualBoxSpec,
} from "../cabinet/cabinetVisualStyle";
import {
  CABINET_CLAW_PARK_POSITION,
  CABINET_GANTRY_TRAVEL_BOUNDS,
  CABINET_PLAY_TUNING,
} from "../cabinet/cabinetPlayTuning";
import { ChuteSensor } from "../cabinet/chuteSensor";
import type { PhysicsRuntime } from "../physics/PhysicsRuntime";
import {
  DESKTOP_RENDER_QUALITY,
  type RenderQualityProfile,
} from "../player/mobileRenderProfile";
import {
  createCabinetLayout,
  type CabinetLayoutId,
} from "../layouts/cabinetLayouts";
import { LayoutSettlePipeline } from "../layouts/layoutSettle";
import { getPrizeDefinition } from "../prizes/catalog";
import { createPrize } from "../prizes/PrizeFactory";
import { CabinetStaffServiceVisual } from "../staff/CabinetStaffServiceVisual";
import {
  M10_RESTOCK_CONFIG,
  createRestockPlan,
  type RestockPlacement,
} from "../staff/restockPlanner";
import {
  getVisualTheme,
  type ImplementedVisualThemeId,
  type VisualTheme,
} from "../theme/visualTheme";
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
  theme: VisualTheme,
): THREE.Material {
  if (part.role === "glass") {
    const glass = theme.machine.glass;
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
    const chute = theme.machine.interior.chute;
    return new THREE.MeshStandardMaterial({
      color: chute.color,
      roughness: chute.roughness,
      metalness: chute.metalness,
    });
  }

  if (part.role === "floor") {
    const floor = theme.machine.interior.floor;
    return new THREE.MeshStandardMaterial({
      color: floor.color,
      roughness: floor.roughness,
      metalness: floor.metalness,
    });
  }

  if (part.role === "play_deck") {
    const deck = theme.machine.interior.playDeck;
    return new THREE.MeshStandardMaterial({
      color: deck.color,
      map: PLAY_DECK_WEAVE_TEXTURE,
      roughness: deck.roughness,
      metalness: deck.metalness,
    });
  }

  const frame = theme.machine.exterior.frame;
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
  theme: VisualTheme,
): void {
  const geometry = new THREE.BoxGeometry(
    part.halfExtents.x * 2,
    part.halfExtents.y * 2,
    part.halfExtents.z * 2,
  );
  const mesh = new THREE.Mesh(
    geometry,
    createPartMaterial(part, theme),
  );
  mesh.name = part.id;
  mesh.position.set(part.center.x, part.center.y, part.center.z);
  mesh.castShadow = part.role !== "glass";
  mesh.receiveShadow = part.role !== "glass";
  scene.add(mesh);

  if (part.role === "glass") {
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: theme.machine.glass.color,
        transparent: true,
        opacity: theme.machine.glass.edgeOpacity,
      }),
    );
    outline.name = part.id + "-outline";
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

function addM08CabinetDetails(
  scene: THREE.Scene,
  theme: VisualTheme,
): void {
  const frameStyle = theme.machine.exterior.metalTrim;
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

  const ledStyle = theme.machine.exterior.ledSecondary;
  const ledMaterial = new THREE.MeshStandardMaterial({
    color: ledStyle.color,
    emissive: ledStyle.emissive,
    emissiveIntensity: ledStyle.emissiveIntensity,
    roughness: ledStyle.roughness,
    metalness: ledStyle.metalness,
  });
  for (const spec of createCabinetLedStripSpecs()) {
    addVisualBox(scene, spec, ledMaterial);
  }
}

export interface CabinetLabOptions {
  layoutId?: CabinetLayoutId;
  layoutSeed?: string;
  themeId?: ImplementedVisualThemeId;
  renderQuality?: RenderQualityProfile;
}

export function createCabinetLabScene(
  scene: THREE.Scene,
  physics: PhysicsRuntime,
  options: CabinetLabOptions = {},
): SimulationScene {
  const visualTheme = getVisualTheme(options.themeId);
  const renderQuality =
    options.renderQuality ?? DESKTOP_RENDER_QUALITY;
  const arcadeEnvironment = addArcadeEnvironment(
    scene,
    visualTheme,
    renderQuality.arcadeBackgroundDetail,
  );
  const parts = createCabinetPhysics(physics);
  for (const part of parts) {
    addCabinetVisual(scene, part, visualTheme);
  }

  addCabinetExteriorVisual(scene, visualTheme);
  addCabinetInteriorVisual(scene, visualTheme);
  addM08CabinetDetails(scene, visualTheme);

  const serviceDoorObjects = [
    scene.getObjectByName("glass-right"),
    scene.getObjectByName("glass-right-outline"),
  ].filter(
    (object): object is THREE.Object3D =>
      object !== undefined,
  );
  const staffServiceVisual =
    new CabinetStaffServiceVisual(
      scene,
      serviceDoorObjects,
      parts.serviceDoorBody,
      {
        x:
          M06_CABINET_CONFIG.interiorHalfX +
          M06_CABINET_CONFIG.wallHalfThickness,
        y: 0,
        z:
          -M06_CABINET_CONFIG.interiorHalfZ -
          M06_CABINET_CONFIG.wallHalfThickness * 2,
      },
      visualTheme.staff,
    );

  const layout = createCabinetLayout(
    options.layoutId ?? "loose",
    options.layoutSeed ?? "m09-default",
  );
  const layoutSettle = new LayoutSettlePipeline();
  const inventoryService =
    new CabinetInventoryServiceState(
      layout.placements.length,
      { restockThresholdCount: 1 },
    );

  const interiorLight = visualTheme.machine.interior.lighting;
  const cabinetLight = new THREE.PointLight(
    interiorLight.color,
    interiorLight.intensity,
    interiorLight.distance,
    interiorLight.decay,
  );
  cabinetLight.position.set(-0.08, 1.08, 0.10);
  cabinetLight.castShadow =
    renderQuality.cabinetLightCastsShadow;
  cabinetLight.shadow.mapSize.set(
    renderQuality.cabinetLightShadowMapSize,
    renderQuality.cabinetLightShadowMapSize,
  );
  cabinetLight.shadow.camera.near = 0.08;
  cabinetLight.shadow.camera.far =
    Math.min(interiorLight.distance, 2.4);
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
      visualTheme,
      clawCastsShadow: false,
      initialPosition: CABINET_CLAW_PARK_POSITION,
      travelBounds: CABINET_GANTRY_TRAVEL_BOUNDS,
      controlsEnabled: () =>
        layoutSettle.ready &&
        !inventoryService.playerInputLocked,
      gripProfile: {
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
        fingerLowerPadLengthMeters:
          CABINET_PLAY_TUNING.fingerLowerPadLengthMeters,
      },
      playReturnTarget: CABINET_CLAW_PARK_POSITION,
      milestone: "M10 / Staff & restocking",
      camera: {
        position: [1.08, 1.00, 1.30],
        target: [0, 0.66, 0.02],
      },
    },
  );

  const sensor = new ChuteSensor();
  const resultInventory = new CabinetResultInventoryState();
  const rewardEvents: CabinetRewardEvent[] = [];
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
  const restockedTracked: Array<{
    id: string;
    body: ReturnType<typeof createPrize>["body"];
  }> = [];
  type RestockStatus =
    | "idle"
    | "inserting"
    | "settling"
    | "complete";
  let restockStatus: RestockStatus = "idle";
  let restockPlan: RestockPlacement[] = [];
  let restockSpawnIndex = 0;
  let serviceCycleIndex = 0;
  let restockInsertionElapsedSeconds = 0;
  let restockSettle: LayoutSettlePipeline | null = null;

  const spawnRestockPrize = (
    placement: RestockPlacement,
    index: number,
  ): void => {
    const definition =
      getPrizeDefinition(placement.prizeId);
    const prize = createPrize(
      physics,
      definition,
      {
        position: {
          x: placement.x,
          y: placement.y,
          z: placement.z,
        },
        rotationXRadians:
          placement.rotationXRadians,
        rotationYRadians:
          placement.rotationYRadians,
        variantSeed: placement.variantSeed,
        enableContactAudio: true,
      },
    );
    const id =
      "restock#" +
      serviceCycleIndex +
      "#" +
      index +
      ":" +
      placement.prizeId;

    scene.add(prize.renderObject);
    bindings.push({
      mesh: prize.renderObject,
      body: prize.body,
    });
    massPropertiesDebugTargets.push({
      body: prize.body,
      label: id,
    });
    const trackedPrize = {
      id,
      body: prize.body,
    };
    tracked.push(trackedPrize);
    restockedTracked.push(trackedPrize);
  };

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
    milestone: "M10 / Staff & restocking",
    layoutId: layout.id,
    environmentId: arcadeEnvironmentId(visualTheme),
    staffCharacterVariant:
      staffServiceVisual.characterVariant,
    camera: gantryScene.camera,
    primaryAction: () =>
      layoutSettle.ready
        ? gantryScene.primaryAction?.() ?? false
        : false,
    requestStaff(): boolean {
      return inventoryService.requestStaff();
    },
    getStaffCallState() {
      if (inventoryService.serviceState === "service_paused") {
        if (staffServiceVisual.phase === "approaching") {
          return {
            mode: "paused",
            label: "STAFF APPROACHING",
            detail: "Staff member is walking to the machine.",
          };
        }
        if (staffServiceVisual.phase === "opening_door") {
          return {
            mode: "paused",
            label: "OPENING MACHINE",
            detail: "Staff member is opening the service door.",
          };
        }
        if (staffServiceVisual.phase === "closing_door") {
          return {
            mode: "paused",
            label: "CLOSING MACHINE",
            detail: "Staff member is securing the service door.",
          };
        }
        if (staffServiceVisual.phase === "departing") {
          return {
            mode: "paused",
            label: "STAFF DEPARTING",
            detail: "Machine remains locked until staff clears the cabinet.",
          };
        }
        if (staffServiceVisual.phase === "door_open") {
          if (restockStatus === "inserting") {
            return {
              mode: "paused",
              label: "RESTOCKING",
              detail:
                restockSpawnIndex +
                " / " +
                restockPlan.length +
                " new prizes inserted.",
            };
          }
          if (restockStatus === "settling") {
            return {
              mode: "paused",
              label: "SETTLING PRIZES",
              detail:
                "Waiting for the new pile to become physically stable.",
            };
          }
          if (restockStatus === "complete") {
            return {
              mode: "paused",
              label: "RESTOCK COMPLETE",
              detail:
                "New stock is stable. Door close/departure is next.",
            };
          }
          return {
            mode: "paused",
            label: "SERVICE DOOR OPEN",
            detail: "Preparing seeded restock.",
          };
        }
        return {
          mode: "paused",
          label: "SERVICE PAUSED",
          detail: "Machine secured for staff service.",
        };
      }
      if (inventoryService.serviceState === "staff_requested") {
        return {
          mode: "waiting",
          label: "STAFF CALLED",
          detail: "Finishing current machine motion safely.",
        };
      }
      return {
        mode: "available",
        label: "CALL STAFF",
        detail:
          "Available anytime · " +
          inventoryService.remainingInventoryCount +
          " playable prize" +
          (inventoryService.remainingInventoryCount === 1
            ? ""
            : "s") +
          " remaining.",
      };
    },
    getMachineAudioState: gantryScene.getMachineAudioState,
    consumeRewardEvents(): CabinetRewardEvent[] {
      return rewardEvents.splice(0, rewardEvents.length);
    },
    getStaffVisualStatus(): string {
      return staffServiceVisual.visualStatus;
    },
    getStaffAssetPath(): string {
      return staffServiceVisual.selectedAssetPath;
    },
    getStaffCameraView() {
      const target = staffServiceVisual.viewTarget;
      if (!target) {
        return null;
      }
      const proximity =
        staffServiceVisual.serviceProximity;
      return {
        position: [-0.18, 1.18, 1.72],
        target: [target.x, target.y, target.z],
        fovDegrees:
          56 - proximity * 5,
      };
    },
    setManualGantryInput(x: number, z: number): void {
      gantryScene.setManualGantryInput?.(x, z);
    },
    setRenderQuality(profile): void {
      applyArcadeEnvironmentDetail(
        arcadeEnvironment,
        profile.arcadeBackgroundDetail,
      );
      cabinetLight.castShadow =
        profile.shadowsEnabled &&
        profile.cabinetLightCastsShadow;
      if (
        cabinetLight.shadow.mapSize.width !==
          profile.cabinetLightShadowMapSize ||
        cabinetLight.shadow.mapSize.height !==
          profile.cabinetLightShadowMapSize
      ) {
        cabinetLight.shadow.mapSize.set(
          profile.cabinetLightShadowMapSize,
          profile.cabinetLightShadowMapSize,
        );
        cabinetLight.shadow.map?.dispose();
        cabinetLight.shadow.map = null;
      }
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

      if (inventoryService.serviceState === "staff_requested") {
        inventoryService.advanceServiceHandoff(
          gantryScene.isSafeForService?.() ?? false,
        );
      }

      staffServiceVisual.update(
        inventoryService.machinePaused,
        restockStatus === "settling" ||
          restockStatus === "complete",
        stepSeconds,
      );

      if (
        staffServiceVisual.phase === "door_open" &&
        restockStatus === "idle"
      ) {
        const prizePool = Array.from(
          new Set(
            layout.placements.map(
              (placement) => placement.prizeId,
            ),
          ),
        );
        restockedTracked.length = 0;
        restockPlan = createRestockPlan(
          layout.seed +
            ":service-" +
            serviceCycleIndex,
          inventoryService.restockDeficitCount,
          prizePool,
        );
        restockStatus =
          restockPlan.length > 0
            ? "inserting"
            : "complete";
      }

      if (restockStatus === "inserting") {
        restockInsertionElapsedSeconds +=
          stepSeconds;
        const readyForNext =
          restockSpawnIndex === 0 ||
          restockInsertionElapsedSeconds >=
            M10_RESTOCK_CONFIG
              .insertionIntervalSeconds;

        if (
          readyForNext &&
          restockSpawnIndex < restockPlan.length
        ) {
          const placement =
            restockPlan[restockSpawnIndex];
          if (placement) {
            spawnRestockPrize(
              placement,
              restockSpawnIndex,
            );
          }
          restockSpawnIndex += 1;
          restockInsertionElapsedSeconds = 0;

          if (
            restockSpawnIndex >=
            restockPlan.length
          ) {
            restockStatus = "settling";
            restockSettle =
              new LayoutSettlePipeline();
          }
        }
      }

      if (
        restockStatus === "settling" &&
        restockSettle
      ) {
        restockSettle.update(
          stepSeconds,
          restockedTracked.map((prize) => {
            const linear = prize.body.linvel();
            const angular = prize.body.angvel();
            return {
              linearSpeedMetersPerSecond:
                Math.hypot(
                  linear.x,
                  linear.y,
                  linear.z,
                ),
              angularSpeedRadiansPerSecond:
                Math.hypot(
                  angular.x,
                  angular.y,
                  angular.z,
                ),
            };
          }),
        );

        if (restockSettle.ready) {
          inventoryService.recordRestock(
            restockPlan.length,
          );
          restockStatus = "complete";
        }
      }

      if (
        restockStatus === "complete" &&
        staffServiceVisual.phase === "hidden" &&
        inventoryService.serviceState ===
          "service_paused"
      ) {
        const reopened =
          inventoryService.completeService();
        if (reopened) {
          serviceCycleIndex += 1;
          restockStatus = "idle";
          restockPlan = [];
          restockSpawnIndex = 0;
          restockInsertionElapsedSeconds = 0;
          restockSettle = null;
          restockedTracked.length = 0;
        }
      }

      for (const prize of tracked) {
        // Initial prize settling is setup, not gameplay. Do not let a
        // transient spawn/settle motion decrement stock or produce a WIN.
        if (!layoutSettle.ready) {
          continue;
        }

        if (
          isPrizeBelowChuteOpening(
            prize.body.worldCom(),
          )
        ) {
          inventoryService.markPrizeUnavailable(
            prize.id,
          );
        }

        if (inventoryService.machinePaused) {
          continue;
        }

        const event = sensor.pollPrize(
          prize.id,
          prize.body,
        );
        if (event) {
          const result =
            resultInventory.consume(event);
          if (result) {
            const accepted =
              inventoryService.consumeWin(
                result,
              );
            if (accepted) {
              const totalStockCount =
                inventoryService.initialInventoryCount +
                inventoryService.restockedInventoryCount;
              rewardEvents.push(
                createCabinetRewardEvent(
                  result,
                  {
                    remainingInventoryCount:
                      inventoryService.remainingInventoryCount,
                    awardedInventoryCount:
                      inventoryService.awardedInventoryCount,
                    totalStockCount,
                  },
                ),
              );
            }
          }
        }
      }
    },
    debugLines(): string[] {
      return [
        ...(gantryScene.debugLines?.() ?? []),
        "Cabinet           physical deck / walls / glass / ceiling",
        `Visual theme      ${visualTheme.id} / ${visualTheme.label}`,
        `Render profile    ${renderQuality.id} / background ${renderQuality.arcadeBackgroundDetail} / cabinet shadow ${renderQuality.cabinetLightCastsShadow ? "on" : "off"}`,
        `Staff character   ${staffServiceVisual.characterVariant}`,
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
        `Awarded prizes    ${resultInventory.inventoryCount}`,
        `Playable stock    ${inventoryService.remainingInventoryCount} / ${inventoryService.initialInventoryCount}`,
        `Out of play       ${inventoryService.unavailableInventoryCount} / awarded ${inventoryService.awardedInventoryCount}`,
        `Staff call        ${inventoryService.canCallStaff ? "available" : "busy"} / ${inventoryService.serviceState}`,
        `Service safe      ${gantryScene.isSafeForService?.() ? "yes" : "no"} / input ${inventoryService.playerInputLocked ? "LOCKED" : "open"}`,
        `Staff sequence    ${staffServiceVisual.phase}`,
        `Restock status    ${restockStatus} / ${restockSpawnIndex} of ${restockPlan.length}`,
        `Restock settle    ${restockSettle?.status ?? "-"}`,
        `Restocked total   ${inventoryService.restockedInventoryCount}`,
        `Service cycles    ${inventoryService.completedServiceCount} / seed index ${serviceCycleIndex}`,
        `Last result prize ${resultInventory.lastResult?.prizeId ?? "none"}`,
        "Glass             subtle PBR pane + restrained edge reflection",
        "Art visuals       themed shell / interior / gantry / arcade room",
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
          " mm x " +
          Math.round(
            CABINET_PLAY_TUNING.fingerLowerPadLengthMeters * 1000,
          ) +
          " mm terminal pad",
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
                  : layout.id === "ring"
                    ? "Ring layout       tilted hollow loops propped for real hook-and-lift play"
                    : "Chute layout      lip-adjacent targets for push/roll/flip scoring",
      ];
    },
  };
}
