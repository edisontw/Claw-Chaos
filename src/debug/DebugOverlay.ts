export interface DebugSnapshot {
  milestone: string;
  fps: number;
  physicsTicks: number;
  sceneId: string;
  seed: string;
  simulationSeconds: number;
  dynamicBodies: number;
  droppedCatchUpSeconds: number;
  physicsDebugVisible: boolean;
  massPropertiesDebugVisible: boolean;
  extraLines?: string[];
}

export class DebugOverlay {
  private readonly element: HTMLPreElement;
  private visibleValue: boolean;

  constructor(parent: HTMLElement, initiallyVisible = true) {
    this.visibleValue = initiallyVisible;
    this.element = document.createElement("pre");
    this.element.className = "debug-overlay";
    this.element.setAttribute("aria-live", "off");
    this.element.hidden = !initiallyVisible;
    parent.append(this.element);
  }

  get visible(): boolean {
    return this.visibleValue;
  }

  toggle(): void {
    this.setVisible(!this.visibleValue);
  }

  setVisible(visible: boolean): void {
    this.visibleValue = visible;
    this.element.hidden = !visible;
  }

  update(snapshot: DebugSnapshot): void {
    if (!this.visibleValue) {
      return;
    }
    this.element.textContent = [
      "CLAW CHAOS — " + snapshot.milestone,
      "FPS              " + snapshot.fps.toFixed(1),
      "Physics ticks    " + snapshot.physicsTicks,
      "Simulation time  " + snapshot.simulationSeconds.toFixed(2) + " s",
      "Scene            " + snapshot.sceneId,
      "Seed             " + snapshot.seed,
      "Dynamic bodies   " + snapshot.dynamicBodies,
      "Collider debug   " + (snapshot.physicsDebugVisible ? "ON" : "OFF"),
      "COM/origin debug  " + (snapshot.massPropertiesDebugVisible ? "ON" : "OFF"),
      "Dropped catch-up " + snapshot.droppedCatchUpSeconds.toFixed(4) + " s",
      ...(snapshot.extraLines ?? []),
    ].join("\n");
  }
}
