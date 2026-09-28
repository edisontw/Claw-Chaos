import * as THREE from "three";
import type {
  PhysicsRuntime,
  RevoluteJointHandle,
  RigidBodyHandle,
  Vec3,
} from "../physics/PhysicsRuntime";
import type { SimulationScene } from "./types";

export const CLAW_LAB_CONFIG = {
  floorHalfSize: 1,
  hubCenterY: 0.82,
  hubHalfExtents: { x: 0.08, y: 0.035, z: 0.08 },
  fingerPivotRadius: 0.068,
  fingerLength: 0.26,
  fingerHalfThickness: 0.009,
  fingerDensity: 1200,
  openAngle: 0.38,
  closedAngle: -0.72,
  motorSpeedRadiansPerSecond: 1.6,
  motorStiffness: 28,
  motorDamping: 5,
  maxMotorTorque: 1.5,
} as const;

type ClawTargetState = "OPEN" | "CLOSED";

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

function addJointDiagnostic(
  scene: THREE.Scene,
  pivot: Vec3,
  axis: Vec3,
): void {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  marker.position.set(pivot.x, pivot.y, pivot.z);
  marker.renderOrder = 1001;
  scene.add(marker);

  const halfLength = 0.038;
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
  scene.add(axisLine);
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

  const hub = new THREE.Mesh(
    new THREE.BoxGeometry(
      config.hubHalfExtents.x * 2,
      config.hubHalfExtents.y * 2,
      config.hubHalfExtents.z * 2,
    ),
    new THREE.MeshStandardMaterial({
      color: 0x88929f,
      roughness: 0.42,
      metalness: 0.62,
    }),
  );
  hub.position.set(0, config.hubCenterY, 0);
  hub.castShadow = true;
  hub.receiveShadow = true;
  scene.add(hub);

  const hubBody = physics.createStaticCuboid(
    { x: 0, y: config.hubCenterY, z: 0 },
    config.hubHalfExtents,
    0.55,
  );

  const pivotY = config.hubCenterY - config.hubHalfExtents.y;
  const fingerCenterY = pivotY - config.fingerLength * 0.5;

  for (let index = 0; index < 3; index += 1) {
    const theta = index * (Math.PI * 2 / 3);
    const radialX = Math.cos(theta) * config.fingerPivotRadius;
    const radialZ = Math.sin(theta) * config.fingerPivotRadius;
    const tangent = {
      x: -Math.sin(theta),
      y: 0,
      z: Math.cos(theta),
    };

    const finger = new THREE.Mesh(
      new THREE.BoxGeometry(
        config.fingerHalfThickness * 2,
        config.fingerLength,
        config.fingerHalfThickness * 2,
      ),
      new THREE.MeshStandardMaterial({
        color: 0xd8dee7,
        roughness: 0.3,
        metalness: 0.72,
      }),
    );
    finger.castShadow = true;
    finger.receiveShadow = true;
    scene.add(finger);

    const fingerBody = physics.createDynamicCuboid(
      { x: radialX, y: fingerCenterY, z: radialZ },
      {
        x: config.fingerHalfThickness,
        y: config.fingerLength * 0.5,
        z: config.fingerHalfThickness,
      },
      0,
      {
        friction: 0.55,
        restitution: 0.02,
        density: config.fingerDensity,
      },
    );

    const joint = physics.createRevoluteJoint(hubBody, fingerBody, {
      anchor1: {
        x: radialX,
        y: -config.hubHalfExtents.y,
        z: radialZ,
      },
      anchor2: {
        x: 0,
        y: config.fingerLength * 0.5,
        z: 0,
      },
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
    addJointDiagnostic(
      scene,
      { x: radialX, y: pivotY, z: radialZ },
      tangent,
    );
  }

  let targetState: ClawTargetState = "OPEN";
  let commandedAngle = 0;

  const wakeFingers = (): void => {
    for (const body of fingerBodies) {
      body.wakeUp();
    }
  };

  const setTargetState = (nextState: ClawTargetState): void => {
    targetState = nextState;
    wakeFingers();
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
    }
  };
  window.addEventListener("keydown", onKeyDown);

  return {
    bindings,
    milestone: "M01",
    camera: {
      position: [0.72, 0.75, 0.94],
      target: [0, 0.66, 0],
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
    },
    debugLines(): string[] {
      return [
        "Claw target      " + targetState,
        "Motor command    " + commandedAngle.toFixed(3) + " rad",
        "Open / closed    " +
          config.openAngle.toFixed(2) +
          " / " +
          config.closedAngle.toFixed(2) +
          " rad",
        "Motor speed      " +
          config.motorSpeedRadiansPerSecond.toFixed(2) +
          " rad/s",
        "Max torque       " + config.maxMotorTorque.toFixed(2) + " N·m",
        "Controls         C close | O open | Space toggle | D collider debug",
        "Attachment       NONE — joints + contacts only",
      ];
    },
  };
}
