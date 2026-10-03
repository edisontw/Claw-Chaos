import type * as THREE from "three";
import type { MachineAudioState } from "../audio/machineAudioState";
import type { RigidBodyHandle } from "../physics/PhysicsRuntime";

export interface RenderBinding {
  mesh: THREE.Object3D;
  body: RigidBodyHandle;
}

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
}

export interface MassPropertiesDebugTarget {
  body: RigidBodyHandle;
  label?: string;
}

export interface SimulationScene {
  bindings: RenderBinding[];
  camera: CameraPreset;
  milestone: string;
  layoutId?: string;
  massPropertiesDebugTargets?: MassPropertiesDebugTarget[];
  beforePhysicsStep?(stepSeconds: number): void;
  primaryAction?(): boolean;
  setManualGantryInput?(x: number, z: number): void;
  getMachineAudioState?(): MachineAudioState;
  debugLines?(): string[];
}
