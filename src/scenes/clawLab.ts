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
  openAngle: 0.35,
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

  pt002PickupLiftDistance: 0.06,
  pt002RetainingTorque: 0.003,
  pt002MinPeakLift: 0.03,
  pt002MinSlipLoss: 0.04,
  pt002MaxFinalLift: 0.03,

  pt003BoxSizeX: 0.13,
  pt003BoxSizeY: 0.08,
  pt003BoxSizeZ: 0.07,
  pt003BoxMassKg: 0.12,
  pt003BoxFriction: 0.65,
  pt003BoxRestitution: 0.02,
  pt003BoxCenterOffsetX: 0.04,
  pt003SupportHalfX: 0.015,
  pt003SupportHalfZ: 0.015,
  pt003MinRotationRadians: 0.10,
  pt003MaxPassiveRotationRadians: 0.03,

  pt004TeddyMassKg: 0.09,
  pt004TeddyFriction: 0.75,
  pt004TeddyRestitution: 0.02,
  pt004BodyOffsetX: -0.055,
  pt004SupportCenterY: 0.2625,
  pt004SupportHalfY: 0.2625,
  pt004SupportHalfX: 0.05,
  pt004SupportHalfZ: 0.15,
  pt004BodyCenterY: 0.56,
  pt004MinPeakLift: 0.035,
  pt004MinPeakRotationRadians: 0.20,
  pt004MinAsymmetryX: 0.025,
  pt004InitialRotationX: Math.PI / 2,
  pt004HookAngle: -0.40,
  pt004CloseLeadSeconds: 0.16,

  pt005BlockerCenterX: 0.070,
  pt005BlockerCenterY: 0.59,
  pt005BlockerCenterZ: 0,
  pt005BlockerHalfX: 0.015,
  pt005BlockerHalfY: 0.06,
  pt005BlockerHalfZ: 0.025,
  pt005MinFreeTravelRadians: 0.25,
  pt005MaxBlockedTravelRadians: 0.22,
  pt005MinTravelSeparationRadians: 0.06,

  oversizedBoxSizeX: 0.14,
  oversizedBoxSizeY: 0.08,
  oversizedBoxSizeZ: 0.14,
  oversizedBoxMassKg: 1.2,
  oversizedBoxFriction: 0.90,
  oversizedBoxRestitution: 0.01,
  oversizedPedestalTopY: 0.525,
  oversizedPedestalRadius: 0.025,
  oversizedMinControlTravelRadians: 0.20,
  oversizedMaxBlockedTravelRatio: 0.70,
  oversizedMinTravelLossRadians: 0.08,
  oversizedMaxTravelSpreadRadians: 0.06,
  oversizedMaxOpenPoseDifferenceRadians: 0.04,
  oversizedControlTravelReferenceRadians: 0.240,
} as const;

export type ClawLabExperiment =
  | "pt001"
  | "pt002"
  | "pt003"
  | "pt004"
  | "pt005"
  | "oversized";
type ClawTargetState = "OPEN" | "CLOSED";
type LabPhase = "READY" | "CLOSING" | "LIFTING" | "HOLDING" | "COMPLETE";

export function parseClawLabExperiment(search: string): ClawLabExperiment {
  const requested = new URLSearchParams(search).get("experiment");

  if (
    requested === "pt002" ||
    requested === "pt003" ||
    requested === "pt004" ||
    requested === "pt005" ||
    requested === "oversized"
  ) {
    return requested;
  }

  return "pt001";
}

export function evaluatePt002Slip(
  peakLift: number,
  finalLift: number,
): boolean {
  return (
    peakLift >= CLAW_LAB_CONFIG.pt002MinPeakLift &&
    peakLift - finalLift >= CLAW_LAB_CONFIG.pt002MinSlipLoss &&
    finalLift <= CLAW_LAB_CONFIG.pt002MaxFinalLift
  );
}

export function quaternionAngleFromIdentity(rotation: {
  x: number;
  y: number;
  z: number;
  w: number;
}): number {
  const normalizedW = Math.min(1, Math.max(-1, Math.abs(rotation.w)));
  return 2 * Math.acos(normalizedW);
}

export function evaluatePt003Rotation(peakRotationRadians: number): boolean {
  return peakRotationRadians >= CLAW_LAB_CONFIG.pt003MinRotationRadians;
}

