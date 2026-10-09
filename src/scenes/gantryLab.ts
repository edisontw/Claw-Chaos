import * as THREE from "three";
import type {
  PhysicsRuntime,
  RevoluteJointHandle,
  RigidBodyHandle,
} from "../physics/PhysicsRuntime";
import { M08_GANTRY_VISUAL_STYLE } from "../cabinet/cabinetVisualStyle";
import {
  DEFAULT_VISUAL_THEME,
  type SurfaceMaterialToken,
  type VisualTheme,
} from "../theme/visualTheme";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  createFingerPoints,
  createFingerSegments,
  createFingerVisual,
} from "./clawLab";
import {
  advanceGantryMotion,
  advanceGantryMotionTowardPosition,
  isGantryAxisAtTarget,
  type GantryMotionConfig,
  type GantryMotionState,
} from "./gantryMotion";
import { advanceReel, haltReel, type ReelConfig, type ReelState } from "./reelMotion";
import {
  M04_PLAY_CONFIG,
  advanceM04PlayState,
  applyM04Action,
  applyM04AutomaticLanding,
  createM04PlayState,
  m04FingerShouldClose,
  m04ForcePhase,
  m04HoldBoostActive,
  m04ReelCommand,
} from "./m04PlayCycle";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";
import type { SimulationScene } from "./types";

export const M02_FINGER_TRANSPORT_CONFIG = {
  stiffness: 6000,
  damping: 340,
  maxTorque: 50.0,
  angularDamping: 8.0,
  maxRelativeDeflectionRadians: 0.035,
} as const;

export const M02_GANTRY_CONFIG = {
  carriageY: 1.18,
  carriageHalfX: 0.075,
  carriageHalfY: 0.025,
  carriageHalfZ: 0.075,
  xMin: -0.30,
  xMax: 0.30,
  zMin: -0.24,
  zMax: 0.24,
  maxSpeed: 0.45,
  acceleration: 1.35,
  braking: 3.5,
  suspensionLength: 0.31,
  suspensionAngularDamping: 3.0,
  suspensionLinearDamping: 0.12,
  suspensionSpringStiffness: 170,
  suspensionSpringDamping: 1.0,
  suspensionSpringMaxForce: 4.0,
  hubMassKg: 0.32,
  reelMinPayout: 0,
  reelMaxPayout: 0.28,
  reelMaxSpeed: 0.28,
  reelAcceleration: 0.9,
  reelBraking: 1.4,
  homeX: 0,
  homeZ: 0,
  homePositionTolerance: 0.003,
  homeVelocityTolerance: 0.02,
  pt006AccelerationSeconds: 0.80,
  pt006BrakeObservationSeconds: 1.60,
  pt006MinLagMeters: 0.003,
  pt006MaxLagMeters: 0.025,
  pt006MinForwardSwingMeters: 0.004,
  pt006MaxForwardSwingMeters: 0.035,
  pt006MinSwingAngleRadians: 0.015,
  pt006MaxSwingAngleRadians: 0.12,
  pt006MaxResidualOffsetMeters: 0.008,
  pt008AccelerationSeconds: 0.65,
  pt008BrakeLeadSeconds: 0.14,
  pt008MinDescentMeters: 0.20,
  pt008MinHorizontalOffsetMeters: 0.0015,
  pt008MinVelocityRetentionRatio: 0.35,
} as const;

export type Pt006Phase =
  | "READY"
  | "ACCELERATING"
  | "BRAKING"
  | "COMPLETE";

export type Pt008Phase =
  | "READY"
  | "ACCELERATING"
  | "BRAKING"
  | "DROPPING"
  | "COMPLETE";

export type HomeReturnPhase =
  | "READY"
  | "LIFTING"
  | "RETURNING_HOME"
  | "COMPLETE";

export interface Pt006Metrics {
  lagMeters: number;
  forwardSwingMeters: number;
  peakSwingAngleRadians: number;
  residualOffsetMeters: number;
}

export interface Pt008Metrics {
  descentMeters: number;
  maxHorizontalOffsetMeters: number;
  velocityRetentionRatio: number;
}

export function evaluatePt006Swing(metrics: Pt006Metrics): boolean {
  return (
    metrics.lagMeters >= M02_GANTRY_CONFIG.pt006MinLagMeters &&
    metrics.lagMeters <= M02_GANTRY_CONFIG.pt006MaxLagMeters &&
    metrics.forwardSwingMeters >= M02_GANTRY_CONFIG.pt006MinForwardSwingMeters &&
    metrics.forwardSwingMeters <=
      M02_GANTRY_CONFIG.pt006MaxForwardSwingMeters &&
    metrics.peakSwingAngleRadians >=
      M02_GANTRY_CONFIG.pt006MinSwingAngleRadians &&
    metrics.peakSwingAngleRadians <=
      M02_GANTRY_CONFIG.pt006MaxSwingAngleRadians &&
    metrics.residualOffsetMeters <=
      M02_GANTRY_CONFIG.pt006MaxResidualOffsetMeters
  );
}

export function evaluatePt008Momentum(metrics: Pt008Metrics): boolean {
  return (
    metrics.descentMeters >= M02_GANTRY_CONFIG.pt008MinDescentMeters &&
    metrics.maxHorizontalOffsetMeters >=
      M02_GANTRY_CONFIG.pt008MinHorizontalOffsetMeters &&
    metrics.velocityRetentionRatio >=
      M02_GANTRY_CONFIG.pt008MinVelocityRetentionRatio
  );
}

function themedStandardMaterial(
  token: SurfaceMaterialToken,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: token.color,
    roughness: token.roughness,
    metalness: token.metalness,
  });
}

function addCylinder(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  centerY: number,
  material: THREE.Material,
): void {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 32),
    material,
  );
  mesh.position.y = centerY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function computeSwingAngle(
  anchorY: number,
  carriageX: number,
  carriageZ: number,
  hub: { x: number; y: number; z: number },
): number {
  const horizontal = Math.hypot(hub.x - carriageX, hub.z - carriageZ);
  const vertical = Math.max(1e-6, anchorY - hub.y);
  return Math.atan2(horizontal, vertical);
}

export interface GantryGripProfile {
  fingerFriction?: number;
  fingerRodFriction?: number;
  fingerDensity?: number;
  fingerAngularDamping?: number;
  descentOpenStiffness?: number;
  descentOpenDamping?: number;
  descentOpenMaxTorque?: number;
  descentPrizeContactStiffness?: number;
  descentPrizeContactDamping?: number;
  descentPrizeContactMaxTorque?: number;
  bottomCloseSettleSeconds?: number;
  closeRampSeconds?: number;
  closeRampStartTorque?: number;
  closeMotorDamping?: number;
  closePickupTorque?: number;
  retainingTorque?: number;
  holdBoostTorque?: number;
  pickupLiftDistanceMeters?: number;
  closedAngleRadians?: number;
  fingerLowerPadRadiusMeters?: number;
  fingerLowerPadLengthMeters?: number;
}

export type GantryClawTopologyId =
  | "three-prong"
  | "ufo-two-prong";

export const GANTRY_CLAW_TOPOLOGIES = {
  "three-prong": {
    fingerCount: 3,
    azimuthOffsetRadians: 0,
  },
  "ufo-two-prong": {
    fingerCount: 2,
    azimuthOffsetRadians: 0,
  },
} as const satisfies Record<
  GantryClawTopologyId,
  {
    fingerCount: 2 | 3;
    azimuthOffsetRadians: number;
  }
