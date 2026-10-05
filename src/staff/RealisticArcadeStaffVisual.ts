import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { StaffServicePhase } from "./staffServiceSequence";

export const REALISTIC_STAFF_CHARACTER_VARIANT =
  "adult-female-arcade-attendant-v4-realistic-rigged";
export const REALISTIC_STAFF_TARGET_HEIGHT_METERS = 1.64;
export const REALISTIC_STAFF_ASSET_PATH =
  "assets/staff/arcade-attendant-realistic.glb";
export const REALISTIC_STAFF_DRACO_PATH =
  "assets/draco/";

export type RealisticStaffAssetStatus =
  | "loading"
  | "realistic"
  | "fallback";

function resolvePublicAssetUrl(path: string): string {
  if (
    typeof document === "undefined" ||
    !document.baseURI
  ) {
    return path;
  }
  return new URL(path, document.baseURI).toString();
}

function isWalkingPhase(
  phase: StaffServicePhase,
): boolean {
  return (
    phase === "approaching" ||
    phase === "departing"
  );
}

function isServicePhase(
  phase: StaffServicePhase,
): boolean {
  return (
    phase === "opening_door" ||
    phase === "door_open" ||
    phase === "closing_door"
  );
}

export class RealisticArcadeStaffVisual {
  readonly root = new THREE.Group();
  private readonly modelRoot = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private action: THREE.AnimationAction | null = null;
  private elapsedSeconds = 0;
  private statusValue: RealisticStaffAssetStatus =
    "loading";

  constructor(enabled = true) {
    this.root.name = REALISTIC_STAFF_CHARACTER_VARIANT;
    this.root.visible = false;
    this.root.userData.visualOnly = true;
    this.root.userData.characterVariant =
      REALISTIC_STAFF_CHARACTER_VARIANT;
    this.root.userData.assetStatus = "loading";

    this.modelRoot.name =
      "realistic-staff-model-transform";
    this.modelRoot.userData.visualOnly = true;
    this.root.add(this.modelRoot);

    if (
      !enabled ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      this.statusValue = "fallback";
      this.root.userData.assetStatus = "fallback";
      return;
    }

    void this.load();
  }

  private async load(): Promise<void> {
    const draco = new DRACOLoader();
    try {
      draco.setDecoderPath(
        resolvePublicAssetUrl(
          REALISTIC_STAFF_DRACO_PATH,
        ),
      );

      const loader = new GLTFLoader();
      loader.setDRACOLoader(draco);
      loader.setMeshoptDecoder(MeshoptDecoder);

      const gltf = await loader.loadAsync(
        resolvePublicAssetUrl(
          REALISTIC_STAFF_ASSET_PATH,
        ),
      );

      gltf.scene.traverse((object) => {
        object.userData.visualOnly = true;
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
        if (object instanceof THREE.SkinnedMesh) {
          object.computeBoundingBox();
          object.computeBoundingSphere();
        }
      });

      // Match the service controller's +Z-forward convention.
      gltf.scene.rotation.y = Math.PI;
      gltf.scene.updateMatrixWorld(true);

      let bounds = new THREE.Box3().setFromObject(
        gltf.scene,
        true,
      );
      const height = Math.max(
        1e-6,
        bounds.max.y - bounds.min.y,
      );
      gltf.scene.scale.multiplyScalar(
        REALISTIC_STAFF_TARGET_HEIGHT_METERS /
          height,
      );
      gltf.scene.updateMatrixWorld(true);

      bounds = new THREE.Box3().setFromObject(
        gltf.scene,
        true,
      );
      gltf.scene.position.x -=
        (bounds.min.x + bounds.max.x) * 0.5;
      gltf.scene.position.y -= bounds.min.y;
      gltf.scene.position.z -=
        (bounds.min.z + bounds.max.z) * 0.5;
      gltf.scene.updateMatrixWorld(true);

      this.modelRoot.add(gltf.scene);
      this.mixer = new THREE.AnimationMixer(gltf.scene);

      const clip =
        gltf.animations.find(
          (candidate) =>
            candidate.name === "mixamo.com",
        ) ?? gltf.animations[0];

      if (clip) {
        this.action = this.mixer.clipAction(clip);
        this.action
          .setLoop(THREE.LoopRepeat, Infinity)
          .play();
        this.action.setEffectiveWeight(1);
        this.action.setEffectiveTimeScale(0.32);
      }

      this.statusValue = "realistic";
      this.root.userData.assetStatus = "realistic";
    } catch (error) {
      this.statusValue = "fallback";
      this.root.userData.assetStatus = "fallback";
      console.warn(
        "Realistic arcade staff asset failed to load; using lighter fallback.",
        error,
      );
    } finally {
      draco.dispose();
    }
  }

  update(
    phase: StaffServicePhase,
    stepSeconds: number,
  ): void {
    if (this.statusValue !== "realistic") {
      return;
    }

    this.elapsedSeconds += stepSeconds;
    const walking = isWalkingPhase(phase);
    const servicing = isServicePhase(phase);

    this.action?.setEffectiveTimeScale(
      walking ? 0.90 : servicing ? 0.24 : 0.32,
    );
    this.mixer?.update(stepSeconds);

    const walkBob = walking
      ? Math.abs(
          Math.sin(this.elapsedSeconds * 7.2),
        ) * 0.008
      : 0;
    this.modelRoot.position.y = walkBob;
    this.modelRoot.rotation.x = servicing
      ? -0.035
      : 0;
    this.modelRoot.rotation.z = walking
      ? Math.sin(this.elapsedSeconds * 3.6) * 0.008
      : 0;
  }

  get status(): RealisticStaffAssetStatus {
    return this.statusValue;
  }
}