export function quaternionAngularDistance(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
): number {
  const dot = Math.abs(
    a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w,
  );
  return 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
}

export function evaluatePt004Hook(
  peakLift: number,
  peakRotationRadians: number,
  horizontalOffsetFromClaw: number,
): boolean {
  return (
    peakLift >= CLAW_LAB_CONFIG.pt004MinPeakLift &&
    peakRotationRadians >= CLAW_LAB_CONFIG.pt004MinPeakRotationRadians &&
    Math.abs(horizontalOffsetFromClaw) >= CLAW_LAB_CONFIG.pt004MinAsymmetryX
  );
}

export function evaluatePt005BlockedFinger(
  fingerTravelRadians: readonly number[],
  blockedIndex = 0,
): boolean {
  if (fingerTravelRadians.length !== 3) {
    return false;
  }

  const blockedTravel = fingerTravelRadians[blockedIndex];
  if (blockedTravel === undefined) {
    return false;
  }

  const freeTravels = fingerTravelRadians.filter(
    (_, index) => index !== blockedIndex,
  );

  return (
    blockedTravel <= CLAW_LAB_CONFIG.pt005MaxBlockedTravelRadians &&
    freeTravels.every(
      (travel) => travel >= CLAW_LAB_CONFIG.pt005MinFreeTravelRadians,
    ) &&
    freeTravels.every(
      (travel) =>
        travel - blockedTravel >=
        CLAW_LAB_CONFIG.pt005MinTravelSeparationRadians,
    )
  );
}

export function evaluateOversizedClose(
  controlTravels: readonly number[],
  blockedTravels: readonly number[],
): boolean {
  if (controlTravels.length !== 3 || blockedTravels.length !== 3) {
    return false;
  }

  const controlMin = Math.min(...controlTravels);
  const blockedMax = Math.max(...blockedTravels);
  const blockedMin = Math.min(...blockedTravels);
  const controlAverage =
    controlTravels.reduce((sum, value) => sum + value, 0) / 3;
  const blockedAverage =
    blockedTravels.reduce((sum, value) => sum + value, 0) / 3;

  return (
    controlMin >= CLAW_LAB_CONFIG.oversizedMinControlTravelRadians &&
    blockedAverage <=
      controlAverage * CLAW_LAB_CONFIG.oversizedMaxBlockedTravelRatio &&
    controlAverage - blockedAverage >=
      CLAW_LAB_CONFIG.oversizedMinTravelLossRadians &&
    blockedMax - blockedMin <=
      CLAW_LAB_CONFIG.oversizedMaxTravelSpreadRadians
  );
}

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

export function createFingerPoints(
  theta: number,
  nodes: readonly { radial: number; down: number }[] =
    CLAW_LAB_CONFIG.fingerNodes,
): Vec3[] {
  const radialX = Math.cos(theta);
  const radialZ = Math.sin(theta);

  return nodes.map((node) => ({
    x: radialX * node.radial,
    y: -node.down,
    z: radialZ * node.radial,
  }));
}

