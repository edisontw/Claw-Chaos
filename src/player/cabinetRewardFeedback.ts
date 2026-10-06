import type {
  CabinetRewardEvent,
  CabinetRewardKind,
} from "../cabinet/cabinetRewardFeedback";

export interface CabinetRewardPresentation {
  title: string;
  detail: string;
  durationMs: number;
  particleCount: number;
}

export function cabinetRewardPresentation(
  kind: CabinetRewardKind,
  reducedEffects: boolean,
): CabinetRewardPresentation {
  if (kind === "clear") {
    return {
      title: "MACHINE CLEARED!",
      detail: "ALL PRIZES WON",
      durationMs: 2600,
      particleCount: reducedEffects ? 0 : 18,
    };
  }

  return {
    title: "PRIZE GET!",
    detail: "PRIZE DELIVERED",
    durationMs: 1600,
    particleCount: reducedEffects ? 0 : 10,
  };
}

const PARTICLE_VECTORS = [
  [-118, -78],
  [-92, -118],
  [-52, -138],
  [-12, -126],
  [36, -140],
  [76, -112],
  [118, -76],
  [130, -28],
  [112, 22],
  [72, 54],
  [24, 66],
  [-34, 62],
  [-82, 46],
  [-126, 12],
  [-142, -34],
  [88, -154],
  [-94, -158],
  [0, -172],
] as const;

export class CabinetRewardFeedback {
  private readonly element: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  private readonly particles: HTMLDivElement;
  private hideTimer: number | null = null;

  constructor(private readonly root: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "cabinet-reward-feedback";
    this.element.setAttribute("aria-live", "polite");
    this.element.setAttribute("aria-atomic", "true");

    this.title = document.createElement("div");
    this.title.className = "cabinet-reward-title";

    this.detail = document.createElement("div");
    this.detail.className = "cabinet-reward-detail";

    this.particles = document.createElement("div");
    this.particles.className = "cabinet-reward-particles";

    this.element.append(
      this.particles,
      this.title,
      this.detail,
    );
    this.root.append(this.element);
    this.root.dataset.rewardFeedback = "ready";
  }

  show(
    event: CabinetRewardEvent,
    reducedEffects: boolean,
  ): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
    }

    const presentation = cabinetRewardPresentation(
      event.kind,
      reducedEffects,
    );
    this.title.textContent = presentation.title;
    this.detail.textContent = presentation.detail;
    this.element.dataset.kind = event.kind;
    this.root.dataset.lastReward = event.kind;
    this.root.dataset.lastRewardSequence =
      event.resultSequence.toString();

    this.particles.replaceChildren();
    for (
      let index = 0;
      index < presentation.particleCount;
      index += 1
    ) {
      const particle = document.createElement("i");
      particle.className = "cabinet-reward-particle";
      const vector =
        PARTICLE_VECTORS[index % PARTICLE_VECTORS.length]!;
      particle.style.setProperty(
        "--reward-x",
        vector[0] + "px",
      );
      particle.style.setProperty(
        "--reward-y",
        vector[1] + "px",
      );
      particle.style.setProperty(
        "--reward-delay",
        (index % 5) * 22 + "ms",
      );
      this.particles.append(particle);
    }

    this.element.dataset.active = "false";
    void this.element.offsetWidth;
    this.element.dataset.active = "true";

    this.hideTimer = window.setTimeout(() => {
      this.element.dataset.active = "false";
      this.hideTimer = null;
    }, presentation.durationMs);
  }
}
