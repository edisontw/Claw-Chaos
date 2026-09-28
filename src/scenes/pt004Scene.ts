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
  advanceLinearCommand,
  advanceMotorCommand,
  computeFingerPathLength,
  computeFingerTipSpan,
  createFingerPoints,
  createFingerSegments,
  evaluatePt004Hook,
  quaternionAngleFromIdentity,
} from "./clawLab";
import {
  PT004_TEDDY_PARTS,
  createPt004TeddyColliders,
} from "./pt004Teddy";

type ClawTargetState = "OPEN" | "CLOSED";
type LabPhase = "READY" | "CLOSING" | "LIFTING" | "HOLDING" | "COMPLETE";

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

function addCapsuleVisual(
  parent: THREE.Object3D,
  start: Vec3,
  end: Vec3,
  radius: number,
  material: THREE.Material,
): void {
  const startVector = new THREE.Vector3(start.x, start.y, start.z);
  const endVector = new THREE.Vector3(end.x, end.y, end.z);
  const direction = endVector.clone().sub(startVector);
  const length = direction.length();
  const yAxis = new THREE.Vector3(0, 1, 0);

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 16),
    material,
  );
  rod.position.copy(startVector).add(endVector).multiplyScalar(0.5);
  rod.quaternion.setFromUnitVectors(yAxis, direction.normalize());
  rod.castShadow = true;
  rod.receiveShadow = true;
  parent.add(rod);

  for (const point of [startVector, endVector]) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 10),
      material,
    );
    cap.position.copy(point);
    cap.castShadow = true;
    cap.receiveShadow = true;
    parent.add(cap);
  }
}

function createTeddyVisual(): THREE.Group {
  const teddy = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({
    color: 0x9b6b45,
    roughness: 0.92,
    metalness: 0,
  });
  const limb = new THREE.MeshStandardMaterial({
    color: 0xb98055,
    roughness: 0.9,
    metalness: 0,
  });

  for (const part of PT004_TEDDY_PARTS) {
    const material =
      part.name === "head" || part.name === "torso" ? fur : limb;

    if (part.kind === "sphere") {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(part.radius, 24, 16),
        material,
      );
      mesh.position.set(
        part.center!.x,
        part.center!.y,
        part.center!.z,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      teddy.add(mesh);
    } else {
      addCapsuleVisual(
        teddy,
        part.start!,
        part.end!,
        part.radius,
        material,
      );
    }
  }

  const rightArmMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.006, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x56d6ff }),
  );
  rightArmMarker.position.set(0.095, -0.055, 0);
  teddy.add(rightArmMarker);

  const comMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.006, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  teddy.add(comMarker);

  return teddy;
}

export function createPt004Scene(
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
    config.fingerPivotY + config.collarHeight * 0.45 - config.hubCenterY,
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

  const support = new THREE.Mesh(
    new THREE.BoxGeometry(
      config.pt004SupportHalfX * 2,
      config.pt004SupportHalfY * 2,
      config.pt004SupportHalfZ * 2,
    ),
    new THREE.MeshStandardMaterial({
      color: 0x3b4654,
      roughness: 0.72,
      metalness: 0.28,
    }),
  );
  support.position.set(
    config.pt004BodyOffsetX,
    config.pt004SupportCenterY,
    0,
  );
  support.castShadow = true;
  support.receiveShadow = true;
  scene.add(support);
  physics.createStaticCuboid(
    {
      x: config.pt004BodyOffsetX,
      y: config.pt004SupportCenterY,
      z: 0,
    },
    {
      x: config.pt004SupportHalfX,
      y: config.pt004SupportHalfY,
      z: config.pt004SupportHalfZ,
    },
    0.9,
  );

  const teddyVisual = createTeddyVisual();
  scene.add(teddyVisual);
  const teddyBody = physics.createDynamicCompound(
    {
      x: config.pt004BodyOffsetX,
      y: config.pt004BodyCenterY,
      z: 0,
    },
    createPt004TeddyColliders(),
    config.pt004TeddyMassKg,
    {
      friction: config.pt004TeddyFriction,
      restitution: config.pt004TeddyRestitution,
    },
  );
  bindings.push({ mesh: teddyVisual, body: teddyBody });

  let targetState: ClawTargetState = "OPEN";
  let commandedAngle = 0;
  let hubCommandY: number = config.hubCenterY;
  let labPhase: LabPhase = "READY";
  let labPhaseSeconds = 0;
  let referenceY = config.pt004BodyCenterY;
  let peakLift = 0;
  let peakRotation = 0;
  let experimentResult = "NOT RUN";

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

    referenceY = teddyBody.translation().y;
    peakLift = 0;
    peakRotation = quaternionAngleFromIdentity(teddyBody.rotation());
    experimentResult = "RUNNING";
    labPhase = "CLOSING";
    labPhaseSeconds = 0;
    setTargetState("CLOSED");
    teddyBody.wakeUp();
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
    milestone: "M01 / PT004",
    camera: {
      position: [0.62, 0.72, 0.88],
      target: [-0.035, 0.65, 0],
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
        if (labPhaseSeconds >= 0.75) {
          labPhase = "COMPLETE";
          experimentResult = evaluatePt004Hook(
            peakLift,
            peakRotation,
            teddyBody.translation().x,
          )
            ? "PASS"
            : "FAIL";
        }
      }

      if (labPhase === "LIFTING" || labPhase === "HOLDING") {
        wakeFingers();
        teddyBody.wakeUp();
      }

      peakLift = Math.max(
        peakLift,
        teddyBody.translation().y - referenceY,
      );
      peakRotation = Math.max(
        peakRotation,
        quaternionAngleFromIdentity(teddyBody.rotation()),
      );

      hubBody.setNextKinematicTranslation({
        x: 0,
        y: hubCommandY,
        z: 0,
      });
    },
    debugLines(): string[] {
      const position = teddyBody.translation();
      const rotation = quaternionAngleFromIdentity(teddyBody.rotation());

      return [
        "Claw target      " + targetState,
        "Motor command    " + commandedAngle.toFixed(3) + " rad",
        "Tip span command " + computeFingerTipSpan(commandedAngle).toFixed(3) + " m",
        "Finger path      " + computeFingerPathLength().toFixed(3) + " m",
        "Experiment       PT004",
        "Experiment phase " + labPhase,
        "Experiment result " + experimentResult,
        "Teddy mass / μ   " +
          config.pt004TeddyMassKg.toFixed(3) +
          " kg / " +
          config.pt004TeddyFriction.toFixed(2),
        "Teddy X / Y      " +
          position.x.toFixed(3) +
          " / " +
          position.y.toFixed(3) +
          " m",
        "Peak lift        " + peakLift.toFixed(3) + " m",
        "Rotation now/max " +
          rotation.toFixed(3) +
          " / " +
          peakRotation.toFixed(3) +
          " rad",
        "Hook target      right arm (cyan marker)",
        "COM              compound-body origin (yellow marker)",
        "Controls         P run PT-004 | C close | O open | Space toggle | D debug",
        "Attachment       NONE — teddy remains one independent dynamic compound body",
      ];
    },
  };
}
