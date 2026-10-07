import * as THREE from "three";
import { M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";

export const M07_CAMERA_FOV_DEGREES = 50;
export const M07_MOBILE_CAMERA_FOV_DEGREES = 58;
export const M07_ZOOM_MIN_FOV_DEGREES = 34;
export const M07_ZOOM_MAX_FOV_DEGREES = 68;
export const M07_ZOOM_STEP_DEGREES = 4;
export const M07_STAFF_VIEW_FOV_DEGREES = 56;
const M07_ZOOM_WHEEL_DEGREES_PER_PIXEL = 0.025;
const M07_ZOOM_PINCH_DEGREES_PER_PIXEL = 0.035;
const M07_ZOOM_SMOOTHING_PER_SECOND = 13;

export interface FirstPersonPlayerViewConfig {
  initialX: number;
  initialZ: number;
  initialYawRadians: number;
  initialPitchRadians: number;
  eyeY: number;
  minEyeY: number;
  maxEyeY: number;
  eyeHeightStepMeters: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cabinetSideClearX: number;
  cabinetFrontClearZ: number;
  yawLimitRadians: number;
  pitchMinRadians: number;
  pitchMaxRadians: number;
  moveSpeedMetersPerSecond: number;
  mouseSensitivityRadiansPerPixel: number;
  touchSensitivityRadiansPerPixel: number;
}

export interface FirstPersonPlayerViewState {
  x: number;
  z: number;
  eyeY: number;
  yawRadians: number;
  pitchRadians: number;
}

export interface FirstPersonPlayerViewInput {
  strafe: number;
  forward: number;
}

export interface PlayerViewTarget {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
  maxDistanceMeters: number;
  focusHalfAngleRadians: number;
  action?: "primary";
}

export interface PlayerViewFocus {
  target: PlayerViewTarget;
  distanceMeters: number;
  angleRadians: number;
}

export interface PlayerViewLookAngles {
  yawRadians: number;
  pitchRadians: number;
  distanceMeters: number;
}

export interface TemporaryPlayerCameraView {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

const cabinetOuterX =
  M06_CABINET_CONFIG.interiorHalfX +
  M06_CABINET_CONFIG.wallHalfThickness * 2;
const frontGlassOuterZ =
  M06_CABINET_CONFIG.interiorHalfZ +
  M06_CABINET_CONFIG.wallHalfThickness * 2;
const cabinetClearanceMeters = 0.10;

export const M07_FIRST_PERSON_VIEW_CONFIG: FirstPersonPlayerViewConfig = {
  initialX: 0,
  initialZ: 0.84,
  initialYawRadians: 0,
  initialPitchRadians: THREE.MathUtils.degToRad(-23),
  eyeY: 1.04,
  minEyeY: 0.98,
  maxEyeY: 1.10,
  eyeHeightStepMeters: 0.02,
  minX: -0.28,
  maxX: 0.28,
  minZ: frontGlassOuterZ + 0.15,
  maxZ: 0.84,
  cabinetSideClearX: cabinetOuterX + cabinetClearanceMeters,
  cabinetFrontClearZ: frontGlassOuterZ + cabinetClearanceMeters,
  yawLimitRadians: THREE.MathUtils.degToRad(90),
  pitchMinRadians: THREE.MathUtils.degToRad(-70),
  pitchMaxRadians: THREE.MathUtils.degToRad(25),
  moveSpeedMetersPerSecond: 0.55,
  mouseSensitivityRadiansPerPixel: 0.0022,
  touchSensitivityRadiansPerPixel: 0.0030,
};

export const M07_MOBILE_FIRST_PERSON_VIEW_CONFIG:
  FirstPersonPlayerViewConfig = {
    ...M07_FIRST_PERSON_VIEW_CONFIG,
    initialZ: 0.84,
    maxZ: 0.90,
  };

export const M07_CABINET_VIEW_TARGETS: readonly PlayerViewTarget[] = [
  {
    id: "control-panel",
    label: "control panel button",
    position: {
      x: 0.11,
      y: 0.165,
      z: M06_CABINET_CONFIG.interiorHalfZ + 0.105,
    },
    maxDistanceMeters: 1.10,
    focusHalfAngleRadians: THREE.MathUtils.degToRad(9),
    action: "primary",
  },
  {
    id: "chute",
    label: "prize chute",
    position: {
      x: M06_CABINET_CONFIG.chuteCenterX,
      y: M06_CABINET_CONFIG.playDeckY + 0.02,
      z: M06_CABINET_CONFIG.chuteCenterZ,
    },
    maxDistanceMeters: 1.40,
    focusHalfAngleRadians: THREE.MathUtils.degToRad(10),
  },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampFirstPersonZoomFov(
  fovDegrees: number,
): number {
  return clamp(
    fovDegrees,
    M07_ZOOM_MIN_FOV_DEGREES,
    M07_ZOOM_MAX_FOV_DEGREES,
  );
}

export function zoomFirstPersonFovByStep(
  fovDegrees: number,
  direction: -1 | 1,
): number {
  return clampFirstPersonZoomFov(
    fovDegrees -
      direction * M07_ZOOM_STEP_DEGREES,
  );
}

function normalizedAxis(value: number): number {
  return clamp(value, -1, 1);
}

function insideCabinetClearance(
  x: number,
  z: number,
  config: FirstPersonPlayerViewConfig,
): boolean {
  return (
    Math.abs(x) < config.cabinetSideClearX &&
    z < config.cabinetFrontClearZ
  );
}

export function constrainPlayerPosition(
  previous: { x: number; z: number },
  desired: { x: number; z: number },
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
): { x: number; z: number } {
  let x = clamp(desired.x, config.minX, config.maxX);
  let z = clamp(desired.z, config.minZ, config.maxZ);

  if (!insideCabinetClearance(x, z, config)) {
    return { x, z };
  }

  if (
    previous.z >= config.cabinetFrontClearZ &&
    Math.abs(previous.x) < config.cabinetSideClearX
  ) {
    z = config.cabinetFrontClearZ;
  } else if (previous.x >= config.cabinetSideClearX) {
    x = config.cabinetSideClearX;
  } else if (previous.x <= -config.cabinetSideClearX) {
    x = -config.cabinetSideClearX;
  } else {
    const frontCorrection = config.cabinetFrontClearZ - z;
    const sideCorrection =
      config.cabinetSideClearX - Math.abs(x);
    if (frontCorrection <= sideCorrection) {
      z = config.cabinetFrontClearZ;
    } else {
      x =
        (x >= 0 ? 1 : -1) *
        config.cabinetSideClearX;
    }
  }

  return { x, z };
}

export function createFirstPersonPlayerViewState(
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
): FirstPersonPlayerViewState {
  return {
    x: config.initialX,
    z: config.initialZ,
    eyeY: config.eyeY,
    yawRadians: config.initialYawRadians,
    pitchRadians: config.initialPitchRadians,
  };
}

export function adjustFirstPersonEyeHeight(
  state: FirstPersonPlayerViewState,
  deltaMeters: number,
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
): FirstPersonPlayerViewState {
  return {
    ...state,
    eyeY: clamp(
      state.eyeY + deltaMeters,
      config.minEyeY,
      config.maxEyeY,
    ),
  };
}

export function applyFirstPersonLookDelta(
  state: FirstPersonPlayerViewState,
  movementX: number,
  movementY: number,
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
  sensitivityRadiansPerPixel =
    config.mouseSensitivityRadiansPerPixel,
): FirstPersonPlayerViewState {
  return {
    ...state,
    yawRadians: clamp(
      state.yawRadians -
        movementX * sensitivityRadiansPerPixel,
      -config.yawLimitRadians,
      config.yawLimitRadians,
    ),
    pitchRadians: clamp(
      state.pitchRadians -
        movementY * sensitivityRadiansPerPixel,
      config.pitchMinRadians,
      config.pitchMaxRadians,
    ),
  };
}

export function applyFirstPersonDesktopDragDelta(
  state: FirstPersonPlayerViewState,
  dragX: number,
  dragY: number,
  config: FirstPersonPlayerViewConfig =
    M07_FIRST_PERSON_VIEW_CONFIG,
): FirstPersonPlayerViewState {
  return applyFirstPersonLookDelta(
    state,
    -dragX,
    -dragY,
    config,
    config.mouseSensitivityRadiansPerPixel,
  );
}

export function applyFirstPersonTouchDragDelta(
  state: FirstPersonPlayerViewState,
  dragX: number,
  dragY: number,
  config: FirstPersonPlayerViewConfig =
    M07_MOBILE_FIRST_PERSON_VIEW_CONFIG,
): FirstPersonPlayerViewState {
  return applyFirstPersonLookDelta(
    state,
    -dragX,
    -dragY,
    config,
    config.touchSensitivityRadiansPerPixel,
  );
}

export function advanceFirstPersonPlayerView(
  state: FirstPersonPlayerViewState,
  input: FirstPersonPlayerViewInput,
  deltaSeconds: number,
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
): FirstPersonPlayerViewState {
  const dt = Math.max(0, deltaSeconds);
  const strafe = normalizedAxis(input.strafe);
  const forward = normalizedAxis(input.forward);
  const length = Math.hypot(strafe, forward);
  const scale = length > 1 ? 1 / length : 1;
  const step = config.moveSpeedMetersPerSecond * dt;

  const position = constrainPlayerPosition(
    state,
    {
      x: state.x + strafe * scale * step,
      z: state.z - forward * scale * step,
    },
    config,
  );

  return {
    ...state,
    x: position.x,
    z: position.z,
  };
}

export function playerCameraPosition(
  state: FirstPersonPlayerViewState,
): { x: number; y: number; z: number } {
  return {
    x: state.x,
    y: state.eyeY,
    z: state.z,
  };
}

export function computeLookAnglesToPoint(
  cameraPosition: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
): PlayerViewLookAngles {
  const dx = target.x - cameraPosition.x;
  const dy = target.y - cameraPosition.y;
  const dz = target.z - cameraPosition.z;
  const horizontal = Math.hypot(dx, dz);
  return {
    yawRadians: Math.atan2(-dx, -dz),
    pitchRadians: Math.atan2(dy, horizontal),
    distanceMeters: Math.hypot(horizontal, dy),
  };
}

export function findFocusedPlayerViewTarget(
  state: FirstPersonPlayerViewState,
  targets: readonly PlayerViewTarget[],
): PlayerViewFocus | null {
  const cameraPosition = playerCameraPosition(state);
  const cosPitch = Math.cos(state.pitchRadians);
  const forward = {
    x: -Math.sin(state.yawRadians) * cosPitch,
    y: Math.sin(state.pitchRadians),
    z: -Math.cos(state.yawRadians) * cosPitch,
  };

  let best: PlayerViewFocus | null = null;

  for (const target of targets) {
    const dx = target.position.x - cameraPosition.x;
    const dy = target.position.y - cameraPosition.y;
    const dz = target.position.z - cameraPosition.z;
    const distanceMeters = Math.hypot(dx, dy, dz);
    if (
      distanceMeters <= 1e-8 ||
      distanceMeters > target.maxDistanceMeters
    ) {
      continue;
    }

    const dot =
      (forward.x * dx + forward.y * dy + forward.z * dz) /
      distanceMeters;
    const angleRadians = Math.acos(clamp(dot, -1, 1));
    if (angleRadians > target.focusHalfAngleRadians) {
      continue;
    }

    if (!best || angleRadians < best.angleRadians) {
      best = {
        target,
        distanceMeters,
        angleRadians,
      };
    }
  }

  return best;
}

export function applyFirstPersonPlayerCamera(
  camera: THREE.PerspectiveCamera,
  state: FirstPersonPlayerViewState,
): void {
  const position = playerCameraPosition(state);
  camera.position.set(position.x, position.y, position.z);

  camera.rotation.order = "YXZ";
  camera.rotation.set(
    state.pitchRadians,
    state.yawRadians,
    0,
  );
}

export class FirstPersonPlayerViewController {
  private readonly pressed = new Set<string>();
  private state: FirstPersonPlayerViewState;
  private focus: PlayerViewFocus | null = null;
  private lastInteraction = "none";
  private readonly prompt: HTMLDivElement;
  private touchLookPointerId: number | null = null;
  private touchLookX = 0;
  private touchLookY = 0;
  private readonly touchPoints =
    new Map<number, { x: number; y: number }>();
  private pinchDistancePixels: number | null = null;
  private targetFovDegrees: number;
  private temporaryView:
    | {
        restoreState: FirstPersonPlayerViewState;
        view: TemporaryPlayerCameraView;
        restoreFovDegrees: number;
      }
    | null = null;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly element: HTMLElement,
    private readonly targets: readonly PlayerViewTarget[] =
      M07_CABINET_VIEW_TARGETS,
    private readonly onPrimaryAction?: () => boolean,
    private readonly config: FirstPersonPlayerViewConfig =
      M07_FIRST_PERSON_VIEW_CONFIG,
  ) {
    this.state = createFirstPersonPlayerViewState(config);
    this.targetFovDegrees =
      clampFirstPersonZoomFov(camera.fov);
    this.camera.fov = this.targetFovDegrees;
    this.camera.updateProjectionMatrix();
    applyFirstPersonPlayerCamera(camera, this.state);
    this.element.dataset.playerView = "active";

    this.prompt = document.createElement("div");
    this.prompt.className = "player-interaction-prompt";
    this.prompt.setAttribute("aria-live", "polite");
    this.element.parentElement?.append(this.prompt);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    element.addEventListener("click", this.onClick);
    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
    element.addEventListener(
      "wheel",
      this.onWheel,
      { passive: false },
    );
  }

  adjustZoom(direction: -1 | 1): void {
    if (this.temporaryView) {
      return;
    }
    this.targetFovDegrees =
      zoomFirstPersonFovByStep(
        this.targetFovDegrees,
        direction,
      );
  }

  adjustEyeHeight(deltaMeters: number): void {
    if (this.temporaryView) {
      return;
    }
    this.state = adjustFirstPersonEyeHeight(
      this.state,
      deltaMeters,
      this.config,
    );
    applyFirstPersonPlayerCamera(
      this.camera,
      this.state,
    );
  }

  setTemporaryCameraView(
    view: TemporaryPlayerCameraView | null,
  ): void {
    if (view) {
      if (!this.temporaryView) {
        this.temporaryView = {
          restoreState: { ...this.state },
          view,
          restoreFovDegrees:
            this.targetFovDegrees,
        };
        this.targetFovDegrees = Math.max(
          this.targetFovDegrees,
          M07_STAFF_VIEW_FOV_DEGREES,
        );
        this.pressed.clear();
        this.touchLookPointerId = null;
        this.touchPoints.clear();
        this.pinchDistancePixels = null;
      } else {
        this.temporaryView.view = view;
      }
      this.element.dataset.playerView = "staff-service";
      return;
    }

    if (!this.temporaryView) {
      return;
    }

    this.state = {
      ...this.temporaryView.restoreState,
    };
    this.targetFovDegrees =
      this.temporaryView.restoreFovDegrees;
    this.temporaryView = null;
    this.element.dataset.playerView = "active";
    applyFirstPersonPlayerCamera(
      this.camera,
      this.state,
    );
  }

  update(deltaSeconds: number): void {
    this.updateZoom(deltaSeconds);

    if (this.temporaryView) {
      const { position, target } =
        this.temporaryView.view;
      this.camera.position.set(
        position.x,
        position.y,
        position.z,
      );
      this.camera.lookAt(
        target.x,
        target.y,
        target.z,
      );
      this.focus = null;
      this.element.dataset.playerFocus = "staff";
      this.prompt.textContent = "";
      return;
    }
    this.state = advanceFirstPersonPlayerView(
      this.state,
      {
        strafe:
          (this.pressed.has("KeyD") ? 1 : 0) -
          (this.pressed.has("KeyA") ? 1 : 0),
        forward:
          (this.pressed.has("KeyW") ? 1 : 0) -
          (this.pressed.has("KeyS") ? 1 : 0),
      },
      Math.min(Math.max(deltaSeconds, 0), 0.05),
      this.config,
    );
    applyFirstPersonPlayerCamera(this.camera, this.state);
    this.focus = findFocusedPlayerViewTarget(
      this.state,
      this.targets,
    );
    this.element.dataset.playerFocus =
      this.focus?.target.id ?? "none";

    if (!this.focus) {
      this.prompt.textContent = "";
    } else if (this.focus.target.action === "primary") {
      this.prompt.textContent =
        "[F] " + this.focus.target.label;
    } else {
      this.prompt.textContent = this.focus.target.label;
    }
  }

  debugLines(): string[] {
    return [
      "Player view       WASD move / mouse-or-touch look / F action",
      `Player pos       lateral ${this.state.x.toFixed(3)} / depth ${this.state.z.toFixed(3)} m`,
      `Eye height       ${this.state.eyeY.toFixed(3)} m`,
      `Zoom FOV         ${this.camera.fov.toFixed(1)} deg`,
      `Head yaw/pitch   ${THREE.MathUtils.radToDeg(this.state.yawRadians).toFixed(1)} / ${THREE.MathUtils.radToDeg(this.state.pitchRadians).toFixed(1)} deg`,
      `View focus       ${this.focus?.target.id ?? "none"}`,
      `Interaction      ${this.lastInteraction}`,
      `Pointer look     ${document.pointerLockElement === this.element ? "LOCKED" : "click canvas"}`,
    ];
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.temporaryView) {
      return;
    }

    if (
      (event.code === "PageUp" ||
        event.code === "PageDown") &&
      !event.repeat
    ) {
      event.preventDefault();
      this.adjustEyeHeight(
        event.code === "PageUp"
          ? this.config.eyeHeightStepMeters
          : -this.config.eyeHeightStepMeters,
      );
      return;
    }

    if (
      !event.repeat &&
      (
        event.code === "Equal" ||
        event.code === "NumpadAdd" ||
        event.code === "Minus" ||
        event.code === "NumpadSubtract"
      )
    ) {
      event.preventDefault();
      const zoomIn =
        event.code === "Equal" ||
        event.code === "NumpadAdd";
      this.adjustZoom(zoomIn ? 1 : -1);
      return;
    }

    if (event.code === "KeyF" && !event.repeat) {
      if (this.onPrimaryAction) {
        const accepted = this.onPrimaryAction();
        this.lastInteraction =
          "F primary " + (accepted ? "ACCEPTED" : "blocked");
      }
      return;
    }

    if (
      event.code === "KeyW" ||
      event.code === "KeyA" ||
      event.code === "KeyS" ||
      event.code === "KeyD"
    ) {
      this.pressed.add(event.code);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (
      this.temporaryView ||
      document.pointerLockElement !== this.element
    ) {
      return;
    }

    this.state = applyFirstPersonDesktopDragDelta(
      this.state,
      event.movementX,
      event.movementY,
      this.config,
    );
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (
      this.temporaryView ||
      event.pointerType === "mouse"
    ) {
      return;
    }

    this.touchPoints.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    this.element.setPointerCapture?.(event.pointerId);

    if (this.touchPoints.size >= 2) {
      this.touchLookPointerId = null;
      this.pinchDistancePixels =
        this.currentPinchDistance();
    } else {
      this.touchLookPointerId = event.pointerId;
      this.touchLookX = event.clientX;
      this.touchLookY = event.clientY;
    }
    event.preventDefault();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (
      event.pointerType === "mouse" ||
      !this.touchPoints.has(event.pointerId)
    ) {
      return;
    }

    this.touchPoints.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (this.touchPoints.size >= 2) {
      const nextDistance =
        this.currentPinchDistance();
      if (
        nextDistance !== null &&
        this.pinchDistancePixels !== null
      ) {
        const delta =
          nextDistance - this.pinchDistancePixels;
        this.targetFovDegrees =
          clampFirstPersonZoomFov(
            this.targetFovDegrees -
              delta *
                M07_ZOOM_PINCH_DEGREES_PER_PIXEL,
          );
      }
      this.pinchDistancePixels = nextDistance;
      event.preventDefault();
      return;
    }

    if (
      this.touchLookPointerId !== event.pointerId
    ) {
      return;
    }

    const dx = event.clientX - this.touchLookX;
    const dy = event.clientY - this.touchLookY;
    this.touchLookX = event.clientX;
    this.touchLookY = event.clientY;
    this.state = applyFirstPersonTouchDragDelta(
      this.state,
      dx,
      dy,
      this.config,
    );
    event.preventDefault();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") {
      return;
    }

    this.touchPoints.delete(event.pointerId);
    this.pinchDistancePixels = null;

    const remaining =
      this.touchPoints.entries().next().value as
        | [number, { x: number; y: number }]
        | undefined;
    if (remaining) {
      const [pointerId, point] = remaining;
      this.touchLookPointerId = pointerId;
      this.touchLookX = point.x;
      this.touchLookY = point.y;
    } else {
      this.touchLookPointerId = null;
    }
    event.preventDefault();
  };

  private currentPinchDistance(): number | null {
    const points = Array.from(
      this.touchPoints.values(),
    );
    const first = points[0];
    const second = points[1];
    if (!first || !second) {
      return null;
    }
    return Math.hypot(
      second.x - first.x,
      second.y - first.y,
    );
  }

  private updateZoom(deltaSeconds: number): void {
    const dt = Math.min(
      Math.max(deltaSeconds, 0),
      0.05,
    );
    const blend =
      1 -
      Math.exp(
        -M07_ZOOM_SMOOTHING_PER_SECOND * dt,
      );
    const nextFov =
      this.camera.fov +
      (this.targetFovDegrees - this.camera.fov) *
        blend;

    if (Math.abs(nextFov - this.camera.fov) < 1e-4) {
      return;
    }

    this.camera.fov =
      Math.abs(
        this.targetFovDegrees - nextFov,
      ) < 0.01
        ? this.targetFovDegrees
        : nextFov;
    this.camera.updateProjectionMatrix();
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.temporaryView) {
      return;
    }

    const deltaPixels =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * window.innerHeight
          : event.deltaY;
    const boundedDelta =
      clamp(deltaPixels, -120, 120);

    this.targetFovDegrees =
      clampFirstPersonZoomFov(
        this.targetFovDegrees +
          boundedDelta *
            M07_ZOOM_WHEEL_DEGREES_PER_PIXEL,
      );
    event.preventDefault();
  };

  private readonly onClick = (): void => {
    if (
      matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0
    ) {
      return;
    }
    if (document.pointerLockElement !== this.element) {
      void this.element.requestPointerLock();
    }
  };
}
