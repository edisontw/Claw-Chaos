import { DEFAULT_SCENE_ID, DEFAULT_SCENE_SEED } from "../config/simulation";

export const SCENE_IDS = ["gantry-lab", "cabinet-lab", "prize-lab", "claw-lab", "falling-cube"] as const;

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


/**
 * The public stocked machine gets a fresh set of physical prize positions
 * every time a new page session starts. An explicit ?seed=... stays fully
 * reproducible for bug reports. Other M09 physics layouts stay deterministic.
 */
export function resolveStartupSceneSelection(
  search: string,
  newSeed: () => string,
): SceneSelection {
  const selected = parseSceneSelection(search);
  const params = new URLSearchParams(search);
  const requestedLayout = params.get("layout")?.trim() || "stocked";
  if (
    selected.id === "cabinet-lab" &&
    requestedLayout === "stocked" &&
    !params.get("seed")?.trim()
  ) {
    return { ...selected, seed: newSeed() };
  }
  return selected;
}
