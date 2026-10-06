import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { StaffServicePhase } from "./staffServiceSequence";

export const SKINNED_STAFF_CHARACTER_VARIANT =
  "adult-female-arcade-attendant-v3-skinned";
export const SKINNED_STAFF_TARGET_HEIGHT_METERS = 1.64;
export const SKINNED_STAFF_ASSET_PATH =
  "assets/staff/quaternius-woman.gltf";
export const SKINNED_STAFF_TEXTURE_PATH =
  "assets/staff/quaternius-woman.png";

export type SkinnedStaffAssetStatus =
  | "loading"
  | "skinned"
  | "fallback";

export type SkinnedStaffAnimationMode =
  | "idle"
  | "walking"
  | "service";

export function resolveSkinnedStaffAnimationMode(
  phase: StaffServicePhase,
): SkinnedStaffAnimationMode {
  if (
    phase === "approaching" ||
    phase === "departing"
  ) {
    return "walking";
  }
  if (
    phase === "opening_door" ||
    phase === "door_open"
  ) {
    return "service";
  }
  return "idle";
}

export function resolveSkinnedStaffAnimationClipName(
  mode: SkinnedStaffAnimationMode,
): "Idle" | "Walking" | "PickUp" {
  switch (mode) {
    case "walking":
      return "Walking";
    case "service":
      return "PickUp";
    case "idle":
      return "Idle";
  }
}

function resolvePublicAssetUrl(path: string): string {
  if (
    typeof document === "undefined" ||
    !document.baseURI
  ) {
    return path;
  }
  return new URL(path, document.baseURI).toString();
}

export class SkinnedArcadeStaffVisual {
  readonly root = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<string, THREE.AnimationClip>();
  private currentAction: THREE.AnimationAction | null = null;
  private currentMode: SkinnedStaffAnimationMode | null = null;
  private statusValue: SkinnedStaffAssetStatus = "loading";

  constructor() {
    this.root.name = SKINNED_STAFF_CHARACTER_VARIANT;
    this.root.visible = false;
    this.root.userData.visualOnly = true;
    this.root.userData.characterVariant =
      SKINNED_STAFF_CHARACTER_VARIANT;
    this.root.userData.assetStatus = "loading";

    if (
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
    try {
      const loader = new GLTFLoader();
      const textureLoader = new THREE.TextureLoader();
      const [gltf, texture] = await Promise.all([
        loader.loadAsync(
          resolvePublicAssetUrl(
            SKINNED_STAFF_ASSET_PATH,
          ),
        ),
        textureLoader.loadAsync(
          resolvePublicAssetUrl(
            SKINNED_STAFF_TEXTURE_PATH,
          ),
        ),
      ]);

      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.needsUpdate = true;

      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.72,
        metalness: 0,
      });

      gltf.scene.traverse((object) => {
        object.userData.visualOnly = true;
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          object.material = material;
        }
        if (object instanceof THREE.SkinnedMesh) {
          object.computeBoundingBox();
          object.computeBoundingSphere();
        }
      });

      // Blender/glTF characters conventionally face -Z; the
      // existing staff service pose treats +Z as character-forward.
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
      const scale =
        SKINNED_STAFF_TARGET_HEIGHT_METERS / height;
      gltf.scene.scale.multiplyScalar(scale);
      gltf.scene.updateMatrixWorld(true);

      bounds = new THREE.Box3().setFromObject(
        gltf.scene,
        true,
      );
      gltf.scene.position.y -= bounds.min.y;
      gltf.scene.updateMatrixWorld(true);

      this.clips = new Map(
        gltf.animations.map((clip) => [
          clip.name,
          clip,
        ]),
      );
      this.mixer = new THREE.AnimationMixer(gltf.scene);
      this.root.add(gltf.scene);
      this.statusValue = "skinned";
      this.root.userData.assetStatus = "skinned";
      this.setAnimation("idle");
    } catch (error) {
      this.statusValue = "fallback";
      this.root.userData.assetStatus = "fallback";
      console.warn(
        "Skinned arcade staff asset failed to load; using procedural fallback.",
        error,
      );
    }
  }

  private setAnimation(
    mode: SkinnedStaffAnimationMode,
  ): void {
    if (!this.mixer || this.currentMode === mode) {
      return;
    }

    const clipName =
      resolveSkinnedStaffAnimationClipName(mode);
    const clip = this.clips.get(clipName);
    if (!clip) {
      return;
    }

    const next = this.mixer.clipAction(clip);
    next.enabled = true;
    next.setEffectiveTimeScale(
      mode === "walking" ? 0.92 : 0.78,
    );
    next.setEffectiveWeight(1);

    if (mode === "service") {
      next.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }

    next.reset().play();
    if (
      this.currentAction &&
      this.currentAction !== next
    ) {
      this.currentAction.crossFadeTo(
        next,
        0.18,
        false,
      );
    }

    this.currentAction = next;
    this.currentMode = mode;
  }

  update(
    phase: StaffServicePhase,
    stepSeconds: number,
  ): void {
    if (this.statusValue !== "skinned") {
      return;
    }

    this.setAnimation(
      resolveSkinnedStaffAnimationMode(phase),
    );
    this.mixer?.update(stepSeconds);
  }

  get status(): SkinnedStaffAssetStatus {
    return this.statusValue;
  }
}