>;

export function parseGantryClawTopology(
  search: string,
): GantryClawTopologyId {
  const requested = new URLSearchParams(search).get("machine");

  if (
    requested === "ufo" ||
    requested === "two-prong" ||
    requested === "ufo-two-prong"
  ) {
    return "ufo-two-prong";
  }

  return "three-prong";
}

export function createGantryFingerAzimuths(
  topologyId: GantryClawTopologyId,
): number[] {
  const topology = GANTRY_CLAW_TOPOLOGIES[topologyId];

  return Array.from(
    { length: topology.fingerCount },
    (_, index) =>
      topology.azimuthOffsetRadians +
      index * (Math.PI * 2 / topology.fingerCount),
  );
}

export function createFingerIndexPairs(
  fingerCount: number,
): Array<readonly [number, number]> {
  const pairs: Array<readonly [number, number]> = [];

  for (let first = 0; first < fingerCount; first += 1) {
    for (
      let second = first + 1;
      second < fingerCount;
      second += 1
    ) {
      pairs.push([first, second]);
    }
  }

  return pairs;
}

export interface GantryLabOptions {
  addLabFloor?: boolean;
  initialPosition?: { x: number; z: number };
  playReturnTarget?: { x: number; z: number };
  travelBounds?: {
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
  };
  verticalHomeOffset?: number;
  additionalPickupDropMeters?: number;
  reelMaxSpeedMetersPerSecond?: number;
  reelApproachMaxSpeedMetersPerSecond?: number;
  reelApproachDistanceMeters?: number;
  addServiceWires?: boolean;
  visualTheme?: VisualTheme;
  clawCastsShadow?: boolean;
  clawContinuousCollision?: boolean;
  gripProfile?: GantryGripProfile;
  clawTopology?: GantryClawTopologyId;
  controlsEnabled?: () => boolean;
  // Optional physical floor surfaces. Prize contact alone is NOT bottom:
  // a real claw may brush prizes before reaching the play deck. The reel
  // stops and automatic closing begins only when a finger touches the deck
  // (or the mechanical payout limit), never because a prize is nearby.
  descentFloorBodies?: () => readonly RigidBodyHandle[];
  // Prize contact does not instant-close the claw. If an object obstructs
  // the descent before floor contact, the real reel runs a short additional
  // distance to allow the yielding fingers to settle into the pile.
  descentContactBodies?: () => readonly RigidBodyHandle[];
  descentPrizeFollowThroughMeters?: number;
  milestone?: string;
  camera?: {
    position: [number, number, number];
    target: [number, number, number];
  };
}

export function updateFingerSelfContactGuard(
  currentActive: boolean,
  closing: boolean,
  siblingFingerContact: boolean,
): boolean {
  if (!closing) {
    return false;
  }

  return currentActive || siblingFingerContact;
}

export function advanceFingerCommandWithSelfContactGuard(
  current: number,
  target: number,
  speedRadiansPerSecond: number,
  stepSeconds: number,
  closing: boolean,
  siblingFingerContact: boolean,
): number {
  if (
    closing &&
    siblingFingerContact &&
    target < current
  ) {
    return current;
  }

  return advanceMotorCommand(
    current,
    target,
    speedRadiansPerSecond,
    stepSeconds,
  );
}

export function resolveGantryInitialPosition(
  requested?: { x: number; z: number },
): { x: number; z: number } {
  return {
    x: Math.max(
      M02_GANTRY_CONFIG.xMin,
      Math.min(M02_GANTRY_CONFIG.xMax, requested?.x ?? 0),
    ),
    z: Math.max(
      M02_GANTRY_CONFIG.zMin,
      Math.min(M02_GANTRY_CONFIG.zMax, requested?.z ?? 0),
    ),
  };
}

