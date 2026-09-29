import * as THREE from "three";
import type {
  PhysicsRuntime,
  RevoluteJointHandle,
  RigidBodyHandle,
  Vec3,
} from "../physics/PhysicsRuntime";
import type { SimulationScene } from "./types";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
  computeFingerPathLength,
  computeFingerTipSpan,
  createFingerPoints,
  createFingerSegments,
  evaluatePt005BlockedFinger,
  quaternionAngularDistance,
} from "./clawLab";

type LabPhase = "READY" | "CLOSING" | "COMPLETE";

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
  parent.add(marker);

  const halfLength = 0.032;
  const axisLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
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
    ]),
    new THREE.LineBasicMaterial({ color: 0xffd166, depthTest: false }),
  );
  axisLine.renderOrder = 1001;
  parent.add(axisLine);
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
    rod.quaternion.setFromUnitVectors(yAxis, direction.normalize());
    rod.castShadow = true;
    rod.receiveShadow = true;
    group.add(rod);
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

export function createPt005Scene(
  scene: THREE.Scene,
  physics: PhysicsRuntime,
): SimulationScene {
  const config = CLAW_LAB_CONFIG;
  const bindings: SimulationScene["bindings"] = [];
  const fingerBodies: RigidBodyHandle[] = [];
  const joints: RevoluteJointHandle[] = [];

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(
      config.floorHalfSize * 2,
      0.04,
      config.floorHalfSize * 2,
    ),
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
    const fingerVisual = createFingerVisual(points, chrome, tipMaterial);
    scene.add(fingerVisual);

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
    bindings.push({ mesh: fingerVisual, body: fingerBody });
    addJointDiagnostic(hubVisual, pivotLocal, tangent);
  }

  const blocker = new THREE.Mesh(
    new THREE.BoxGeometry(
      config.pt005BlockerHalfX * 2,
      config.pt005BlockerHalfY * 2,
      config.pt005BlockerHalfZ * 2,
    ),
    new THREE.MeshStandardMaterial({
      color: 0xd86a43,
      roughness: 0.58,
      metalness: 0.05,
    }),
  );
  blocker.position.set(
    config.pt005BlockerCenterX,
    config.pt005BlockerCenterY,
    config.pt005BlockerCenterZ,
  );
  blocker.castShadow = true;
  blocker.receiveShadow = true;
  scene.add(blocker);
  physics.createStaticCuboid(
    {
      x: config.pt005BlockerCenterX,
      y: config.pt005BlockerCenterY,
      z: config.pt005BlockerCenterZ,
    },
    {
      x: config.pt005BlockerHalfX,
      y: config.pt005BlockerHalfY,
      z: config.pt005BlockerHalfZ,
    },
    0.85,
  );

  let commandedAngle = 0;
  let labPhase: LabPhase = "READY";
  let phaseSeconds = 0;
  let result = "NOT RUN";
  let openRotations = fingerBodies.map((body) => body.rotation());
  let travels = [0, 0, 0];

  const drive = (targetAngle: number): void => {
    commandedAngle = advanceMotorCommand(
      commandedAngle,
      targetAngle,
      config.motorSpeedRadiansPerSecond,
      1 / 120,
    );

    for (const joint of joints) {
      joint.configureMotorPosition(
        commandedAngle,
        config.motorStiffness,
        config.motorDamping,
      );
      joint.setMotorMaxForce(config.maxMotorTorque);
    }

    for (const body of fingerBodies) {
      body.wakeUp();
    }
  };

  const startExperiment = (): void => {
    if (labPhase !== "READY") {
      return;
    }

    openRotations = fingerBodies.map((body) => body.rotation());
    travels = [0, 0, 0];
    phaseSeconds = 0;
    result = "RUNNING";
    labPhase = "CLOSING";
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    if (event.code === "KeyP") {
      startExperiment();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  return {
    bindings,
    milestone: "M01 / PT005",
    camera: {
      position: [0.62, 0.73, 0.86],
      target: [0.06, 0.63, 0],
    },
    beforePhysicsStep(stepSeconds: number): void {
      if (labPhase === "READY") {
        commandedAngle = advanceMotorCommand(
          commandedAngle,
          config.openAngle,
          config.motorSpeedRadiansPerSecond,
          stepSeconds,
        );
      } else {
        commandedAngle = advanceMotorCommand(
          commandedAngle,
          config.closedAngle,
          config.motorSpeedRadiansPerSecond,
          stepSeconds,
        );
        phaseSeconds += stepSeconds;
      }

      for (const joint of joints) {
        joint.configureMotorPosition(
          commandedAngle,
          config.motorStiffness,
          config.motorDamping,
        );
        joint.setMotorMaxForce(config.maxMotorTorque);
      }

      for (const body of fingerBodies) {
        body.wakeUp();
      }

      travels = fingerBodies.map((body, index) =>
        quaternionAngularDistance(openRotations[index]!, body.rotation()),
      );

      if (labPhase === "CLOSING" && phaseSeconds >= 1.2) {
        labPhase = "COMPLETE";
        result = evaluatePt005BlockedFinger(travels, 0)
          ? "PASS"
          : "FAIL";
      }
    },
    debugLines(): string[] {
      return [
        "Claw target      " +
          (labPhase === "READY" ? "OPEN" : "CLOSED"),
        "Motor command    " + commandedAngle.toFixed(3) + " rad",
        "Tip span command " +
          computeFingerTipSpan(commandedAngle).toFixed(3) +
          " m",
        "Finger path      " +
          computeFingerPathLength().toFixed(3) +
          " m",
        "Experiment       PT005",
        "Experiment phase " + labPhase,
        "Experiment result " + result,
        "Blocked finger   0 (+X side)",
        "Finger travel 0  " + travels[0]!.toFixed(3) + " rad",
        "Finger travel 1  " + travels[1]!.toFixed(3) + " rad",
        "Finger travel 2  " + travels[2]!.toFixed(3) + " rad",
        "Free min travel  " +
          config.pt005MinFreeTravelRadians.toFixed(3) +
          " rad",
        "Blocked max      " +
          config.pt005MaxBlockedTravelRadians.toFixed(3) +
          " rad",
        "Min separation   " +
          config.pt005MinTravelSeparationRadians.toFixed(3) +
          " rad",
        "Blocker          static rigid cuboid",
        "Controls         P run PT-005 | D collider debug",
        "Attachment       NONE",
      ];
    },
  };
}
