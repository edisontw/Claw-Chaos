export interface VirtualJoystickVector {
  x: number;
  z: number;
}

export const MOBILE_JOYSTICK_DEAD_ZONE_FRACTION = 0.14;
export const MOBILE_ACTION_DEBOUNCE_MS = 140;

export function normalizeVirtualJoystick(
  deltaX: number,
  deltaY: number,
  radiusPixels: number,
  deadZoneFraction = MOBILE_JOYSTICK_DEAD_ZONE_FRACTION,
): VirtualJoystickVector {
  const radius = Math.max(1, radiusPixels);
  const rawLength = Math.hypot(deltaX, deltaY);
  if (rawLength <= 1e-8) {
    return { x: 0, z: 0 };
  }

  const clampedLength = Math.min(rawLength, radius);
  const normalizedLength = clampedLength / radius;
  const deadZone = Math.max(0, Math.min(0.9, deadZoneFraction));

  if (normalizedLength <= deadZone) {
    return { x: 0, z: 0 };
  }

  const remappedLength =
    (normalizedLength - deadZone) / (1 - deadZone);
  const directionX = deltaX / rawLength;
  const directionZ = deltaY / rawLength;

  return {
    x: directionX * remappedLength,
    z: directionZ * remappedLength,
  };
}

export function isActionPressAllowed(
  previousAcceptedMilliseconds: number,
  nowMilliseconds: number,
  debounceMilliseconds = MOBILE_ACTION_DEBOUNCE_MS,
): boolean {
  return (
    !Number.isFinite(previousAcceptedMilliseconds) ||
    nowMilliseconds - previousAcceptedMilliseconds >=
      Math.max(0, debounceMilliseconds)
  );
}

export class MobileCabinetControls {
  private readonly root: HTMLDivElement;
  private readonly joystick: HTMLDivElement;
  private readonly thumb: HTMLDivElement;
  private readonly actionButton: HTMLButtonElement;
  private joystickPointerId: number | null = null;
  private lastAcceptedActionMilliseconds = Number.NEGATIVE_INFINITY;

  constructor(
    parent: HTMLElement,
    private readonly onMove: (x: number, z: number) => void,
    private readonly onAction: () => boolean,
    private readonly onViewHeightStep?: (direction: -1 | 1) => void,
    private readonly onZoomStep?: (direction: -1 | 1) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "mobile-cabinet-controls";
    this.root.dataset.mobileControls = "ready";
    this.root.dataset.mobileControlStyle = "compact-translucent";

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
    this.actionButton.textContent = "DROP\nCLOSE";
    this.actionButton.setAttribute("aria-label", "Drop or close claw");

    const viewHeight = document.createElement("div");
    viewHeight.className = "mobile-view-height";

    const viewUp = document.createElement("button");
    viewUp.type = "button";
    viewUp.className = "mobile-view-height-button";
    viewUp.textContent = "VIEW +";
    viewUp.setAttribute("aria-label", "Raise viewpoint");

    const viewDown = document.createElement("button");
    viewDown.type = "button";
    viewDown.className = "mobile-view-height-button";
    viewDown.textContent = "VIEW −";
    viewDown.setAttribute("aria-label", "Lower viewpoint");

    viewUp.addEventListener("pointerdown", (event) => {
      this.onViewHeightStep?.(1);
      event.preventDefault();
    });
    viewDown.addEventListener("pointerdown", (event) => {
      this.onViewHeightStep?.(-1);
      event.preventDefault();
    });

    const zoomIn = document.createElement("button");
    zoomIn.type = "button";
    zoomIn.className = "mobile-view-height-button";
    zoomIn.textContent = "ZOOM +";
    zoomIn.setAttribute("aria-label", "Zoom in");

    const zoomOut = document.createElement("button");
    zoomOut.type = "button";
    zoomOut.className = "mobile-view-height-button";
    zoomOut.textContent = "ZOOM −";
    zoomOut.setAttribute("aria-label", "Zoom out");

    zoomIn.addEventListener("pointerdown", (event) => {
      this.onZoomStep?.(1);
      event.preventDefault();
    });
    zoomOut.addEventListener("pointerdown", (event) => {
      this.onZoomStep?.(-1);
      event.preventDefault();
    });

    viewHeight.append(
      viewUp,
      viewDown,
      zoomIn,
      zoomOut,
    );

    this.root.append(joystickWrap, viewHeight, this.actionButton);
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
    this.joystick.dataset.active = "true";
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
    this.joystick.dataset.active = "false";
    this.thumb.style.transform = "translate(-50%, -50%)";
    this.onMove(0, 0);
    event.preventDefault();
  };

  private readonly onActionPointerDown = (event: PointerEvent): void => {
    const now = performance.now();
    if (
      !isActionPressAllowed(
        this.lastAcceptedActionMilliseconds,
        now,
      )
    ) {
      this.actionButton.dataset.result = "debounced";
      event.preventDefault();
      return;
    }

    const accepted = this.onAction();
    this.actionButton.dataset.result = accepted ? "accepted" : "blocked";
    window.setTimeout(() => {
      this.actionButton.dataset.result = "";
    }, 180);

    if (accepted) {
      this.lastAcceptedActionMilliseconds = now;
      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(18);
      }
    }
    event.preventDefault();
  };
}
