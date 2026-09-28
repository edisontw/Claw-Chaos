import * as THREE from "three";
import type { PhysicsDebugBuffers } from "../physics/PhysicsRuntime";

export class PhysicsDebugRenderer {
  private readonly geometry = new THREE.BufferGeometry();
  private readonly lines: THREE.LineSegments;
  private visibleValue: boolean;

  constructor(scene: THREE.Scene, initiallyVisible: boolean) {
    this.visibleValue = initiallyVisible;
    const material = new THREE.LineBasicMaterial({
      color: 0x54d8ff,
      transparent: true,
      opacity: 0.58,
      depthTest: false,
    });
    this.lines = new THREE.LineSegments(this.geometry, material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 1000;
    this.lines.visible = initiallyVisible;
    scene.add(this.lines);
  }

  get visible(): boolean {
    return this.visibleValue;
  }

  toggle(): void {
    this.setVisible(!this.visibleValue);
  }

  setVisible(visible: boolean): void {
    this.visibleValue = visible;
    this.lines.visible = visible;
  }

  update(buffers: PhysicsDebugBuffers): void {
    if (!this.visibleValue) {
      return;
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(buffers.vertices), 3),
    );
    this.geometry.computeBoundingSphere();
  }
}
