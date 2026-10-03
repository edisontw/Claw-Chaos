export interface VirtualJoystickVector {
  x: number;
  z: number;
}

export function normalizeVirtualJoystick(
  deltaX: number,
  deltaY: number,
  radiusPixels: number,
): VirtualJoystickVector {
  const radius = Math.max(1, radiusPixels);
  const length = Math.hypot(deltaX, deltaY);
  const scale = length > radius ? radius / length : 1;

  return {
    x: (deltaX * scale) / radius,
    z: (deltaY * scale) / radius,
  };
}

export class MobileCabinetControls {
  private readonly root: HTMLDivElement;
  private readonly joystick: HTMLDivElement;
  private readonly thumb: HTMLDivElement;
  private readonly actionButton: HTMLButtonElement;
  private joystickPointerId: number | null = null;

  constructor(
    parent: HTMLElement,
    private readonly onMove: (x: number, z: number) => void,
    private readonly onAction: () => boolean,
  ) {
    this.root = document.createElement("div");
    this.root.className = "mobile-cabinet-controls";
    this.root.dataset.mobileControls = "ready";

    const joystickWrap = document.createElement("div");
    joystickWrap.className = "mobile-joystick-wrap";

    this.joystick = document.createElement("div");
    this.joystick.className = "mobile-joystick";
    this.joystick.setAttribute("role", "application");
    this.joystick.setAttribute("aria-label", "Move claw");

    this.thumb = document.createElement("div");
    this.thumb.className = "mobile-joystick-thumb";
    this.joystick.append(this.thumb);
    joystickWrap.append(this.joystick);

    this.actionButton = document.createElement("button");
    this.actionButton.type = "button";
    this.actionButton.className = "mobile-claw-action";
    this.actionButton.textContent = "DROP / CLOSE";
    this.actionButton.setAttribute("aria-label", "Drop or close claw");

    this.root.append(joystickWrap, this.actionButton);
    parent.append(this.root);

    this.joystick.addEventListener("pointerdown", this.onJoystickPointerDown);
    this.joystick.addEventListener("pointermove", this.onJoystickPointerMove);
    this.joystick.addEventListener("pointerup", this.onJoystickPointerUp);
    this.joystick.addEventListener("pointercancel", this.onJoystickPointerUp);
    this.actionButton.addEventListener("pointerdown", this.onActionPointerDown);
  }

  private updateJoystick(event: PointerEvent): void {
    const rect = this.joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.5);
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    const deltaX = event.clientX - centerX;
    const deltaY = event.clientY - centerY;
    const vector = normalizeVirtualJoystick(deltaX, deltaY, radius);
    const visualX = vector.x * radius * 0.48;
    const visualY = vector.z * radius * 0.48;

    this.thumb.style.transform =
      `translate(calc(-50% + ${visualX.toFixed(1)}px), calc(-50% + ${visualY.toFixed(1)}px))`;
    this.onMove(vector.x, vector.z);
  }

  private readonly onJoystickPointerDown = (event: PointerEvent): void => {
    this.joystickPointerId = event.pointerId;
    this.joystick.setPointerCapture?.(event.pointerId);
    this.updateJoystick(event);
    event.preventDefault();
  };

  private readonly onJoystickPointerMove = (event: PointerEvent): void => {
    if (this.joystickPointerId !== event.pointerId) {
      return;
    }
    this.updateJoystick(event);
    event.preventDefault();
  };

  private readonly onJoystickPointerUp = (event: PointerEvent): void => {
    if (this.joystickPointerId !== event.pointerId) {
      return;
    }
    this.joystickPointerId = null;
    this.thumb.style.transform = "translate(-50%, -50%)";
    this.onMove(0, 0);
    event.preventDefault();
  };

  private readonly onActionPointerDown = (event: PointerEvent): void => {
    const accepted = this.onAction();
    this.actionButton.dataset.result = accepted ? "accepted" : "blocked";
    if (accepted && typeof navigator.vibrate === "function") {
      navigator.vibrate(18);
    }
    event.preventDefault();
  };
}
