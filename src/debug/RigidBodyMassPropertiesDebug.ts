import * as THREE from "three";
import type { RigidBodyHandle, Vec3 } from "../physics/PhysicsRuntime";

export interface RigidBodyMassPropertiesDebugTarget {
  body: RigidBodyHandle;
  label?: string;
}

export interface RigidBodyMassPropertiesSnapshot {
  origin: Vec3;
  localCom: Vec3;
  worldCom: Vec3;
  originToComDistance: number;
}

export function readRigidBodyMassProperties(
  body: RigidBodyHandle,
): RigidBodyMassPropertiesSnapshot {
  const origin = body.translation();
  const localCom = body.localCom();
  const worldCom = body.worldCom();

  return {
    origin: { x: origin.x, y: origin.y, z: origin.z },
    localCom: { x: localCom.x, y: localCom.y, z: localCom.z },
    worldCom: { x: worldCom.x, y: worldCom.y, z: worldCom.z },
    originToComDistance: Math.hypot(
      worldCom.x - origin.x,
      worldCom.y - origin.y,
      worldCom.z - origin.z,
    ),
  };
}

interface DebugEntry {
  target: RigidBodyMassPropertiesDebugTarget;
  originMarker: THREE.Mesh;
  comMarker: THREE.Mesh;
  connector: THREE.Line;
  connectorPositions: Float32Array;
}

export class RigidBodyMassPropertiesDebugRenderer {
  private readonly group = new THREE.Group();
  private readonly entries: DebugEntry[] = [];
  private visibleValue: boolean;

  constructor(
    scene: THREE.Scene,
    targets: readonly RigidBodyMassPropertiesDebugTarget[],
    initiallyVisible = false,
  ) {
    this.visibleValue = initiallyVisible;
    this.group.name = "rigid-body-mass-properties-debug";
    this.group.visible = initiallyVisible;
    scene.add(this.group);

    for (const target of targets) {
      this.addTarget(target);
    }
  }

  get visible(): boolean {
    return this.visibleValue;
  }

  toggle(): void {
    this.setVisible(!this.visibleValue);
  }

  setVisible(visible: boolean): void {
    this.visibleValue = visible;
    this.group.visible = visible;
  }

  update(): void {
    if (!this.visibleValue) {
      return;
    }

    for (const entry of this.entries) {
      const snapshot = readRigidBodyMassProperties(entry.target.body);

      entry.originMarker.position.set(
        snapshot.origin.x,
        snapshot.origin.y,
        snapshot.origin.z,
      );
      entry.comMarker.position.set(
        snapshot.worldCom.x,
        snapshot.worldCom.y,
        snapshot.worldCom.z,
      );

      entry.connectorPositions[0] = snapshot.origin.x;
      entry.connectorPositions[1] = snapshot.origin.y;
      entry.connectorPositions[2] = snapshot.origin.z;
      entry.connectorPositions[3] = snapshot.worldCom.x;
      entry.connectorPositions[4] = snapshot.worldCom.y;
      entry.connectorPositions[5] = snapshot.worldCom.z;

      const position = entry.connector.geometry.getAttribute("position");
      position.needsUpdate = true;
      entry.connector.visible = snapshot.originToComDistance > 1e-5;
    }
  }

  private addTarget(target: RigidBodyMassPropertiesDebugTarget): void {
    const originMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4fd8,
      wireframe: true,
      depthTest: false,
    });
    const comMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      depthTest: false,
    });

    const originMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.009, 12, 8),
      originMaterial,
    );
    originMarker.name = (target.label ?? "body") + "-origin";
    originMarker.renderOrder = 1002;

    const comMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.0055, 12, 8),
      comMaterial,
    );
    comMarker.name = (target.label ?? "body") + "-com";
    comMarker.renderOrder = 1003;

    const connectorPositions = new Float32Array(6);
    const connectorGeometry = new THREE.BufferGeometry();
    connectorGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(connectorPositions, 3),
    );
    const connector = new THREE.Line(
      connectorGeometry,
      new THREE.LineBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      }),
    );
    connector.name = (target.label ?? "body") + "-origin-to-com";
    connector.frustumCulled = false;
    connector.renderOrder = 1002;

    this.group.add(originMarker, comMarker, connector);
    this.entries.push({
      target,
      originMarker,
      comMarker,
      connector,
      connectorPositions,
    });
  }
}
