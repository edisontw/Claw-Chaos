import * as THREE from "three";

export const GENERATED_STAFF_CHARACTER_VARIANT =
  "adult-female-arcade-attendant-image-billboard-v1";
export const GENERATED_STAFF_ASSET_PATHS = [
  "assets/staff/arcade-attendant-01.webp",
  "assets/staff/arcade-attendant-02.webp",
  "assets/staff/arcade-attendant-03.webp",
  "assets/staff/arcade-attendant-04.webp",
  "assets/staff/arcade-attendant-05.webp",
  "assets/staff/arcade-attendant-06.webp",
  "assets/staff/arcade-attendant-07.webp",
  "assets/staff/arcade-attendant-08.webp",
] as const;
export const GENERATED_STAFF_ASSET_PATH =
  GENERATED_STAFF_ASSET_PATHS[0];
export const GENERATED_STAFF_TARGET_HEIGHT_METERS = 1.64;
export const GENERATED_STAFF_RENDER_ORDER = 20;
export const GENERATED_STAFF_OCCLUSION_POLICY =
  "scene-depth";
const GENERATED_STAFF_TEXTURE_ASPECT = 1024 / 1536;

export type GeneratedStaffVisualStatus =
  | "loading"
  | "image"
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

export function pickRandomGeneratedStaffAssetIndex(
  currentIndex: number,
  random: () => number = Math.random,
): number {
  const count = GENERATED_STAFF_ASSET_PATHS.length;
  if (count <= 1) {
    return 0;
  }

  if (
    currentIndex < 0 ||
    currentIndex >= count
  ) {
    return Math.min(
      count - 1,
      Math.floor(random() * count),
    );
  }

  const slot = Math.min(
    count - 2,
    Math.floor(random() * (count - 1)),
  );
  return slot >= currentIndex ? slot + 1 : slot;
}

export function createGeneratedStaffSpriteMaterial(
  texture: THREE.Texture,
): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.015,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/**
 * A photorealistic, generated cutout rendered as a camera-facing sprite.
 * It is visual-only and intentionally has no physics representation.
 */
export class GeneratedArcadeAttendantVisual {
  readonly root = new THREE.Group();
  private statusValue: GeneratedStaffVisualStatus =
    "loading";
  private currentAssetIndex = -1;
  private loadRequestId = 0;
  private loader: THREE.TextureLoader | null = null;
  private sprite: THREE.Sprite | null = null;
  private material: THREE.SpriteMaterial | null = null;
  private texture: THREE.Texture | null = null;

  constructor() {
    this.root.name = GENERATED_STAFF_CHARACTER_VARIANT;
    this.root.visible = false;
    this.root.userData.visualOnly = true;
    this.root.userData.characterVariant =
      GENERATED_STAFF_CHARACTER_VARIANT;
    this.root.userData.assetStatus = "loading";
    this.root.userData.occlusionPolicy =
      GENERATED_STAFF_OCCLUSION_POLICY;

    if (
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      this.setStatus("fallback");
      return;
    }

    this.loader = new THREE.TextureLoader();
    this.selectRandomStaff();
  }

  selectRandomStaff(): string {
    this.currentAssetIndex =
      pickRandomGeneratedStaffAssetIndex(
        this.currentAssetIndex,
      );
    const path =
      GENERATED_STAFF_ASSET_PATHS[
        this.currentAssetIndex
      ];
    this.root.userData.assetIndex =
      this.currentAssetIndex + 1;
    this.root.userData.assetPath = path;
    this.loadAsset(path);
    return path;
  }

  private loadAsset(path: string): void {
    if (!this.loader) {
      return;
    }

    const requestId = ++this.loadRequestId;
    if (!this.sprite) {
      this.setStatus("loading");
    }

    this.loader.load(
      resolvePublicAssetUrl(path),
      (texture) => {
        if (requestId !== this.loadRequestId) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter =
          THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;

        if (!this.sprite || !this.material) {
          const material =
            createGeneratedStaffSpriteMaterial(
              texture,
            );
          const sprite = new THREE.Sprite(material);
          sprite.name =
            "generated-arcade-attendant-cutout";
          sprite.center.set(0.5, 0);
          sprite.scale.set(
            GENERATED_STAFF_TARGET_HEIGHT_METERS *
              GENERATED_STAFF_TEXTURE_ASPECT,
            GENERATED_STAFF_TARGET_HEIGHT_METERS,
            1,
          );
          sprite.userData.visualOnly = true;
          sprite.userData.occlusionPolicy =
            GENERATED_STAFF_OCCLUSION_POLICY;
          sprite.renderOrder =
            GENERATED_STAFF_RENDER_ORDER;
          sprite.castShadow = false;
          sprite.receiveShadow = false;
          this.material = material;
          this.sprite = sprite;
          this.texture = texture;
          this.root.add(sprite);
        } else {
          const previousTexture = this.texture;
          this.material.map = texture;
          this.material.needsUpdate = true;
          this.texture = texture;
          previousTexture?.dispose();
        }

        this.root.userData.activeAssetPath = path;
        this.setStatus("image");
      },
      undefined,
      (error) => {
        if (requestId !== this.loadRequestId) {
          return;
        }
        if (!this.sprite) {
          this.setStatus("fallback");
        }
        console.warn(
          "Generated arcade attendant image failed to load; keeping the current visual fallback.",
          error,
        );
      },
    );
  }

  private setStatus(status: GeneratedStaffVisualStatus): void {
    this.statusValue = status;
    this.root.userData.assetStatus = status;
  }

  get status(): GeneratedStaffVisualStatus {
    return this.statusValue;
  }

  get assetPath(): string {
    return (
      this.root.userData.activeAssetPath ??
      this.root.userData.assetPath ??
      ""
    );
  }
}
