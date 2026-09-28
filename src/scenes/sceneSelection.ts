import { DEFAULT_SCENE_ID, DEFAULT_SCENE_SEED } from "../config/simulation";

export const SCENE_IDS = ["claw-lab", "falling-cube"] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export interface SceneSelection {
  id: SceneId;
  seed: string;
  usedFallback: boolean;
}

export function parseSceneSelection(search: string): SceneSelection {
  const params = new URLSearchParams(search);
  const requested = params.get("scene") ?? DEFAULT_SCENE_ID;
  const seed = params.get("seed")?.trim() || DEFAULT_SCENE_SEED;
  const isKnown = SCENE_IDS.includes(requested as SceneId);

  return {
    id: isKnown ? (requested as SceneId) : DEFAULT_SCENE_ID,
    seed,
    usedFallback: !isKnown,
  };
}
