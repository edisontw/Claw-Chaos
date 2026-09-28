export interface DebugSnapshot {
  fps: number;
  physicsTicks: number;
  sceneId: string;
  seed: string;
  simulationSeconds: number;
  dynamicBodies: number;
  droppedCatchUpSeconds: number;
}

export class DebugOverlay {
  private readonly element: HTMLPreElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("pre");
    this.element.className = "debug-overlay";
    this.element.setAttribute("aria-live", "off");
    parent.append(this.element);
  }

  update(snapshot: DebugSnapshot): void {
    this.element.textContent = [
      "CLAW CHAOS — M00",
      `FPS              ${snapshot.fps.toFixed(1)}`,
      `Physics ticks    ${snapshot.physicsTicks}`,
      `Simulation time  ${snapshot.simulationSeconds.toFixed(2)} s`,
      `Scene            ${snapshot.sceneId}`,
      `Seed             ${snapshot.seed}`,
      `Dynamic bodies   ${snapshot.dynamicBodies}`,
      `Dropped catch-up ${snapshot.droppedCatchUpSeconds.toFixed(4)} s`,
    ].join("\n");
  }
}
