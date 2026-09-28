import * as THREE from "three";
import type {
  CapsuleSegmentSpec,
  PhysicsRuntime,
  RevoluteJointHandle,
  RigidBodyHandle,
  Vec3,
} from "../physics/PhysicsRuntime";
import type { SimulationScene } from "./types";

export const CLAW_LAB_CONFIG = {
  floorHalfSize: 1,
  hubCenterY: 0.84,
  housingRadius: 0.045,
  housingHeight: 0.145,
  hubColliderHalfHeight: 0.082,
  collarRadius: 0.055,
  collarHeight: 0.018,
  fingerPivotY: 0.755,
  fingerPivotRadius: 0.05,
  fingerRodRadius: 0.0045,
  fingerTipVisualRadius: 0.006,
  fingerNodes: [
    { radial: 0, down: 0 },
    { radial: 0.03, down: 0.07 },
    { radial: 0.075, down: 0.165 },
    { radial: 0.05, down: 0.225 },
  ],
  fingerDensity: 3200,
  fingerFriction: 0.6,
  fingerRestitution: 0.02,
  openAngle: 0.22,
  closedAngle: -0.42,
  motorSpeedRadiansPerSecond: 1.6,
  motorStiffness: 180,
  motorDamping: 18,
  maxMotorTorque: 2.5,

  pt001BallRadius: 0.055,
  pt001BallMassKg: 0.08,
  pt001BallFriction: 0.9,
  pt001BallRestitution: 0.03,
  pt001BallCenterY: 0.581,
  pt001PedestalTopY: 0.525,
  pt001PedestalRadius: 0.04,
  pt001LiftDistance: 0.18,
  pt001LiftSpeedMetersPerSecond: 0.12,
  pt001CloseSettleSeconds: 0.9,
  pt001PassLiftDelta: 0.08,
} as const;

type ClawTargetState = "OPEN" | "CLOSED";
type Pt001Phase = "READY" | "CLOSING" | "LIFTING" | "HOLDING" | "COMPLETE";

export function advanceMotorCommand(
  current: number,
  target: number,
  speedRadiansPerSecond: number,
  stepSeconds: number,
): number {
  const maxDelta = Math.max(0, speedRadiansPerSecond * stepSeconds);
  const delta = target - current;

  if (Math.abs(delta) <= maxDelta) {
    return target;
  }

  return current + Math.sign(delta) * maxDelta;
}

export function advanceLinearCommand(
  current: number,
  target: number,
  speedMetersPerSecond: number,
  stepSeconds: number,
): number {
  const maxDelta = Math.max(0, speedMetersPerSecond * stepSeconds);
  const delta = target - current;

  if (Math.abs(delta) <= maxDelta) {
    return target;
  }

  return current + Math.sign(delta) * maxDelta;
}

export function computeFingerPathLength(): number {
  let length = 0;

  for (let index = 1; index < CLAW_LAB_CONFIG.fingerNodes.length; index += 1) {
    const previous = CLAW_LAB_CONFIG.fingerNodes[index - 1]!;
    const current = CLAW_LAB_CONFIG.fingerNodes[index]!;
    length += Math.hypot(
      current.radial - previous.radial,
      current.down - previous.down,
    );
  }

  return length;
}

export function computeFingerTipSpan(angleRadians: number): number {
  const tip =
    CLAW_LAB_CONFIG.fingerNodes[CLAW_LAB_CONFIG.fingerNodes.length - 1]!;
  const rotatedRadial =
    tip.radial * Math.cos(angleRadians) +
    tip.down * Math.sin(angleRadians);
  return Math.max(
    0,
    2 * (CLAW_LAB_CONFIG.fingerPivotRadius + rotatedRadial),
  );
}

