import type { StaffCallUiState } from "../scenes/types";

export class StaffCallControl {
  private readonly root: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly detail: HTMLDivElement;

  constructor(
    parent: HTMLElement,
    private readonly onCallStaff: () => boolean,
  ) {
    this.root = document.createElement("div");
    this.root.className = "staff-call-control";
    this.root.dataset.staffCallControl = "ready";

    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "staff-call-button";
    this.button.setAttribute(
      "aria-label",
      "Call staff for machine service",
    );

    this.detail = document.createElement("div");
    this.detail.className = "staff-call-detail";
    this.detail.setAttribute("aria-live", "polite");

    this.button.addEventListener(
      "pointerdown",
      this.onPointerDown,
    );
    this.root.append(this.button, this.detail);
    parent.append(this.root);
  }

  update(state: StaffCallUiState): void {
    this.root.dataset.staffState = state.mode;
    this.button.textContent = state.label;
    this.button.disabled = state.mode !== "available";
    this.detail.textContent = state.detail;
  }

  private readonly onPointerDown = (
    event: PointerEvent,
  ): void => {
    const accepted = this.onCallStaff();
    this.button.dataset.result = accepted
      ? "accepted"
      : "blocked";
    window.setTimeout(() => {
      this.button.dataset.result = "";
    }, 180);
    event.preventDefault();
  };
}
