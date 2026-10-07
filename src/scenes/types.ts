import type * as THREE from "three";
import type { MachineAudioState } from "../audio/machineAudioState";
import type { CabinetRewardEvent } from "../cabinet/cabinetRewardFeedback";
import type { RigidBodyHandle } from "../physics/PhysicsRuntime";
import type { RenderQualityProfile } from "../player/mobileRenderProfile";

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

export type StaffCallUiMode =
  | "locked"
  | "available"
  | "waiting"
  | "paused";

export interface StaffCallUiState {
  mode: StaffCallUiMode;
  label: string;
  detail: string;
}

export interface SimulationScene {
  bindings: RenderBinding[];
  camera: CameraPreset;
  milestone: string;
  layoutId?: string;
  environmentId?: string;
  staffCharacterVariant?: string;
  massPropertiesDebugTargets?: MassPropertiesDebugTarget[];
  beforePhysicsStep?(stepSeconds: number): void;
  primaryAction?(): boolean;
  requestStaff?(): boolean;
  getStaffCallState?(): StaffCallUiState;
  getStaffVisualStatus?(): string;
  getStaffAssetPath?(): string;
  getStaffCameraView?(): CameraPreset | null;
  isSafeForService?(): boolean;
  setManualGantryInput?(x: number, z: number): void;
  setRenderQuality?(profile: RenderQualityProfile): void;
  getMachineAudioState?(): MachineAudioState;
  consumeRewardEvents?(): CabinetRewardEvent[];
  debugLines?(): string[];
}