function addJointDiagnostic(
  parent: THREE.Object3D,
  pivot: Vec3,
  axis: Vec3,
): void {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  marker.position.set(pivot.x, pivot.y, pivot.z);
  marker.renderOrder = 1001;
  parent.add(marker);

  const halfLength = 0.032;
  const points = [
    new THREE.Vector3(
      pivot.x - axis.x * halfLength,
      pivot.y - axis.y * halfLength,
      pivot.z - axis.z * halfLength,
    ),
    new THREE.Vector3(
      pivot.x + axis.x * halfLength,
      pivot.y + axis.y * halfLength,
      pivot.z + axis.z * halfLength,
    ),
  ];
  const axisLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0xffd166, depthTest: false }),
  );
  axisLine.renderOrder = 1001;
  parent.add(axisLine);
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

export function createFingerPoints(theta: number): Vec3[] {
  const radialX = Math.cos(theta);
  const radialZ = Math.sin(theta);

  return CLAW_LAB_CONFIG.fingerNodes.map((node) => ({
    x: radialX * node.radial,
    y: -node.down,
    z: radialZ * node.radial,
  }));
}

function createFingerVisual(
  points: readonly Vec3[],
  metalMaterial: THREE.Material,
  tipMaterial: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  const yAxis = new THREE.Vector3(0, 1, 0);

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const startVector = new THREE.Vector3(start.x, start.y, start.z);
    const endVector = new THREE.Vector3(end.x, end.y, end.z);
    const direction = endVector.clone().sub(startVector);
    const length = direction.length();

    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(
        CLAW_LAB_CONFIG.fingerRodRadius,
        CLAW_LAB_CONFIG.fingerRodRadius,
        length,
        12,
      ),
      metalMaterial,
    );
    rod.position.copy(startVector).add(endVector).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(yAxis, direction.clone().normalize());
    rod.castShadow = true;
    rod.receiveShadow = true;
    group.add(rod);

    if (index < points.length - 1) {
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(CLAW_LAB_CONFIG.fingerRodRadius, 12, 8),
        metalMaterial,
      );
      node.position.copy(endVector);
      node.castShadow = true;
      group.add(node);
    }
  }

  const tip = points[points.length - 1]!;
  const tipCap = new THREE.Mesh(
    new THREE.SphereGeometry(CLAW_LAB_CONFIG.fingerTipVisualRadius, 14, 10),
    tipMaterial,
  );
  tipCap.position.set(tip.x, tip.y, tip.z);
  tipCap.castShadow = true;
  group.add(tipCap);

  return group;
}

export function createFingerSegments(
  points: readonly Vec3[],
): CapsuleSegmentSpec[] {
  const segments: CapsuleSegmentSpec[] = [];

  for (let index = 1; index < points.length; index += 1) {
    segments.push({
      start: points[index - 1]!,
      end: points[index]!,
      radius: CLAW_LAB_CONFIG.fingerRodRadius,
    });
  }

  return segments;
}

