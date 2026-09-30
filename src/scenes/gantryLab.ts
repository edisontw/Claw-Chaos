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
  type GantryMotionConfig,
  type GantryMotionState,
} from "./gantryMotion";
import { computeSuspensionStabilizerImpulse } from "./suspensionStabilizer";
import type { SimulationScene } from "./types";

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
  suspensionSpringStiffness: 55,
  suspensionSpringDamping: 8.5,
  suspensionSpringMaxForce: 4.0,
  hubMassKg: 0.32,
  pt006AccelerationSeconds: 0.80,
  pt006BrakeObservationSeconds: 1.60,
  pt006MinLagMeters: 0.003,
  pt006MaxLagMeters: 0.025,
  pt006MinForwardSwingMeters: 0.004,
  pt006MaxForwardSwingMeters: 0.035,
  pt006MinSwingAngleRadians: 0.015,
  pt006MaxSwingAngleRadians: 0.12,
  pt006MaxResidualOffsetMeters: 0.008,
} as const;

export type Pt006Phase =
  | "READY"
  | "ACCELERATING"
  | "BRAKING"
  | "COMPLETE";

export interface Pt006Metrics {
  lagMeters: number;
  forwardSwingMeters: number;
  peakSwingAngleRadians: number;
  residualOffsetMeters: number;
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

  const cableStartY = claw.hubColliderHalfHeight;
  const cableLength = gantry.suspensionLength - cableStartY;
  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0022, 0.0022, cableLength, 10),
    new THREE.MeshStandardMaterial({
      color: 0x30353c,
      roughness: 0.48,
      metalness: 0.72,
    }),
  );
  cable.position.y = cableStartY + cableLength * 0.5;
  cable.castShadow = true;
  hubVisual.add(cable);
  scene.add(hubVisual);

  const anchorY = gantry.carriageY - gantry.carriageHalfY;
  const initialHubY = anchorY - gantry.suspensionLength;
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
    carriageBody,
    hubBody,
    { x: 0, y: -gantry.carriageHalfY, z: 0 },
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

  let motion: GantryMotionState = {
    x: { position: 0, velocity: 0 },
    z: { position: 0, velocity: 0 },
  };
  let fingerCommand = 0;
  let phase: Pt006Phase = "READY";
  let phaseSeconds = 0;
  let result = "NOT RUN";
  let minimumRelativeX = 0;
  let maximumRelativeX = 0;
  let peakSwingAngle = 0;
  const pressed = new Set<string>();

  const manualInput = (): { x: number; z: number } => ({
    x: (pressed.has("ArrowRight") ? 1 : 0) -
      (pressed.has("ArrowLeft") ? 1 : 0),
    z: (pressed.has("ArrowDown") ? 1 : 0) -
      (pressed.has("ArrowUp") ? 1 : 0),
  });

  const startPt006 = (): void => {
    if (phase !== "READY") {
      return;
    }
    phase = "ACCELERATING";
    phaseSeconds = 0;
    result = "RUNNING";
    minimumRelativeX = 0;
    maximumRelativeX = 0;
    peakSwingAngle = 0;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }
    if (event.code === "KeyP") {
      startPt006();
      return;
    }
    pressed.add(event.code);
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    pressed.delete(event.code);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    bindings,
    massPropertiesDebugTargets: [{ body: hubBody, label: "suspended-claw-hub" }],
    milestone: "M02 / PT006",
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

      if (phase === "ACCELERATING") {
        minimumRelativeX = Math.min(minimumRelativeX, relativeX);
      } else if (phase === "BRAKING") {
        maximumRelativeX = Math.max(maximumRelativeX, relativeX);
        peakSwingAngle = Math.max(peakSwingAngle, swingAngle);
      }

      let inputX = 0;
      let inputZ = 0;

      if (phase === "ACCELERATING") {
        inputX = 1;
        phaseSeconds += stepSeconds;
        if (phaseSeconds >= gantry.pt006AccelerationSeconds) {
          phase = "BRAKING";
          phaseSeconds = 0;
        }
      } else if (phase === "BRAKING") {
        phaseSeconds += stepSeconds;
        if (phaseSeconds >= gantry.pt006BrakeObservationSeconds) {
          phase = "COMPLETE";
          const currentHub = hubBody.translation();
          result = evaluatePt006Swing({
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
      } else {
        const input = manualInput();
        inputX = input.x;
        inputZ = input.z;
      }

      motion = advanceGantryMotion(
        motion,
        inputX,
        inputZ,
        motionConfig,
        stepSeconds,
      );

      carriageBody.setNextKinematicTranslation({
        x: motion.x.position,
        y: gantry.carriageY,
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

      fingerCommand = advanceMotorCommand(
        fingerCommand,
        claw.openAngle,
        claw.motorSpeedRadiansPerSecond,
        stepSeconds,
      );
      for (const joint of fingerJoints) {
        joint.configureMotorPosition(
          fingerCommand,
          claw.motorStiffness,
          claw.motorDamping,
        );
        joint.setMotorMaxForce(claw.maxMotorTorque);
      }
      for (const body of fingerBodies) {
        body.wakeUp();
      }
      hubBody.wakeUp();
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
        "Suspension       stiff damped " +
          gantry.suspensionLength.toFixed(3) +
          " m",
        "PT-006 phase     " + phase,
        "PT-006 result    " + result,
        "Lag / forward    " +
          Math.abs(Math.min(0, minimumRelativeX)).toFixed(3) +
          " / " +
          Math.max(0, maximumRelativeX).toFixed(3) +
          " m",
        "Peak swing       " + peakSwingAngle.toFixed(3) + " rad",
        "Spring k / c      " +
          gantry.suspensionSpringStiffness.toFixed(1) +
          " / " +
          gantry.suspensionSpringDamping.toFixed(1),
        "Controls         Arrow keys gantry | P PT-006 | M COM | D collider",
        "Reel             fixed-length in this slice; variable reel is next",
      ];
    },
  };
}