export function createFingerVisual(
  points: readonly Vec3[],
  metalMaterial: THREE.Material,
  tipMaterial: THREE.Material,
  tipRadius: number = CLAW_LAB_CONFIG.fingerTipVisualRadius,
  lowerPadRadius: number = CLAW_LAB_CONFIG.fingerRodRadius,
  lowerPadLengthMeters?: number,
): THREE.Group {
  const group = new THREE.Group();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const shortPadMode = lowerPadLengthMeters !== undefined;

  const addRod = (
    startVector: THREE.Vector3,
    endVector: THREE.Vector3,
    radius: number,
  ): void => {
    const direction = endVector.clone().sub(startVector);
    const length = direction.length();
    if (length <= Number.EPSILON) {
      return;
    }

    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 12),
      metalMaterial,
    );
    rod.position.copy(startVector).add(endVector).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(
      yAxis,
      direction.clone().normalize(),
    );
    rod.castShadow = true;
    rod.receiveShadow = true;
    group.add(rod);
  };

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const startVector = new THREE.Vector3(start.x, start.y, start.z);
    const endVector = new THREE.Vector3(end.x, end.y, end.z);
    const isTerminalSegment = index === points.length - 1;

    if (isTerminalSegment && shortPadMode) {
      const direction = endVector.clone().sub(startVector);
      const length = direction.length();
      const padLength = Math.min(
        Math.max(0, lowerPadLengthMeters),
        length,
      );
      const stemLength = length - padLength;
      const padStart =
        length <= Number.EPSILON
          ? endVector.clone()
          : startVector
              .clone()
              .add(
                direction
                  .clone()
                  .multiplyScalar(stemLength / length),
              );

      addRod(
        startVector,
        padStart,
        CLAW_LAB_CONFIG.fingerRodRadius,
      );
      addRod(padStart, endVector, lowerPadRadius);
    } else {
      addRod(
        startVector,
        endVector,
        isTerminalSegment
          ? lowerPadRadius
          : CLAW_LAB_CONFIG.fingerRodRadius,
      );
    }

    if (index < points.length - 1) {
      const nodeRadius =
        index === points.length - 2 && !shortPadMode
          ? Math.max(
              CLAW_LAB_CONFIG.fingerRodRadius,
              lowerPadRadius,
            )
          : CLAW_LAB_CONFIG.fingerRodRadius;
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(nodeRadius, 12, 8),
        metalMaterial,
      );
      node.position.copy(endVector);
      node.castShadow = true;
      group.add(node);
    }
  }

  const tip = points[points.length - 1]!;
  const tipCap = new THREE.Mesh(
    new THREE.SphereGeometry(tipRadius, 14, 10),
    tipMaterial,
  );
  tipCap.position.set(tip.x, tip.y, tip.z);
  tipCap.castShadow = true;
  group.add(tipCap);

  return group;
}

export function createFingerSegments(
  points: readonly Vec3[],
  lowerPadRadius: number = CLAW_LAB_CONFIG.fingerRodRadius,
  lowerPadLengthMeters?: number,
  lowerPadFriction?: number,
): CapsuleSegmentSpec[] {
  const segments: CapsuleSegmentSpec[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const isTerminalSegment = index === points.length - 1;

    if (!isTerminalSegment || lowerPadLengthMeters === undefined) {
      segments.push({
        start,
        end,
        radius: isTerminalSegment
          ? lowerPadRadius
          : CLAW_LAB_CONFIG.fingerRodRadius,
      });
      continue;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dy, dz);
    const padLength = Math.min(
      Math.max(0, lowerPadLengthMeters),
      length,
    );
    const stemFraction =
      length <= Number.EPSILON
        ? 0
        : (length - padLength) / length;
    const padStart = {
      x: start.x + dx * stemFraction,
      y: start.y + dy * stemFraction,
      z: start.z + dz * stemFraction,
    };

    if (padLength < length - 1e-6) {
      segments.push({
        start,
        end: padStart,
        radius: CLAW_LAB_CONFIG.fingerRodRadius,
      });
    }
    if (padLength > 1e-6) {
      segments.push({
        start: padStart,
        end,
        radius: lowerPadRadius,
        friction: lowerPadFriction,
      });
    }
  }

  return segments;
}

