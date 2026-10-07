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

export function pickRandomGeneratedStaffLoadedIndex(
  loadedIndices: readonly number[],
  currentIndex: number,
  random: () => number = Math.random,
): number {
  if (loadedIndices.length === 0) {
    return -1;
  }

  const alternatives = loadedIndices.filter(
    (index) => index !== currentIndex,
  );
  const candidates =
    alternatives.length > 0
      ? alternatives
      : loadedIndices;
  const slot = Math.min(
    candidates.length - 1,
    Math.floor(random() * candidates.length),
  );
  return candidates[slot] ?? loadedIndices[0] ?? -1;
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
 * All staff textures are preloaded so a service call can switch portraits
 * synchronously instead of briefly showing the previous attendant.
 */
export class GeneratedArcadeAttendantVisual {
  readonly root = new THREE.Group();
  private statusValue: GeneratedStaffVisualStatus =
    "loading";
  private currentAssetIndex = -1;
  private loader: THREE.TextureLoader | null = null;
  private sprite: THREE.Sprite | null = null;
  private material: THREE.SpriteMaterial | null = null;
  private readonly textures =
    new Map<number, THREE.Texture>();

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
    this.preloadAssets();
  }

  selectRandomStaff(): string {
    const loadedIndices = Array.from(
      this.textures.keys(),
    );
    const selectedIndex =
      pickRandomGeneratedStaffLoadedIndex(
        loadedIndices,
        this.currentAssetIndex,
      );

    if (selectedIndex < 0) {
      return this.assetPath;
    }

    this.applyTexture(selectedIndex);
    return (
      GENERATED_STAFF_ASSET_PATHS[selectedIndex] ??
      GENERATED_STAFF_ASSET_PATH
    );
  }

  private preloadAssets(): void {
    if (!this.loader) {
      return;
    }

    GENERATED_STAFF_ASSET_PATHS.forEach(
      (path, index) => {
        this.loader?.load(
          resolvePublicAssetUrl(path),
          (texture) => {
            this.prepareTexture(texture);
            this.textures.set(index, texture);

            if (!this.sprite) {
              this.applyTexture(index);
            }
          },
          undefined,
          (error) => {
            console.warn(
              `Generated arcade attendant image failed to preload: ${path}`,
              error,
            );
            if (
              this.textures.size === 0 &&
              !this.sprite
            ) {
              this.setStatus("fallback");
            }
          },
        );
      },
    );
  }

  private prepareTexture(texture: THREE.Texture): void {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter =
      THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }

  private applyTexture(index: number): void {
    const texture = this.textures.get(index);
    const path =
      GENERATED_STAFF_ASSET_PATHS[index];
    if (!texture || !path) {
      return;
    }

    if (!this.sprite || !this.material) {
      const material =
        createGeneratedStaffSpriteMaterial(texture);
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
      this.root.add(sprite);
    } else {
      this.material.map = texture;
      this.material.needsUpdate = true;
    }

    this.currentAssetIndex = index;
    this.root.userData.assetIndex = index + 1;
    this.root.userData.assetPath = path;
    this.root.userData.activeAssetPath = path;
    this.setStatus("image");
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
