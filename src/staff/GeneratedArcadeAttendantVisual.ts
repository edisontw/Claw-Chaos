import * as THREE from "three";

export const GENERATED_STAFF_CHARACTER_VARIANT =
  "adult-female-arcade-attendant-image-billboard-v1";
export const GENERATED_STAFF_ASSET_PATH =
  "assets/staff/arcade-attendant-cutout.webp";
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

    const loader = new THREE.TextureLoader();
    loader.load(
      resolvePublicAssetUrl(GENERATED_STAFF_ASSET_PATH),
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;

        const material =
          createGeneratedStaffSpriteMaterial(texture);
        const sprite = new THREE.Sprite(material);
        sprite.name = "generated-arcade-attendant-cutout";
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
        sprite.renderOrder = GENERATED_STAFF_RENDER_ORDER;
        sprite.castShadow = false;
        sprite.receiveShadow = false;
        this.root.add(sprite);
        this.setStatus("image");
      },
      undefined,
      (error) => {
        this.setStatus("fallback");
        console.warn(
          "Generated arcade attendant image failed to load; using procedural fallback.",
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
}