export function createClawLabScene(
  scene: THREE.Scene,
  physics: PhysicsRuntime,
  search = "",
): SimulationScene {
  const config = CLAW_LAB_CONFIG;
  const experiment = parseClawLabExperiment(search);
  const activeFingerFriction = config.fingerFriction;
  const activeBallFriction = config.pt001BallFriction;
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
        friction: activeFingerFriction,
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
      friction: activeBallFriction,
      restitution: config.pt001BallRestitution,
    },
  );
  bindings.push({ mesh: ball, body: ballBody });

  let targetState: ClawTargetState = "OPEN";
  let commandedAngle = 0;
  let hubCommandY: number = config.hubCenterY;
  let labPhase: LabPhase = "READY";
  let labPhaseSeconds = 0;
  let ballReferenceY: number = config.pt001BallCenterY;
  let experimentResult = "NOT RUN";
  let peakBallLift = 0;

  const wakeFingers = (): void => {
    for (const body of fingerBodies) {
      body.wakeUp();
    }
  };

  const setTargetState = (nextState: ClawTargetState): void => {
    targetState = nextState;
    wakeFingers();
  };

  const startExperiment = (): void => {
    if (labPhase !== "READY") {
      return;
    }

    ballReferenceY = ballBody.translation().y;
    peakBallLift = 0;
    labPhase = "CLOSING";
    labPhaseSeconds = 0;
    experimentResult = "RUNNING";
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
      startExperiment();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  return {
    bindings,
    massPropertiesDebugTargets: [{ body: ballBody, label: "ball" }],
    milestone: "M01 / " + experiment.toUpperCase(),
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

      const liftAmount = hubCommandY - config.hubCenterY;
      const retainingPhaseActive =
        experiment === "pt002" &&
        (labPhase === "LIFTING" || labPhase === "HOLDING") &&
        liftAmount >= config.pt002PickupLiftDistance;
      const activeMotorTorque = retainingPhaseActive
        ? config.pt002RetainingTorque
        : config.maxMotorTorque;

      for (const joint of joints) {
        joint.configureMotorPosition(
          commandedAngle,
          config.motorStiffness,
          config.motorDamping,
        );
        joint.setMotorMaxForce(activeMotorTorque);
      }

      const observedLift = ballBody.translation().y - ballReferenceY;
      peakBallLift = Math.max(peakBallLift, observedLift);

      if (labPhase === "CLOSING") {
        labPhaseSeconds += stepSeconds;
        if (labPhaseSeconds >= config.pt001CloseSettleSeconds) {
          labPhase = "LIFTING";
          labPhaseSeconds = 0;
        }
      } else if (labPhase === "LIFTING") {
        const targetHubY = config.hubCenterY + config.pt001LiftDistance;
        hubCommandY = advanceLinearCommand(
          hubCommandY,
          targetHubY,
          config.pt001LiftSpeedMetersPerSecond,
          stepSeconds,
        );

        if (hubCommandY >= targetHubY - 1e-6) {
          hubCommandY = targetHubY;
          labPhase = "HOLDING";
          labPhaseSeconds = 0;
        }
      } else if (labPhase === "HOLDING") {
        labPhaseSeconds += stepSeconds;
        if (labPhaseSeconds >= 0.5) {
          labPhase = "COMPLETE";
          const ballLift = ballBody.translation().y - ballReferenceY;
          experimentResult =
            experiment === "pt001"
              ? ballLift >= config.pt001PassLiftDelta
                ? "PASS"
                : "FAIL"
              : evaluatePt002Slip(peakBallLift, ballLift)
                ? "PASS"
                : "FAIL";
        }
      }

      if (labPhase === "LIFTING" || labPhase === "HOLDING") {
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
        "Experiment       " + experiment.toUpperCase(),
        "Experiment phase " + labPhase,
        "Experiment result " + experimentResult,
        "Ball             r=" +
          config.pt001BallRadius.toFixed(3) +
          " m  m=" +
          config.pt001BallMassKg.toFixed(3) +
          " kg  μ=" +
          activeBallFriction.toFixed(2),
        "Ball Y / lift    " +
          ballY.toFixed(3) +
          " / " +
          ballLift.toFixed(3) +
          " m",
        "Peak / slip loss  " +
          peakBallLift.toFixed(3) +
          " / " +
          Math.max(0, peakBallLift - ballLift).toFixed(3) +
          " m",
        "Lab lift         " +
          (hubCommandY - config.hubCenterY).toFixed(3) +
          " / " +
          config.pt001LiftDistance.toFixed(3) +
          " m",
        "Force phase      " +
          (experiment === "pt002" &&
          (labPhase === "LIFTING" || labPhase === "HOLDING") &&
          hubCommandY - config.hubCenterY >= config.pt002PickupLiftDistance
            ? "RETAINING"
            : "PICKUP/CLOSE"),
        "Motor speed      " +
          config.motorSpeedRadiansPerSecond.toFixed(2) +
          " rad/s",
        "Active torque    " +
          (experiment === "pt002" &&
          (labPhase === "LIFTING" || labPhase === "HOLDING") &&
          hubCommandY - config.hubCenterY >= config.pt002PickupLiftDistance
            ? config.pt002RetainingTorque
            : config.maxMotorTorque
          ).toFixed(3) +
          " N·m",
        "Controls         P run active test | C close | O open | Space toggle | D collider | M COM/origin",
        "Attachment       NONE — sphere has no parent/weld/joint to claw",
      ];
    },
  };
}
