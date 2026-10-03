import * as THREE from "three";
import { M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";

export const M07_CAMERA_FOV_DEGREES = 50;
export const M07_MOBILE_CAMERA_FOV_DEGREES = 58;

export interface FirstPersonPlayerViewConfig {
  initialX: number;
  initialZ: number;
  initialYawRadians: number;
  initialPitchRadians: number;
  eyeY: number;
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

const cabinetOuterX =
  M06_CABINET_CONFIG.interiorHalfX +
  M06_CABINET_CONFIG.wallHalfThickness * 2;
const frontGlassOuterZ =
  M06_CABINET_CONFIG.interiorHalfZ +
  M06_CABINET_CONFIG.wallHalfThickness * 2;
const cabinetClearanceMeters = 0.10;

export const M07_FIRST_PERSON_VIEW_CONFIG: FirstPersonPlayerViewConfig = {
  initialX: 0,
  initialZ: 0.78,
  initialYawRadians: 0,
  initialPitchRadians: THREE.MathUtils.degToRad(-19),
  eyeY: 0.98,
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
    yawRadians: config.initialYawRadians,
    pitchRadians: config.initialPitchRadians,
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
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
): { x: number; y: number; z: number } {
  return {
    x: state.x,
    y: config.eyeY,
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
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
): PlayerViewFocus | null {
  const cameraPosition = playerCameraPosition(state, config);
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
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
): void {
  const position = playerCameraPosition(state, config);
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
    applyFirstPersonPlayerCamera(camera, this.state, config);
    this.element.dataset.playerView = "active";

    this.prompt = document.createElement("div");
    this.prompt.className = "player-interaction-prompt";
    this.prompt.setAttribute("aria-live", "polite");
    this.element.parentElement?.append(this.prompt);

    const reticle = document.createElement("div");
    reticle.className = "player-reticle";
    reticle.setAttribute("aria-hidden", "true");
    this.element.parentElement?.append(reticle);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    element.addEventListener("click", this.onClick);
    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
  }

  update(deltaSeconds: number): void {
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
    applyFirstPersonPlayerCamera(this.camera, this.state, this.config);
    this.focus = findFocusedPlayerViewTarget(
      this.state,
      this.targets,
      this.config,
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
      `Head yaw/pitch   ${THREE.MathUtils.radToDeg(this.state.yawRadians).toFixed(1)} / ${THREE.MathUtils.radToDeg(this.state.pitchRadians).toFixed(1)} deg`,
      `View focus       ${this.focus?.target.id ?? "none"}`,
      `Interaction      ${this.lastInteraction}`,
      `Pointer look     ${document.pointerLockElement === this.element ? "LOCKED" : "click canvas"}`,
    ];
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
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
    if (document.pointerLockElement !== this.element) {
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
    if (event.pointerType === "mouse") {
      return;
    }
    this.touchLookPointerId = event.pointerId;
    this.touchLookX = event.clientX;
    this.touchLookY = event.clientY;
    this.element.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (
      event.pointerType === "mouse" ||
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
    if (this.touchLookPointerId !== event.pointerId) {
      return;
    }
    this.touchLookPointerId = null;
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
