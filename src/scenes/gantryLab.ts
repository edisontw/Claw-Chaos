import * as THREE from "three";
import type {
  PhysicsRuntime,
  RevoluteJointHandle,
  RigidBodyHandle,
} from "../physics/PhysicsRuntime";
import { M08_GANTRY_VISUAL_STYLE } from "../cabinet/cabinetVisualStyle";
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
  fingerNodes?: readonly { radial: number; down: number }[];
  fingerLowerPadSegmentIndices?: readonly number[];
  fingerFriction?: number;
  closePickupTorque?: number;
  retainingTorque?: number;
  holdBoostTorque?: number;
  pickupLiftDistanceMeters?: number;
  closedAngleRadians?: number;
  fingerLowerPadRadiusMeters?: number;
}

export interface GantryLabOptions {
  addLabFloor?: boolean;
  initialPosition?: { x: number; z: number };
  playReturnTarget?: { x: number; z: number };
  verticalHomeOffset?: number;
  addServiceWires?: boolean;
  gripProfile?: GantryGripProfile;
  controlsEnabled?: () => boolean;
  milestone?: string;
  camera?: {
    position: [number, number, number];
    target: [number, number, number];
  };
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
  const verticalHomeOffset = options.verticalHomeOffset ?? 0;
  const activeFingerNodes =
    options.gripProfile?.fingerNodes ?? claw.fingerNodes;
  const activeFingerLowerPadSegmentIndices =
    options.gripProfile?.fingerLowerPadSegmentIndices;
  const activeFingerFriction =
    options.gripProfile?.fingerFriction ?? claw.fingerFriction;
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
  const gantry =
    verticalHomeOffset === 0
      ? M02_GANTRY_CONFIG
      : {
          ...M02_GANTRY_CONFIG,
          carriageY: M02_GANTRY_CONFIG.carriageY + verticalHomeOffset,
          reelMaxPayout:
            M02_GANTRY_CONFIG.reelMaxPayout + verticalHomeOffset,
        };
  const initialPosition = resolveGantryInitialPosition(
    options.initialPosition,
  );
  const bindings: SimulationScene["bindings"] = [];
  const fingerBodies: RigidBodyHandle[] = [];
  const fingerJoints: RevoluteJointHandle[] = [];

  if (options.addLabFloor !== false) {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.04, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x626c78,
        roughness: 0.92,
        metalness: 0.02,
      }),
    );
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);
    physics.createStaticCuboid(
      { x: 0, y: -0.02, z: 0 },
      { x: 0.7, y: 0.02, z: 0.6 },
    );
  }

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x5d6876,
    roughness: 0.64,
    metalness: 0.42,
  });
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

  const bridgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x727e8c,
    roughness: 0.62,
    metalness: 0.40,
  });
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
    new THREE.MeshStandardMaterial({
      color: 0xaeb8c3,
      roughness: 0.60,
      metalness: 0.42,
    }),
  );
  carriageVisual.castShadow = true;

  const winchMetal = new THREE.MeshStandardMaterial({
    color: 0xb7c0c9,
    roughness: 0.60,
    metalness: 0.46,
  });
  const winchDark = new THREE.MeshStandardMaterial({
    color: 0x20262d,
    roughness: 0.40,
    metalness: 0.66,
  });
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

  const chrome = new THREE.MeshStandardMaterial({
    color: 0xc9d0d8,
    roughness: 0.58,
    metalness: 0.52,
  });
  const brushedMetal = new THREE.MeshStandardMaterial({
    color: 0x8d98a5,
    roughness: 0.62,
    metalness: 0.48,
  });
  const darkBand = new THREE.MeshStandardMaterial({
    color: 0x252a31,
    roughness: 0.70,
    metalness: 0.26,
  });
  const tipMaterial = new THREE.MeshStandardMaterial({
    color: 0x383d44,
    roughness: 0.72,
    metalness: 0.16,
  });

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
  scene.add(hubVisual);

  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0022, 0.0022, 1, 10),
    new THREE.MeshStandardMaterial({
      color: 0x30353c,
      roughness: 0.72,
      metalness: 0.38,
    }),
  );
  cable.castShadow = true;
  scene.add(cable);

  const serviceWireAttributes: Array<{
    offsetX: number;
    offsetZ: number;
    attribute: THREE.BufferAttribute;
  }> = [];
  if (options.addServiceWires) {
    const wireMaterial = new THREE.LineBasicMaterial({
      color: 0x1d2026,
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

  for (let index = 0; index < 3; index += 1) {
    const theta = index * (Math.PI * 2 / 3);
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
    const points = createFingerPoints(theta, activeFingerNodes);
    const visual = createFingerVisual(
      points,
      chrome,
      tipMaterial,
      Math.max(
        claw.fingerTipVisualRadius,
        fingerLowerPadRadiusMeters,
      ),
      fingerLowerPadRadiusMeters,
      activeFingerLowerPadSegmentIndices,
    );
    scene.add(visual);

    const body = physics.createDynamicCapsuleChain(
      pivotWorld,
      createFingerSegments(
        points,
        fingerLowerPadRadiusMeters,
        activeFingerLowerPadSegmentIndices,
      ),
      {
        friction: activeFingerFriction,
        restitution: claw.fingerRestitution,
        density: claw.fingerDensity,
      },
    );
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
  const playReturnTarget =
    options.playReturnTarget ?? { x: gantry.homeX, z: gantry.homeZ };
  const playConfig = {
    autoClosePayoutMeters:
      M04_PLAY_CONFIG.autoClosePayoutMeters + verticalHomeOffset,
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
      reel = advanceReel(reel, reelCommand, reelConfig, stepSeconds);

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
          reelAtTop,
          homeReached: m04HomeReached,
          holdBoostRequested,
        },
        playConfig,
        0,
      );

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

      const closingFinger = m04FingerShouldClose(playCycle);
      holdBoostActive = m04HoldBoostActive(
        playCycle,
        holdBoostRequested,
        playConfig,
      );
      const fingerTarget = closingFinger
        ? closedAngleRadians
        : claw.openAngle;
      fingerCommand = advanceMotorCommand(
        fingerCommand,
        fingerTarget,
        claw.motorSpeedRadiansPerSecond,
        stepSeconds,
      );
      playCycle = advanceM04PlayState(
        playCycle,
        {
          reelPayoutMeters: reel.payout,
          fingerCommandRadians: fingerCommand,
          reelAtTop,
          homeReached: m04HomeReached,
          holdBoostRequested,
        },
        playConfig,
        stepSeconds,
      );
      const activeForcePhase = m04ForcePhase(playCycle);
      const activeContactTorque =
        activeForcePhase === "RETAINING"
          ? holdBoostActive
            ? holdBoostTorque
            : retainingTorque
          : closePickupTorque;
      for (const joint of fingerJoints) {
        joint.configureMotorPosition(
          fingerCommand,
          closingFinger
            ? claw.motorStiffness
            : M02_FINGER_TRANSPORT_CONFIG.stiffness,
          closingFinger
            ? claw.motorDamping
            : M02_FINGER_TRANSPORT_CONFIG.damping,
        );
        joint.setMotorMaxForce(
          closingFinger
            ? activeContactTorque
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
        "Finger command   " + fingerCommand.toFixed(3) + " rad",
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