export function createGantryLabScene(
  scene: THREE.Scene,
  physics: PhysicsRuntime,
  options: GantryLabOptions = {},
): SimulationScene {
  const claw = CLAW_LAB_CONFIG;
  const visualTheme =
    options.visualTheme ?? DEFAULT_VISUAL_THEME;
  const machineInterior = visualTheme.machine.interior;
  const clawCastsShadow = options.clawCastsShadow ?? true;
  const verticalHomeOffset = options.verticalHomeOffset ?? 0;
  const additionalPickupDropMeters = options.additionalPickupDropMeters ?? 0;
  const activeFingerFriction =
    options.gripProfile?.fingerFriction ?? claw.fingerFriction;
  const activeFingerRodFriction =
    options.gripProfile?.fingerRodFriction ?? activeFingerFriction;
  const activeFingerDensity =
    options.gripProfile?.fingerDensity ?? claw.fingerDensity;
  const activeFingerAngularDamping =
    options.gripProfile?.fingerAngularDamping ??
    M02_FINGER_TRANSPORT_CONFIG.angularDamping;
  const descentOpenStiffness =
    options.gripProfile?.descentOpenStiffness ??
    M02_FINGER_TRANSPORT_CONFIG.stiffness;
  const descentOpenDamping =
    options.gripProfile?.descentOpenDamping ??
    M02_FINGER_TRANSPORT_CONFIG.damping;
  const descentOpenMaxTorque =
    options.gripProfile?.descentOpenMaxTorque ??
    M02_FINGER_TRANSPORT_CONFIG.maxTorque;
  const descentPrizeContactStiffness =
    options.gripProfile?.descentPrizeContactStiffness ??
    M02_FINGER_TRANSPORT_CONFIG.stiffness;
  const descentPrizeContactDamping =
    options.gripProfile?.descentPrizeContactDamping ??
    M02_FINGER_TRANSPORT_CONFIG.damping;
  const descentPrizeContactMaxTorque =
    options.gripProfile?.descentPrizeContactMaxTorque ??
    M02_FINGER_TRANSPORT_CONFIG.maxTorque;
  const bottomCloseSettleSeconds =
    options.gripProfile?.bottomCloseSettleSeconds ?? 0;
  const closeRampSeconds =
    options.gripProfile?.closeRampSeconds ?? 0;
  const closeRampStartTorque =
    options.gripProfile?.closeRampStartTorque ??
    options.gripProfile?.closePickupTorque ??
    claw.maxMotorTorque;
  const closeMotorDamping =
    options.gripProfile?.closeMotorDamping ?? claw.motorDamping;
  const closePickupTorque =
    options.gripProfile?.closePickupTorque ?? claw.maxMotorTorque;
  const retainingTorque =
    options.gripProfile?.retainingTorque ?? claw.pt002RetainingTorque;
  const holdBoostTorque =
    options.gripProfile?.holdBoostTorque ??
    M04_PLAY_CONFIG.holdBoostTorque;
  const pickupLiftDistanceMeters =
    options.gripProfile?.pickupLiftDistanceMeters ??
    M04_PLAY_CONFIG.pickupLiftDistanceMeters;
  const closedAngleRadians =
    options.gripProfile?.closedAngleRadians ?? claw.closedAngle;
  const fingerLowerPadRadiusMeters =
    options.gripProfile?.fingerLowerPadRadiusMeters ??
    claw.fingerRodRadius;
  const fingerLowerPadLengthMeters =
    options.gripProfile?.fingerLowerPadLengthMeters;
  const clawTopologyId =
    options.clawTopology ?? "three-prong";
  const fingerAzimuths =
    createGantryFingerAzimuths(clawTopologyId);
  const fingerIndexPairs =
    createFingerIndexPairs(fingerAzimuths.length);
  const boundedGantry = {
    ...M02_GANTRY_CONFIG,
    ...(options.travelBounds ?? {}),
    ...(options.reelMaxSpeedMetersPerSecond === undefined
      ? {}
      : { reelMaxSpeed: options.reelMaxSpeedMetersPerSecond }),
  };
  const gantry =
    verticalHomeOffset === 0 && additionalPickupDropMeters === 0
      ? boundedGantry
      : {
          ...boundedGantry,
          carriageY:
            boundedGantry.carriageY + verticalHomeOffset,
          reelMaxPayout:
            boundedGantry.reelMaxPayout +
            verticalHomeOffset + additionalPickupDropMeters,
        };
  const requestedInitial =
    options.initialPosition ?? { x: 0, z: 0 };
  const initialPosition = {
    x: Math.max(
      gantry.xMin,
      Math.min(gantry.xMax, requestedInitial.x),
    ),
    z: Math.max(
      gantry.zMin,
      Math.min(gantry.zMax, requestedInitial.z),
    ),
  };
  const bindings: SimulationScene["bindings"] = [];
  const fingerBodies: RigidBodyHandle[] = [];
  const fingerJoints: RevoluteJointHandle[] = [];

  if (options.addLabFloor !== false) {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.04, 1.2),
      themedStandardMaterial(
        visualTheme.environment.floor,
      ),
    );
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);
    physics.createStaticCuboid(
      { x: 0, y: -0.02, z: 0 },
      { x: 0.7, y: 0.02, z: 0.6 },
    );
  }

  const railMaterial = themedStandardMaterial(
    machineInterior.gantryRail,
  );
  for (const z of [gantry.zMin - 0.04, gantry.zMax + 0.04]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        gantry.xMax - gantry.xMin + 0.18,
        0.025,
        0.028,
      ),
      railMaterial,
    );
    rail.position.set(0, gantry.carriageY, z);
    rail.castShadow = true;
    scene.add(rail);
  }

  const bridgeHalfSpanZ =
    (gantry.zMax - gantry.zMin) * 0.5 +
    M08_GANTRY_VISUAL_STYLE.bridgeExtraHalfSpanZ;
  const bridgeVisual = new THREE.Group();
  bridgeVisual.name = "m08-moving-gantry-bridge";
  bridgeVisual.position.set(
    initialPosition.x,
    gantry.carriageY + 0.034,
    0,
  );

  const bridgeMaterial = themedStandardMaterial(
    machineInterior.gantryBridge,
  );
  const bridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      M08_GANTRY_VISUAL_STYLE.bridgeBeamHalfX * 2,
      M08_GANTRY_VISUAL_STYLE.bridgeBeamHalfY * 2,
      bridgeHalfSpanZ * 2,
    ),
    bridgeMaterial,
  );
  bridgeBeam.castShadow = true;
  bridgeVisual.add(bridgeBeam);

  for (const z of [-bridgeHalfSpanZ, bridgeHalfSpanZ]) {
    const endBlock = new THREE.Mesh(
      new THREE.BoxGeometry(
        M08_GANTRY_VISUAL_STYLE.bridgeEndBlockHalfX * 2,
        M08_GANTRY_VISUAL_STYLE.bridgeEndBlockHalfY * 2,
        M08_GANTRY_VISUAL_STYLE.bridgeEndBlockHalfZ * 2,
      ),
      bridgeMaterial,
    );
    endBlock.position.z = z;
    endBlock.castShadow = true;
    bridgeVisual.add(endBlock);
  }
  scene.add(bridgeVisual);

  const carriageVisual = new THREE.Mesh(
    new THREE.BoxGeometry(
      gantry.carriageHalfX * 2,
      gantry.carriageHalfY * 2,
      gantry.carriageHalfZ * 2,
    ),
    themedStandardMaterial(
      machineInterior.gantryCarriage,
    ),
  );
  carriageVisual.castShadow = true;

  const winchMetal = themedStandardMaterial(
    machineInterior.winchMetal,
  );
  const winchDark = themedStandardMaterial(
    machineInterior.winchDark,
  );
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(
      M08_GANTRY_VISUAL_STYLE.winchDrumRadius,
      M08_GANTRY_VISUAL_STYLE.winchDrumRadius,
      M08_GANTRY_VISUAL_STYLE.winchDrumLength,
      24,
    ),
    winchDark,
  );
  drum.name = "m08-winch-drum";
  drum.rotation.z = Math.PI * 0.5;
  drum.position.y = 0.043;
  carriageVisual.add(drum);

  for (const x of [
    -M08_GANTRY_VISUAL_STYLE.winchDrumLength * 0.5,
    M08_GANTRY_VISUAL_STYLE.winchDrumLength * 0.5,
  ]) {
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(
        M08_GANTRY_VISUAL_STYLE.winchFlangeRadius,
        M08_GANTRY_VISUAL_STYLE.winchFlangeRadius,
        M08_GANTRY_VISUAL_STYLE.winchFlangeThickness,
        24,
      ),
      winchMetal,
    );
    flange.rotation.z = Math.PI * 0.5;
    flange.position.set(x, 0.043, 0);
    flange.castShadow = true;
    carriageVisual.add(flange);
  }

  const pulley = new THREE.Mesh(
    new THREE.CylinderGeometry(
      M08_GANTRY_VISUAL_STYLE.pulleyRadius,
      M08_GANTRY_VISUAL_STYLE.pulleyRadius,
      M08_GANTRY_VISUAL_STYLE.pulleyThickness,
      20,
    ),
    winchMetal,
  );
  pulley.name = "m08-cable-pulley";
  pulley.rotation.z = Math.PI * 0.5;
  pulley.position.y = -0.035;
  pulley.castShadow = true;
  carriageVisual.add(pulley);

  const primaryAccent =
    visualTheme.machine.exterior.ledPrimary;
  const secondaryAccent =
    visualTheme.machine.exterior.ledSecondary;
  const primaryAccentMaterial =
    new THREE.MeshStandardMaterial({
      color: primaryAccent.color,
      emissive: primaryAccent.emissive,
      emissiveIntensity:
        primaryAccent.emissiveIntensity * 0.72,
      roughness: primaryAccent.roughness,
      metalness: primaryAccent.metalness,
    });
  const secondaryAccentMaterial =
    new THREE.MeshStandardMaterial({
      color: secondaryAccent.color,
      emissive: secondaryAccent.emissive,
      emissiveIntensity:
        secondaryAccent.emissiveIntensity * 0.72,
      roughness: secondaryAccent.roughness,
      metalness: secondaryAccent.metalness,
    });

  for (const [z, material] of [
    [-gantry.carriageHalfZ - 0.002, primaryAccentMaterial],
    [gantry.carriageHalfZ + 0.002, secondaryAccentMaterial],
  ] as const) {
    const statusStrip = new THREE.Mesh(
      new THREE.BoxGeometry(
        gantry.carriageHalfX * 1.45,
        0.006,
        0.006,
      ),
      material,
    );
    statusStrip.position.set(
      0,
      gantry.carriageHalfY + 0.006,
      z,
    );
    statusStrip.castShadow = false;
    carriageVisual.add(statusStrip);
  }

  scene.add(carriageVisual);

  const carriageBody = physics.createKinematicCuboid(
    {
      x: initialPosition.x,
      y: gantry.carriageY,
      z: initialPosition.z,
    },
    {
      x: gantry.carriageHalfX,
      y: gantry.carriageHalfY,
      z: gantry.carriageHalfZ,
    },
    0.45,
  );
  bindings.push({ mesh: carriageVisual, body: carriageBody });

  const chrome = themedStandardMaterial(
    machineInterior.clawChrome,
  );
  const brushedMetal = themedStandardMaterial(
    machineInterior.clawBrushed,
  );
  const darkBand = themedStandardMaterial(
    machineInterior.clawBand,
  );
  const tipMaterial = themedStandardMaterial(
    machineInterior.clawTip,
  );

  const hubVisual = new THREE.Group();
  addCylinder(hubVisual, 0.017, 0.045, 0.095, darkBand);
  addCylinder(hubVisual, 0.034, 0.055, 0.045, chrome);
  addCylinder(hubVisual, claw.housingRadius, 0.075, -0.022, brushedMetal);
  addCylinder(hubVisual, 0.048, 0.018, 0.005, darkBand);
  addCylinder(
    hubVisual,
    claw.collarRadius,
    claw.collarHeight,
    claw.fingerPivotY + claw.collarHeight * 0.45 - claw.hubCenterY,
    chrome,
  );
  addCylinder(
    hubVisual,
    claw.housingRadius + 0.0015,
    0.010,
    0.011,
    primaryAccentMaterial,
  );
  addCylinder(
    hubVisual,
    claw.housingRadius + 0.0015,
    0.008,
    -0.050,
    secondaryAccentMaterial,
  );
  hubVisual.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = clawCastsShadow;
    }
  });
  scene.add(hubVisual);

  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0022, 0.0022, 1, 10),
    themedStandardMaterial(machineInterior.cable),
  );
  cable.castShadow = clawCastsShadow;
  scene.add(cable);

  const serviceWireAttributes: Array<{
    offsetX: number;
    offsetZ: number;
    attribute: THREE.BufferAttribute;
  }> = [];
  if (options.addServiceWires) {
    const wireMaterial = new THREE.LineBasicMaterial({
      color: machineInterior.serviceWireColor,
      transparent: true,
      opacity: 0.92,
    });
    for (const [offsetX, offsetZ] of [
      [-0.012, 0.008],
      [0.012, -0.008],
    ] as const) {
      const geometry = new THREE.BufferGeometry();
      const attribute = new THREE.BufferAttribute(
        new Float32Array(9),
        3,
      );
      geometry.setAttribute("position", attribute);
      const wire = new THREE.Line(geometry, wireMaterial);
      scene.add(wire);
      serviceWireAttributes.push({
        offsetX,
        offsetZ,
        attribute,
      });
    }
  }

  const anchorY = gantry.carriageY - gantry.carriageHalfY;
  const initialHubY = anchorY - gantry.suspensionLength;
  const reelAnchorBody = physics.createKinematicBody({
    x: initialPosition.x,
    y: anchorY,
    z: initialPosition.z,
  });
  const hubBody = physics.createDynamicCylinder(
    {
      x: initialPosition.x,
      y: initialHubY,
      z: initialPosition.z,
    },
    claw.hubColliderHalfHeight,
    claw.collarRadius,
    gantry.hubMassKg,
    {
      friction: 0.55,
      restitution: 0.02,
    },
  );
  hubBody.setAngularDamping(gantry.suspensionAngularDamping);
  hubBody.setLinearDamping(gantry.suspensionLinearDamping);
  bindings.push({ mesh: hubVisual, body: hubBody });

  physics.createSphericalJoint(
    reelAnchorBody,
    hubBody,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: gantry.suspensionLength, z: 0 },
    false,
  );

  const fingerPivotLocalY = claw.fingerPivotY - claw.hubCenterY;

  for (const theta of fingerAzimuths) {
    const radialX = Math.cos(theta);
    const radialZ = Math.sin(theta);
    const pivotLocal = {
      x: radialX * claw.fingerPivotRadius,
      y: fingerPivotLocalY,
      z: radialZ * claw.fingerPivotRadius,
    };
    const pivotWorld = {
      x: initialPosition.x + pivotLocal.x,
      y: initialHubY + pivotLocal.y,
      z: initialPosition.z + pivotLocal.z,
    };
    const tangent = {
      x: -Math.sin(theta),
      y: 0,
      z: Math.cos(theta),
    };
    const points = createFingerPoints(theta);
    const visual = createFingerVisual(
      points,
      chrome,
      tipMaterial,
      Math.max(
        claw.fingerTipVisualRadius,
        fingerLowerPadRadiusMeters,
      ),
      fingerLowerPadRadiusMeters,
      fingerLowerPadLengthMeters,
    );
    visual.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = clawCastsShadow;
      }
    });
    scene.add(visual);

    const body = physics.createDynamicCapsuleChain(
      pivotWorld,
      createFingerSegments(
        points,
        fingerLowerPadRadiusMeters,
        fingerLowerPadLengthMeters,
        activeFingerFriction,
      ),
      {
        friction: activeFingerRodFriction,
        restitution: claw.fingerRestitution,
        density: activeFingerDensity,
        enableCcd: options.clawContinuousCollision ?? false,
      },
    );
    body.setAngularDamping(activeFingerAngularDamping);
    const joint = physics.createRevoluteJoint(hubBody, body, {
      anchor1: pivotLocal,
      anchor2: { x: 0, y: 0, z: 0 },
      axis: tangent,
      minAngle: closedAngleRadians,
      maxAngle: claw.openAngle,
      initialTarget: claw.openAngle,
      stiffness: claw.motorStiffness,
      damping: claw.motorDamping,
      maxTorque: closePickupTorque,
      contactsEnabled: false,
    });

    fingerBodies.push(body);
    fingerJoints.push(joint);
    bindings.push({ mesh: visual, body });
  }

  const motionConfig: GantryMotionConfig = {
    x: {
      minPosition: gantry.xMin,
      maxPosition: gantry.xMax,
      maxSpeed: gantry.maxSpeed,
      acceleration: gantry.acceleration,
      braking: gantry.braking,
    },
    z: {
      minPosition: gantry.zMin,
      maxPosition: gantry.zMax,
      maxSpeed: gantry.maxSpeed,
      acceleration: gantry.acceleration,
      braking: gantry.braking,
    },
  };
  const reelConfig: ReelConfig = {
    minPayout: gantry.reelMinPayout,
    maxPayout: gantry.reelMaxPayout,
    maxSpeed: gantry.reelMaxSpeed,
    acceleration: gantry.reelAcceleration,
    braking: gantry.reelBraking,
  };
  const approachReelConfig: ReelConfig =
    options.reelApproachMaxSpeedMetersPerSecond === undefined
      ? reelConfig
      : {
          ...reelConfig,
          maxSpeed: Math.min(
            reelConfig.maxSpeed,
            options.reelApproachMaxSpeedMetersPerSecond,
          ),
        };
  const playReturnTarget =
    options.playReturnTarget ?? { x: gantry.homeX, z: gantry.homeZ };
  const playConfig = {
    autoClosePayoutMeters:
      M04_PLAY_CONFIG.autoClosePayoutMeters +
      verticalHomeOffset + additionalPickupDropMeters,
    closedAngleRadians,
    openAngleRadians: claw.openAngle,
    closeCompletionToleranceRadians:
      M04_PLAY_CONFIG.closeCompletionToleranceRadians,
    releaseCompletionToleranceRadians:
      M04_PLAY_CONFIG.releaseCompletionToleranceRadians,
    closeSettleSeconds: M04_PLAY_CONFIG.closeSettleSeconds,
    pickupLiftDistanceMeters,
    holdBoostDurationSeconds:
      M04_PLAY_CONFIG.holdBoostDurationSeconds,
  };

  let motion: GantryMotionState = {
    x: { position: initialPosition.x, velocity: 0 },
    z: { position: initialPosition.z, velocity: 0 },
  };
  let reel: ReelState = { payout: 0, velocity: 0 };
  let manualReelCommand = 0;
  let homeReturnPhase: HomeReturnPhase = "READY";
  let playCycle = createM04PlayState();
  let fingerCommand = 0;
  let holdBoostActive = false;
  let selfContactGuardActive = false;
  let bottomCloseSettleRemainingSeconds = 0;
  let closeRampElapsedSeconds = 0;
  let firstDescentPrizeContactPayout: number | null = null;

  let pt006Phase: Pt006Phase = "READY";
  let pt006Seconds = 0;
  let pt006Result = "NOT RUN";
  let minimumRelativeX = 0;
  let maximumRelativeX = 0;
  let peakSwingAngle = 0;

  let pt008Phase: Pt008Phase = "READY";
  let pt008Seconds = 0;
  let pt008Result = "NOT RUN";
  let pt008DropTicks = 0;
  let pt008StartHubY = initialHubY;
  let pt008MinHubY = initialHubY;
  let pt008MaxHorizontalOffset = 0;
  let pt008DropStartSpeed = 0;
  let pt008FirstTickSpeed = 0;

  const pressed = new Set<string>();
  let manualTouchInput = { x: 0, z: 0 };
  const cableUp = new THREE.Vector3(0, 1, 0);
  const cableTop = new THREE.Vector3();
  const cableBottom = new THREE.Vector3();
  const cableDirection = new THREE.Vector3();
  const cableMidpoint = new THREE.Vector3();

  const controlsEnabled = (): boolean =>
    options.controlsEnabled?.() ?? true;

  const manualInput = (): { x: number; z: number } => {
    if (!controlsEnabled()) {
      return { x: 0, z: 0 };
    }

    const keyboardX =
      (pressed.has("ArrowRight") ? 1 : 0) -
      (pressed.has("ArrowLeft") ? 1 : 0);
    const keyboardZ =
      (pressed.has("ArrowDown") ? 1 : 0) -
      (pressed.has("ArrowUp") ? 1 : 0);

    return {
      x: Math.max(-1, Math.min(1, keyboardX + manualTouchInput.x)),
      z: Math.max(-1, Math.min(1, keyboardZ + manualTouchInput.z)),
    };
  };

  const updateCableVisual = (): void => {
    bridgeVisual.position.x = motion.x.position;
    const hub = hubBody.translation();
    cableTop.set(motion.x.position, anchorY, motion.z.position);
    cableBottom.set(
      hub.x,
      hub.y + claw.hubColliderHalfHeight,
      hub.z,
    );
    cableDirection.subVectors(cableTop, cableBottom);
    const length = Math.max(0.001, cableDirection.length());
    cableMidpoint.addVectors(cableTop, cableBottom).multiplyScalar(0.5);
    cable.position.copy(cableMidpoint);
    cable.scale.set(1, length, 1);
    cable.quaternion.setFromUnitVectors(
      cableUp,
      cableDirection.normalize(),
    );

    for (const serviceWire of serviceWireAttributes) {
      const topX = motion.x.position + serviceWire.offsetX;
      const topY = anchorY + 0.012;
      const topZ = motion.z.position + serviceWire.offsetZ;
      const bottomX = hub.x + serviceWire.offsetX * 0.35;
      const bottomY = hub.y + claw.hubColliderHalfHeight + 0.035;
      const bottomZ = hub.z + serviceWire.offsetZ * 0.35;
      const midX = (topX + bottomX) * 0.5 + serviceWire.offsetX * 0.4;
      const midY = (topY + bottomY) * 0.5 - 0.012;
      const midZ = (topZ + bottomZ) * 0.5 + serviceWire.offsetZ * 0.4;

      serviceWire.attribute.setXYZ(0, topX, topY, topZ);
      serviceWire.attribute.setXYZ(1, midX, midY, midZ);
      serviceWire.attribute.setXYZ(2, bottomX, bottomY, bottomZ);
      serviceWire.attribute.needsUpdate = true;
    }
  };

  const startHomeReturn = (): void => {
    if (!controlsEnabled()) {
      return;
    }

    const atTop =
      reel.payout <= gantry.reelMinPayout + 1e-5 &&
      Math.abs(reel.velocity) < 1e-4;
    if (
      !atTop ||
      pt006Phase === "ACCELERATING" ||
      pt006Phase === "BRAKING" ||
      pt008Phase === "ACCELERATING" ||
      pt008Phase === "BRAKING" ||
      pt008Phase === "DROPPING" ||
      playCycle.phase !== "READY"
    ) {
      return;
    }
    manualReelCommand = 0;
    homeReturnPhase = "RETURNING_HOME";
  };

  const startPt006 = (): void => {
    if (!controlsEnabled()) {
      return;
    }

    if (
      pt006Phase !== "READY" ||
      pt008Phase !== "READY" ||
      reel.payout > 0.001 ||
      homeReturnPhase === "RETURNING_HOME" ||
      playCycle.phase !== "READY"
    ) {
      return;
    }
    pt006Phase = "ACCELERATING";
    pt006Seconds = 0;
    pt006Result = "RUNNING";
    minimumRelativeX = 0;
    maximumRelativeX = 0;
    peakSwingAngle = 0;
    manualReelCommand = 0;
  };

  const startPt008 = (): void => {
    if (!controlsEnabled()) {
      return;
    }

    if (
      pt008Phase !== "READY" ||
      pt006Phase !== "READY" ||
      reel.payout > 0.001 ||
      homeReturnPhase === "RETURNING_HOME" ||
      playCycle.phase !== "READY"
    ) {
      return;
    }
    pt008Phase = "ACCELERATING";
    pt008Seconds = 0;
    pt008Result = "RUNNING";
    pt008DropTicks = 0;
    pt008StartHubY = hubBody.translation().y;
    pt008MinHubY = pt008StartHubY;
    pt008MaxHorizontalOffset = 0;
    pt008DropStartSpeed = 0;
    pt008FirstTickSpeed = 0;
    manualReelCommand = 0;
  };

  const isSafeForService = (): boolean => {
    const reelAtTop =
      reel.payout <= gantry.reelMinPayout + 1e-5 &&
      Math.abs(reel.velocity) < 1e-4;
    const gantryStopped =
      Math.abs(motion.x.velocity) <=
        gantry.homeVelocityTolerance &&
      Math.abs(motion.z.velocity) <=
        gantry.homeVelocityTolerance;
    const fingersOpen =
      Math.abs(fingerCommand - claw.openAngle) <=
      playConfig.releaseCompletionToleranceRadians;
    const testMotionActive =
      pt006Phase === "ACCELERATING" ||
      pt006Phase === "BRAKING" ||
      pt008Phase === "ACCELERATING" ||
      pt008Phase === "BRAKING" ||
      pt008Phase === "DROPPING";

    return (
      playCycle.phase === "READY" &&
      reelAtTop &&
      gantryStopped &&
      fingersOpen &&
      !testMotionActive &&
      homeReturnPhase !== "LIFTING" &&
      homeReturnPhase !== "RETURNING_HOME"
    );
  };

  const triggerPrimaryAction = (): boolean => {
    if (!controlsEnabled()) {
      return false;
    }

    if (
      pt006Phase === "ACCELERATING" ||
      pt006Phase === "BRAKING" ||
      pt008Phase === "ACCELERATING" ||
      pt008Phase === "BRAKING" ||
      pt008Phase === "DROPPING" ||
      homeReturnPhase === "RETURNING_HOME"
    ) {
      return false;
    }

    manualReelCommand = 0;
    homeReturnPhase = "READY";
    const previous = playCycle;
    playCycle = applyM04Action(playCycle, reel.payout);
    if (previous.phase === "READY" && playCycle.phase === "DESCENDING") {
      firstDescentPrizeContactPayout = null;
    }
    if (
      previous.phase === "DESCENDING" &&
      playCycle.phase === "CLOSING"
    ) {
      reel = haltReel(reel);
    }
    return playCycle !== previous;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    if (event.code === "KeyP") {
      startPt006();
      return;
    }
    if (event.code === "KeyT") {
      startPt008();
      return;
    }
    if (event.code === "KeyH") {
      startHomeReturn();
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      triggerPrimaryAction();
      return;
    }

    pressed.add(event.code);
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    pressed.delete(event.code);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  updateCableVisual();

  return {
    bindings,
    massPropertiesDebugTargets: [{ body: hubBody, label: "suspended-claw-hub" }],
    milestone: options.milestone ?? "M04 / BOOST + RETURN + RELEASE",
    camera: options.camera ?? {
      position: [0.78, 0.82, 1.08],
      target: [0, 0.72, 0],
    },
    primaryAction: triggerPrimaryAction,
    isSafeForService,
    getMachineAudioState() {
      return {
        gantrySpeedMetersPerSecond: Math.hypot(
          motion.x.velocity,
          motion.z.velocity,
        ),
        reelSpeedMetersPerSecond: reel.velocity,
        playPhase: playCycle.phase,
      };
    },
    setManualGantryInput(x: number, z: number): void {
      if (!controlsEnabled()) {
        manualTouchInput = { x: 0, z: 0 };
        return;
      }
      manualTouchInput = {
        x: Math.max(-1, Math.min(1, x)),
        z: Math.max(-1, Math.min(1, z)),
      };
    },
    beforePhysicsStep(stepSeconds: number): void {
      const hubPosition = hubBody.translation();
      const relativeX = hubPosition.x - motion.x.position;
      const swingAngle = computeSwingAngle(
        anchorY,
        motion.x.position,
        motion.z.position,
        hubPosition,
      );

      if (pt006Phase === "ACCELERATING") {
        minimumRelativeX = Math.min(minimumRelativeX, relativeX);
      } else if (pt006Phase === "BRAKING") {
        maximumRelativeX = Math.max(maximumRelativeX, relativeX);
        peakSwingAngle = Math.max(peakSwingAngle, swingAngle);
      }

      let inputX = 0;
      let inputZ = 0;
      let reelCommand = manualReelCommand;

      const prizeBodies = options.descentContactBodies?.() ?? [];
      const fingerPrizeContacts = fingerBodies.map(
        (fingerBody) =>
          playCycle.phase === "DESCENDING" &&
          prizeBodies.some(
            (prizeBody) =>
              physics.countBodyContactPairs(fingerBody, prizeBody) > 0,
          ),
      );
      if (playCycle.phase === "DESCENDING" &&
          fingerPrizeContacts.some(Boolean) &&
          firstDescentPrizeContactPayout === null) {
        firstDescentPrizeContactPayout = reel.payout;
      }
      const prizeResistanceLimitReached =
        playCycle.phase === "DESCENDING" &&
        firstDescentPrizeContactPayout !== null &&
        options.descentPrizeFollowThroughMeters !== undefined &&
        reel.payout >=
          firstDescentPrizeContactPayout +
          options.descentPrizeFollowThroughMeters;
      const descentFloorContact =
        playCycle.phase === "DESCENDING" &&
        (options.descentFloorBodies?.() ?? []).some((deckBody) =>
          fingerBodies.some(
            (fingerBody) =>
              physics.countBodyContactPairs(
                fingerBody,
                deckBody,
              ) > 0,
          ),
        );
      if (descentFloorContact || prizeResistanceLimitReached) {
        playCycle = applyM04AutomaticLanding(
          playCycle,
          reel.payout,
        );
        reel = haltReel(reel);
        manualReelCommand = 0;
        reelCommand = 0;
        bottomCloseSettleRemainingSeconds =
          bottomCloseSettleSeconds;
        closeRampElapsedSeconds = 0;
      }

      if (
        pt008Phase === "ACCELERATING" ||
        pt008Phase === "BRAKING" ||
        pt008Phase === "DROPPING"
      ) {
        reelCommand = 0;

        if (pt008Phase === "ACCELERATING") {
          inputX = 1;
          pt008Seconds += stepSeconds;
          if (pt008Seconds >= gantry.pt008AccelerationSeconds) {
            pt008Phase = "BRAKING";
            pt008Seconds = 0;
          }
        } else if (pt008Phase === "BRAKING") {
          pt008Seconds += stepSeconds;
          if (pt008Seconds >= gantry.pt008BrakeLeadSeconds) {
            pt008Phase = "DROPPING";
            pt008Seconds = 0;
            pt008DropTicks = 0;
          }
        } else {
          const velocity = hubBody.linvel();
          const offset = Math.hypot(
            hubPosition.x - motion.x.position,
            hubPosition.z - motion.z.position,
          );

          if (pt008DropTicks === 0) {
            pt008StartHubY = hubPosition.y;
            pt008MinHubY = hubPosition.y;
            pt008DropStartSpeed = Math.hypot(velocity.x, velocity.z);
          } else {
            pt008MinHubY = Math.min(pt008MinHubY, hubPosition.y);
            pt008MaxHorizontalOffset = Math.max(
              pt008MaxHorizontalOffset,
              offset,
            );
            if (pt008DropTicks === 1) {
              pt008FirstTickSpeed = Math.hypot(velocity.x, velocity.z);
            }
          }

          const atBottom =
            reel.payout >= gantry.reelMaxPayout - 1e-5 &&
            Math.abs(reel.velocity) < 1e-4;

          if (atBottom) {
            pt008Phase = "COMPLETE";
            manualReelCommand = 0;
            const retention =
              pt008DropStartSpeed > 1e-6
                ? pt008FirstTickSpeed / pt008DropStartSpeed
                : 0;
            pt008Result = evaluatePt008Momentum({
              descentMeters: pt008StartHubY - pt008MinHubY,
              maxHorizontalOffsetMeters: pt008MaxHorizontalOffset,
              velocityRetentionRatio: retention,
            })
              ? "PASS"
              : "FAIL";
          } else {
            reelCommand = 1;
            pt008DropTicks += 1;
          }
        }
      } else if (
        pt006Phase === "ACCELERATING" ||
        pt006Phase === "BRAKING"
      ) {
        reelCommand = 0;

        if (pt006Phase === "ACCELERATING") {
          inputX = 1;
          pt006Seconds += stepSeconds;
          if (pt006Seconds >= gantry.pt006AccelerationSeconds) {
            pt006Phase = "BRAKING";
            pt006Seconds = 0;
          }
        } else {
          pt006Seconds += stepSeconds;
          if (pt006Seconds >= gantry.pt006BrakeObservationSeconds) {
            pt006Phase = "COMPLETE";
            const currentHub = hubBody.translation();
            pt006Result = evaluatePt006Swing({
              lagMeters: Math.abs(Math.min(0, minimumRelativeX)),
              forwardSwingMeters: Math.max(0, maximumRelativeX),
              peakSwingAngleRadians: peakSwingAngle,
              residualOffsetMeters: Math.hypot(
                currentHub.x - motion.x.position,
                currentHub.z - motion.z.position,
              ),
            })
              ? "PASS"
              : "FAIL";
          }
        }
      } else if (homeReturnPhase !== "RETURNING_HOME") {
        if (playCycle.phase === "READY") {
          const input = manualInput();
          inputX = input.x;
          inputZ = input.z;
        } else {
          reelCommand = m04ReelCommand(playCycle);
        }
      }

      if (homeReturnPhase === "RETURNING_HOME") {
        motion = advanceGantryMotionTowardPosition(
          motion,
          gantry.homeX,
          gantry.homeZ,
          motionConfig,
          stepSeconds,
        );
      } else if (playCycle.phase === "RETURNING") {
        motion = advanceGantryMotionTowardPosition(
          motion,
          playReturnTarget.x,
          playReturnTarget.z,
          motionConfig,
          stepSeconds,
        );
      } else {
        motion = advanceGantryMotion(
          motion,
          inputX,
          inputZ,
          motionConfig,
          stepSeconds,
        );
      }

      const wasLifting = reelCommand < 0;
      const phaseBeforeReelAdvance = playCycle.phase;
      // Stocked cabinets can reel quickly through open air, then use a
      // physically slower approach for the last stretch before auto-close.
      // This changes only motor speed, not collision / success decisions.
      const controlledApproach =
        playCycle.phase === "DESCENDING" &&
        options.reelApproachDistanceMeters !== undefined &&
        reel.payout >=
          playConfig.autoClosePayoutMeters - options.reelApproachDistanceMeters;
      reel = advanceReel(
        reel,
        reelCommand,
        controlledApproach ? approachReelConfig : reelConfig,
        stepSeconds,
      );

      const m04HomeTolerance = {
        position: gantry.homePositionTolerance,
        velocity: gantry.homeVelocityTolerance,
      };
      const m04HomeReached =
        isGantryAxisAtTarget(
          motion.x,
          playReturnTarget.x,
          m04HomeTolerance,
        ) &&
        isGantryAxisAtTarget(
          motion.z,
          playReturnTarget.z,
          m04HomeTolerance,
        );
      const holdBoostRequested =
        pressed.has("ShiftLeft") || pressed.has("ShiftRight");

      const reelAtTop =
        reel.payout <= gantry.reelMinPayout + 1e-5 &&
        Math.abs(reel.velocity) < 1e-4;

      playCycle = advanceM04PlayState(
        playCycle,
        {
          reelPayoutMeters: reel.payout,
          fingerCommandRadians: fingerCommand,
          fingerClosedByContact: selfContactGuardActive,
          reelAtTop,
          homeReached: m04HomeReached,
          holdBoostRequested,
        },
        playConfig,
        0,
      );

      // AUTO CLOSE must stop the vertical carriage immediately at the
      // trigger depth. Previously one residual downward reel step could
      // continue compressing the physical claw into prizes / the deck,
      // causing a hard kick and bottom-end chatter.
      if (
        phaseBeforeReelAdvance === "DESCENDING" &&
        playCycle.phase === "CLOSING"
      ) {
        reel = haltReel(reel);
        bottomCloseSettleRemainingSeconds =
          bottomCloseSettleSeconds;
        closeRampElapsedSeconds = 0;
      }
      if (bottomCloseSettleRemainingSeconds > 0) {
        bottomCloseSettleRemainingSeconds = Math.max(
          0,
          bottomCloseSettleRemainingSeconds - stepSeconds,
        );
      }

      if (
        wasLifting &&
        reelAtTop &&
        homeReturnPhase === "LIFTING"
      ) {
        manualReelCommand = 0;
        homeReturnPhase = "RETURNING_HOME";
      }

      if (homeReturnPhase === "RETURNING_HOME") {
        const tolerance = {
          position: gantry.homePositionTolerance,
          velocity: gantry.homeVelocityTolerance,
        };
        if (
          isGantryAxisAtTarget(motion.x, gantry.homeX, tolerance) &&
          isGantryAxisAtTarget(motion.z, gantry.homeZ, tolerance)
        ) {
          homeReturnPhase = "COMPLETE";
        }
      }

      carriageBody.setNextKinematicTranslation({
        x: motion.x.position,
        y: gantry.carriageY,
        z: motion.z.position,
      });
      reelAnchorBody.setNextKinematicTranslation({
        x: motion.x.position,
        y: anchorY - reel.payout,
        z: motion.z.position,
      });

      const hubVelocity = hubBody.linvel();
      const currentHub = hubBody.translation();
      const stabilizerImpulse = computeSuspensionStabilizerImpulse(
        {
          anchorX: motion.x.position,
          anchorZ: motion.z.position,
          anchorVelocityX: motion.x.velocity,
          anchorVelocityZ: motion.z.velocity,
          hubX: currentHub.x,
          hubZ: currentHub.z,
          hubVelocityX: hubVelocity.x,
          hubVelocityZ: hubVelocity.z,
        },
        {
          stiffness: gantry.suspensionSpringStiffness,
          damping: gantry.suspensionSpringDamping,
          maxForce: gantry.suspensionSpringMaxForce,
        },
        stepSeconds,
      );
      hubBody.applyImpulse(
        { x: stabilizerImpulse.x, y: 0, z: stabilizerImpulse.z },
        true,
      );

      const closeMechanicallyRequested =
        m04FingerShouldClose(playCycle);
      const closingFinger =
        closeMechanicallyRequested &&
        bottomCloseSettleRemainingSeconds <= 0;
      holdBoostActive = m04HoldBoostActive(
        playCycle,
        holdBoostRequested,
        playConfig,
      );
      // Keep the natural full-open motor target even against cabinet walls.
      // Existing Rapier finger/glass contacts provide real physical deflection.
      const fingerTarget = closingFinger
        ? closedAngleRadians
        : claw.openAngle;
      const siblingFingerContact =
        closingFinger &&
        fingerIndexPairs.some(
          ([first, second]) =>
            physics.countBodyContactPairs(
              fingerBodies[first]!,
              fingerBodies[second]!,
            ) > 0,
        );
      selfContactGuardActive = updateFingerSelfContactGuard(
        selfContactGuardActive,
        closingFinger,
        siblingFingerContact,
      );
      fingerCommand = advanceFingerCommandWithSelfContactGuard(
        fingerCommand,
        fingerTarget,
        claw.motorSpeedRadiansPerSecond,
        stepSeconds,
        closingFinger,
        selfContactGuardActive,
      );
      playCycle = advanceM04PlayState(
        playCycle,
        {
          reelPayoutMeters: reel.payout,
          fingerCommandRadians: fingerCommand,
          fingerClosedByContact: selfContactGuardActive,
          reelAtTop,
          homeReached: m04HomeReached,
          holdBoostRequested,
        },
        playConfig,
        stepSeconds,
      );
      if (closingFinger && closeRampSeconds > 0) {
        closeRampElapsedSeconds = Math.min(
          closeRampSeconds,
          closeRampElapsedSeconds + stepSeconds,
        );
      } else if (!closeMechanicallyRequested) {
        closeRampElapsedSeconds = 0;
      }
      const closeRampProgress =
        closeRampSeconds <= 0
          ? 1
          : Math.min(1, closeRampElapsedSeconds / closeRampSeconds);
      const rampedCloseTorque =
        closeRampStartTorque +
        (closePickupTorque - closeRampStartTorque) * closeRampProgress;
      const activeForcePhase = m04ForcePhase(playCycle);
      const activeContactTorque =
        activeForcePhase === "RETAINING"
          ? holdBoostActive
            ? holdBoostTorque
            : retainingTorque
          : rampedCloseTorque;
      // Hold the claw fully OPEN through free-air descent. The weaker,
      // contact-compliant motor is permitted only after real prize contact
      // or auto-depth has halted the reel for the brief bottom settle.
      // Weakening the motor at DROP start made heavy fingers collapse
      // under their own weight before ever touching a prize.
      const compliantOpenDescent =
        bottomCloseSettleRemainingSeconds > 0 && !closingFinger;
      for (const [index, joint] of fingerJoints.entries()) {
        // A finger stays fully open in free air. During genuine contact
        // with a prize it can yield mechanically without ending the DROP.
        const touchingPrize = fingerPrizeContacts[index] ?? false;
        joint.configureMotorPosition(
          fingerCommand,
          closingFinger
            ? claw.motorStiffness
            : compliantOpenDescent
              ? descentOpenStiffness
              : touchingPrize
                ? descentPrizeContactStiffness
                : M02_FINGER_TRANSPORT_CONFIG.stiffness,
          closingFinger
            ? closeMotorDamping
            : compliantOpenDescent
              ? descentOpenDamping
              : touchingPrize
                ? descentPrizeContactDamping
                : M02_FINGER_TRANSPORT_CONFIG.damping,
        );
        joint.setMotorMaxForce(
          closingFinger
            ? activeContactTorque
            : compliantOpenDescent
              ? descentOpenMaxTorque
              : touchingPrize
                ? descentPrizeContactMaxTorque
                : M02_FINGER_TRANSPORT_CONFIG.maxTorque,
        );
      }
      for (const body of fingerBodies) {
        body.wakeUp();
      }
      hubBody.wakeUp();
      updateCableVisual();
    },
    debugLines(): string[] {
      const hub = hubBody.translation();
      const relativeX = hub.x - motion.x.position;
      const relativeZ = hub.z - motion.z.position;
      const swingAngle = computeSwingAngle(
        anchorY,
        motion.x.position,
        motion.z.position,
        hub,
      );
      const pt008Retention =
        pt008DropStartSpeed > 1e-6
          ? pt008FirstTickSpeed / pt008DropStartSpeed
          : 0;

      return [
        "Gantry X / Z     " +
          motion.x.position.toFixed(3) +
          " / " +
          motion.z.position.toFixed(3) +
          " m",
        "Velocity X / Z   " +
          motion.x.velocity.toFixed(3) +
          " / " +
          motion.z.velocity.toFixed(3) +
          " m/s",
        "Hub lag X / Z    " +
          relativeX.toFixed(3) +
          " / " +
          relativeZ.toFixed(3) +
          " m",
        "Swing angle      " + swingAngle.toFixed(3) + " rad",
        "Reel payout      " +
          reel.payout.toFixed(3) +
          " m @ " +
          reel.velocity.toFixed(3) +
          " m/s",
        "Effective cable  " +
          (gantry.suspensionLength + reel.payout).toFixed(3) +
          " m",
        "M04 play phase   " + playCycle.phase,
        "M04 close reason " + (playCycle.closeReason ?? "NONE"),
        "M04 close payout " +
          (playCycle.closeStartPayoutMeters === null
            ? "-"
            : playCycle.closeStartPayoutMeters.toFixed(3) + " m"),
        "M04 force phase  " + m04ForcePhase(playCycle),
        "M04 phase time   " +
          playCycle.phaseElapsedSeconds.toFixed(3) +
          " s",
        "M04 pickup start " +
          (playCycle.pickupStartPayoutMeters === null
            ? "-"
            : playCycle.pickupStartPayoutMeters.toFixed(3) + " m"),
        "M04 boost        " +
          (holdBoostActive ? "ACTIVE" : "off") +
          " " +
          playCycle.holdBoostUsedSeconds.toFixed(2) +
          " / " +
          M04_PLAY_CONFIG.holdBoostDurationSeconds.toFixed(2) +
          " s",
        "Claw topology    " +
          clawTopologyId +
          " / " +
          fingerBodies.length +
          " fingers",
        "Finger command   " + fingerCommand.toFixed(3) + " rad",
        "Self-contact     " +
          (selfContactGuardActive ? "GUARD" : "clear"),
        "PT-006 phase     " + pt006Phase,
        "PT-006 result    " + pt006Result,
        "PT-008 phase     " + pt008Phase,
        "PT-008 result    " + pt008Result,
        "PT-008 descent   " +
          Math.max(0, pt008StartHubY - pt008MinHubY).toFixed(3) +
          " m",
        "PT-008 horiz max " +
          pt008MaxHorizontalOffset.toFixed(3) +
          " m",
        "PT-008 v retain  " + pt008Retention.toFixed(2),
        "Home return      " +
          homeReturnPhase +
          " err " +
          Math.hypot(
            motion.x.position - gantry.homeX,
            motion.z.position - gantry.homeZ,
          ).toFixed(3) +
          " m",
        "Play return tgt  " +
          playReturnTarget.x.toFixed(3) +
          " / " +
          playReturnTarget.z.toFixed(3) +
          " m",
        "Spring k / c     " +
          gantry.suspensionSpringStiffness.toFixed(1) +
          " / " +
          gantry.suspensionSpringDamping.toFixed(1),
        "Cabinet grip      " +
          activeFingerFriction.toFixed(2) +
          " / " +
          closePickupTorque.toFixed(3) +
          " / " +
          retainingTorque.toFixed(3) +
          " fric/C/P-ret",
        "Pickup strong lift " +
          pickupLiftDistanceMeters.toFixed(3) +
          " m",
        "Finger motor k/c/T " +
          (m04FingerShouldClose(playCycle)
            ? claw.motorStiffness
            : M02_FINGER_TRANSPORT_CONFIG.stiffness
          ).toFixed(0) +
          " / " +
          (m04FingerShouldClose(playCycle)
            ? claw.motorDamping
            : M02_FINGER_TRANSPORT_CONFIG.damping
          ).toFixed(0) +
          " / " +
          (m04FingerShouldClose(playCycle)
            ? m04ForcePhase(playCycle) === "RETAINING"
              ? holdBoostActive
                ? M04_PLAY_CONFIG.holdBoostTorque
                : retainingTorque
              : closePickupTorque
            : M02_FINGER_TRANSPORT_CONFIG.maxTorque
          ).toFixed(3),
        "Controls         Arrows aim | Space DROP/CLOSE | hold Shift BOOST",
        "Auto close       " +
          M04_PLAY_CONFIG.autoClosePayoutMeters.toFixed(3) +
          " m travel",
        "Settle / pickup   " +
          M04_PLAY_CONFIG.closeSettleSeconds.toFixed(2) +
          " s / " +
          M04_PLAY_CONFIG.pickupLiftDistanceMeters.toFixed(2) +
          " m",
        "BOOST T / budget  " +
          holdBoostTorque.toFixed(3) +
          " N·m / " +
          M04_PLAY_CONFIG.holdBoostDurationSeconds.toFixed(2) +
          " s",
        "Tests            P PT-006 | T PT-008 | M COM | D colliders",
      ];
    },
  };
}