export function createClawLabScene(
  scene: THREE.Scene,
  physics: PhysicsRuntime,
): SimulationScene {
  const config = CLAW_LAB_CONFIG;
  const bindings: SimulationScene["bindings"] = [];
  const fingerBodies: RigidBodyHandle[] = [];
  const joints: RevoluteJointHandle[] = [];

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(config.floorHalfSize * 2, 0.04, config.floorHalfSize * 2),
    new THREE.MeshStandardMaterial({
      color: 0x69717c,
      roughness: 0.94,
      metalness: 0.02,
    }),
  );
  floor.position.set(0, -0.02, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  physics.createStaticCuboid(
    { x: 0, y: -0.02, z: 0 },
    { x: config.floorHalfSize, y: 0.02, z: config.floorHalfSize },
  );

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
  scene.add(hubVisual);
  addCylinder(hubVisual, 0.017, 0.045, 0.095, darkBand);
  addCylinder(hubVisual, 0.034, 0.055, 0.045, chrome);
  addCylinder(hubVisual, config.housingRadius, 0.075, -0.022, brushedMetal);
  addCylinder(hubVisual, 0.048, 0.018, 0.005, darkBand);
  addCylinder(
    hubVisual,
    config.collarRadius,
    config.collarHeight,
    config.fingerPivotY +
      config.collarHeight * 0.45 -
      config.hubCenterY,
    chrome,
  );

  const hubBody = physics.createKinematicCylinder(
    { x: 0, y: config.hubCenterY, z: 0 },
    config.hubColliderHalfHeight,
    config.collarRadius,
    0.55,
  );
  bindings.push({ mesh: hubVisual, body: hubBody });

  for (let index = 0; index < 3; index += 1) {
    const theta = index * (Math.PI * 2 / 3);
    const radialX = Math.cos(theta);
    const radialZ = Math.sin(theta);
    const pivotLocal = {
      x: radialX * config.fingerPivotRadius,
      y: config.fingerPivotY - config.hubCenterY,
      z: radialZ * config.fingerPivotRadius,
    };
    const pivotWorld = {
      x: pivotLocal.x,
      y: config.hubCenterY + pivotLocal.y,
      z: pivotLocal.z,
    };
    const tangent = {
      x: -Math.sin(theta),
      y: 0,
      z: Math.cos(theta),
    };
    const points = createFingerPoints(theta);
    const finger = createFingerVisual(points, chrome, tipMaterial);
    scene.add(finger);

    const fingerBody = physics.createDynamicCapsuleChain(
      pivotWorld,
      createFingerSegments(points),
      {
        friction: config.fingerFriction,
        restitution: config.fingerRestitution,
        density: config.fingerDensity,
      },
    );

    const joint = physics.createRevoluteJoint(hubBody, fingerBody, {
      anchor1: pivotLocal,
      anchor2: { x: 0, y: 0, z: 0 },
      axis: tangent,
      minAngle: config.closedAngle,
      maxAngle: config.openAngle,
      initialTarget: 0,
      stiffness: config.motorStiffness,
      damping: config.motorDamping,
      maxTorque: config.maxMotorTorque,
      contactsEnabled: false,
    });

    fingerBodies.push(fingerBody);
    joints.push(joint);
    bindings.push({ mesh: finger, body: fingerBody });
    addJointDiagnostic(hubVisual, pivotLocal, tangent);
  }

  const pedestalHalfHeight = config.pt001PedestalTopY * 0.5;
  const pedestalMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b4654,
    roughness: 0.72,
    metalness: 0.28,
  });
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(
      config.pt001PedestalRadius,
      config.pt001PedestalRadius,
      config.pt001PedestalTopY,
      24,
    ),
    pedestalMaterial,
  );
  pedestal.position.y = pedestalHalfHeight;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  scene.add(pedestal);
  physics.createStaticCylinder(
    { x: 0, y: pedestalHalfHeight, z: 0 },
    pedestalHalfHeight,
    config.pt001PedestalRadius,
    0.75,
  );

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(config.pt001BallRadius, 32, 20),
    new THREE.MeshStandardMaterial({
      color: 0xf0b84f,
      roughness: 0.48,
      metalness: 0.04,
    }),
  );
  ball.castShadow = true;
  ball.receiveShadow = true;
  scene.add(ball);

  const ballBody = physics.createDynamicSphere(
    { x: 0, y: config.pt001BallCenterY, z: 0 },
    config.pt001BallRadius,
    config.pt001BallMassKg,
    {
      friction: config.pt001BallFriction,
      restitution: config.pt001BallRestitution,
    },
  );
  bindings.push({ mesh: ball, body: ballBody });

  let targetState: ClawTargetState = "OPEN";
  let commandedAngle = 0;
  let hubCommandY: number = config.hubCenterY;
  let pt001Phase: Pt001Phase = "READY";
  let pt001PhaseSeconds = 0;
  let ballReferenceY: number = config.pt001BallCenterY;
  let pt001Result = "NOT RUN";

  const wakeFingers = (): void => {
    for (const body of fingerBodies) {
      body.wakeUp();
    }
  };

  const setTargetState = (nextState: ClawTargetState): void => {
    targetState = nextState;
    wakeFingers();
  };

  const startPt001 = (): void => {
    if (pt001Phase !== "READY") {
      return;
    }

    ballReferenceY = ballBody.translation().y;
    pt001Phase = "CLOSING";
    pt001PhaseSeconds = 0;
    pt001Result = "RUNNING";
    setTargetState("CLOSED");
    ballBody.wakeUp();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    if (event.code === "KeyC") {
      setTargetState("CLOSED");
    } else if (event.code === "KeyO") {
      setTargetState("OPEN");
    } else if (event.code === "Space") {
      event.preventDefault();
      setTargetState(targetState === "OPEN" ? "CLOSED" : "OPEN");
    } else if (event.code === "KeyP") {
      startPt001();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  return {
    bindings,
    milestone: "M01 / PT-001",
    camera: {
      position: [0.62, 0.72, 0.88],
      target: [0, 0.64, 0],
    },
    beforePhysicsStep(stepSeconds: number): void {
      const targetAngle =
        targetState === "OPEN" ? config.openAngle : config.closedAngle;
      commandedAngle = advanceMotorCommand(
        commandedAngle,
        targetAngle,
        config.motorSpeedRadiansPerSecond,
        stepSeconds,
      );

      for (const joint of joints) {
        joint.configureMotorPosition(
          commandedAngle,
          config.motorStiffness,
          config.motorDamping,
        );
        joint.setMotorMaxForce(config.maxMotorTorque);
      }

      if (pt001Phase === "CLOSING") {
        pt001PhaseSeconds += stepSeconds;
        if (pt001PhaseSeconds >= config.pt001CloseSettleSeconds) {
          pt001Phase = "LIFTING";
          pt001PhaseSeconds = 0;
        }
      } else if (pt001Phase === "LIFTING") {
        const targetHubY = config.hubCenterY + config.pt001LiftDistance;
        hubCommandY = advanceLinearCommand(
          hubCommandY,
          targetHubY,
          config.pt001LiftSpeedMetersPerSecond,
          stepSeconds,
        );

        if (hubCommandY >= targetHubY - 1e-6) {
          hubCommandY = targetHubY;
          pt001Phase = "HOLDING";
          pt001PhaseSeconds = 0;
        }
      } else if (pt001Phase === "HOLDING") {
        pt001PhaseSeconds += stepSeconds;
        if (pt001PhaseSeconds >= 0.5) {
          pt001Phase = "COMPLETE";
          const ballLift = ballBody.translation().y - ballReferenceY;
          pt001Result =
            ballLift >= config.pt001PassLiftDelta ? "PASS" : "FAIL";
        }
      }

      if (pt001Phase === "LIFTING" || pt001Phase === "HOLDING") {
        wakeFingers();
        ballBody.wakeUp();
      }

      hubBody.setNextKinematicTranslation({
        x: 0,
        y: hubCommandY,
        z: 0,
      });
    },
    debugLines(): string[] {
      const ballY = ballBody.translation().y;
      const ballLift = ballY - ballReferenceY;
      return [
        "Claw target      " + targetState,
        "Motor command    " + commandedAngle.toFixed(3) + " rad",
        "Tip span command " + computeFingerTipSpan(commandedAngle).toFixed(3) + " m",
        "Open / closed    " +
          config.openAngle.toFixed(2) +
          " / " +
          config.closedAngle.toFixed(2) +
          " rad",
        "Finger path      " + computeFingerPathLength().toFixed(3) + " m",
        "Collider model   3 capsule segments / finger",
        "PT-001 phase     " + pt001Phase,
        "PT-001 result    " + pt001Result,
        "Ball             r=" +
          config.pt001BallRadius.toFixed(3) +
          " m  m=" +
          config.pt001BallMassKg.toFixed(3) +
          " kg  μ=" +
          config.pt001BallFriction.toFixed(2),
        "Ball Y / lift    " +
          ballY.toFixed(3) +
          " / " +
          ballLift.toFixed(3) +
          " m",
        "Lab lift         " +
          (hubCommandY - config.hubCenterY).toFixed(3) +
          " / " +
          config.pt001LiftDistance.toFixed(3) +
          " m",
        "Motor speed      " +
          config.motorSpeedRadiansPerSecond.toFixed(2) +
          " rad/s",
        "Max torque       " + config.maxMotorTorque.toFixed(2) + " N·m",
        "Controls         P run PT-001 | C close | O open | Space toggle | D debug",
        "Attachment       NONE — sphere has no parent/weld/joint to claw",
      ];
    },
  };
}
