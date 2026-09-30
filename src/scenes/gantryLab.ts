import * as THREE from "three";
import type {
  PhysicsRuntime,
  RevoluteJointHandle,
  RigidBodyHandle,
} from "../physics/PhysicsRuntime";
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
import { advanceReel, type ReelConfig, type ReelState } from "./reelMotion";
import {
  M04_PLAY_CONFIG,
  advanceM04PlayState,
  applyM04Action,
  createM04PlayState,
  m04FingerShouldClose,
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
  carriageX: number,
  carriageZ: number,
  hub: { x: number; y: number; z: number },
): number {
  const anchorY =
    M02_GANTRY_CONFIG.carriageY - M02_GANTRY_CONFIG.carriageHalfY;
  const horizontal = Math.hypot(hub.x - carriageX, hub.z - carriageZ);
  const vertical = Math.max(1e-6, anchorY - hub.y);
  return Math.atan2(horizontal, vertical);
}

export function createGantryLabScene(
  scene: THREE.Scene,
  physics: PhysicsRuntime,
): SimulationScene {
  const claw = CLAW_LAB_CONFIG;
  const gantry = M02_GANTRY_CONFIG;
  const bindings: SimulationScene["bindings"] = [];
  const fingerBodies: RigidBodyHandle[] = [];
  const fingerJoints: RevoluteJointHandle[] = [];

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

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x465363,
    roughness: 0.4,
    metalness: 0.72,
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

  const carriageVisual = new THREE.Mesh(
    new THREE.BoxGeometry(
      gantry.carriageHalfX * 2,
      gantry.carriageHalfY * 2,
      gantry.carriageHalfZ * 2,
    ),
    new THREE.MeshStandardMaterial({
      color: 0x9aa7b5,
      roughness: 0.3,
      metalness: 0.78,
    }),
  );
  carriageVisual.castShadow = true;
  scene.add(carriageVisual);

  const carriageBody = physics.createKinematicCuboid(
    { x: 0, y: gantry.carriageY, z: 0 },
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
    roughness: 0.2,
    metalness: 0.88,
  });
  const brushedMetal = new THREE.MeshStandardMaterial({
    color: 0x8d98a5,
    roughness: 0.32,
    metalness: 0.78,
  });
  const darkBand = new THREE.MeshStandardMaterial({
    color: 0x252a31,
    roughness: 0.38,
    metalness: 0.48,
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
      roughness: 0.48,
      metalness: 0.72,
    }),
  );
  cable.castShadow = true;
  scene.add(cable);

  const anchorY = gantry.carriageY - gantry.carriageHalfY;
  const initialHubY = anchorY - gantry.suspensionLength;
  const reelAnchorBody = physics.createKinematicBody({
    x: 0,
    y: anchorY,
    z: 0,
  });
  const hubBody = physics.createDynamicCylinder(
    { x: 0, y: initialHubY, z: 0 },
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
      x: pivotLocal.x,
      y: initialHubY + pivotLocal.y,
      z: pivotLocal.z,
    };
    const tangent = {
      x: -Math.sin(theta),
      y: 0,
      z: Math.cos(theta),
    };
    const points = createFingerPoints(theta);
    const visual = createFingerVisual(points, chrome, tipMaterial);
    scene.add(visual);

    const body = physics.createDynamicCapsuleChain(
      pivotWorld,
      createFingerSegments(points),
      {
        friction: claw.fingerFriction,
        restitution: claw.fingerRestitution,
        density: claw.fingerDensity,
      },
    );
    const joint = physics.createRevoluteJoint(hubBody, body, {
      anchor1: pivotLocal,
      anchor2: { x: 0, y: 0, z: 0 },
      axis: tangent,
      minAngle: claw.closedAngle,
      maxAngle: claw.openAngle,
      initialTarget: claw.openAngle,
      stiffness: claw.motorStiffness,
      damping: claw.motorDamping,
      maxTorque: claw.maxMotorTorque,
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
  const playConfig = {
    autoClosePayoutMeters: M04_PLAY_CONFIG.autoClosePayoutMeters,
    closedAngleRadians: claw.closedAngle,
    closeCompletionToleranceRadians:
      M04_PLAY_CONFIG.closeCompletionToleranceRadians,
  };

  let motion: GantryMotionState = {
    x: { position: 0, velocity: 0 },
    z: { position: 0, velocity: 0 },
  };
  let reel: ReelState = { payout: 0, velocity: 0 };
  let manualReelCommand = 0;
  let homeReturnPhase: HomeReturnPhase = "READY";
  let playCycle = createM04PlayState();
  let fingerCommand = 0;

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
  const cableUp = new THREE.Vector3(0, 1, 0);
  const cableTop = new THREE.Vector3();
  const cableBottom = new THREE.Vector3();
  const cableDirection = new THREE.Vector3();
  const cableMidpoint = new THREE.Vector3();

  const manualInput = (): { x: number; z: number } => ({
    x: (pressed.has("ArrowRight") ? 1 : 0) -
      (pressed.has("ArrowLeft") ? 1 : 0),
    z: (pressed.has("ArrowDown") ? 1 : 0) -
      (pressed.has("ArrowUp") ? 1 : 0),
  });

  const updateCableVisual = (): void => {
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
  };

  const startHomeReturn = (): void => {
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
    if (
      event.code === "Space" &&
      pt006Phase !== "ACCELERATING" &&
      pt006Phase !== "BRAKING" &&
      pt008Phase !== "ACCELERATING" &&
      pt008Phase !== "BRAKING" &&
      pt008Phase !== "DROPPING" &&
      homeReturnPhase !== "RETURNING_HOME"
    ) {
      event.preventDefault();
      manualReelCommand = 0;
      homeReturnPhase = "READY";
      playCycle = applyM04Action(playCycle, reel.payout);
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
    milestone: "M04 / DROP + EARLY/AUTO CLOSE",
    camera: {
      position: [0.78, 0.82, 1.08],
      target: [0, 0.72, 0],
    },
    beforePhysicsStep(stepSeconds: number): void {
      const hubPosition = hubBody.translation();
      const relativeX = hubPosition.x - motion.x.position;
      const swingAngle = computeSwingAngle(
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
      playCycle = advanceM04PlayState(
        playCycle,
        {
          reelPayoutMeters: reel.payout,
          fingerCommandRadians: fingerCommand,
        },
        playConfig,
      );

      const reelAtTop =
        reel.payout <= gantry.reelMinPayout + 1e-5 &&
        Math.abs(reel.velocity) < 1e-4;
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
      const fingerTarget = closingFinger
        ? claw.closedAngle
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
        },
        playConfig,
      );
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
            ? claw.maxMotorTorque
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
        "Spring k / c     " +
          gantry.suspensionSpringStiffness.toFixed(1) +
          " / " +
          gantry.suspensionSpringDamping.toFixed(1),
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
            ? claw.maxMotorTorque
            : M02_FINGER_TRANSPORT_CONFIG.maxTorque
          ).toFixed(1),
        "Controls         Arrows aim | Space DROP / EARLY CLOSE | H HOME",
        "Auto close       " +
          M04_PLAY_CONFIG.autoClosePayoutMeters.toFixed(3) +
          " m travel",
        "Tests            P PT-006 | T PT-008 | M COM | D colliders",
      ];
    },
  };
}
