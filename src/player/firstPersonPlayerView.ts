import * as THREE from "three";
import { M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";

export interface FirstPersonPlayerViewConfig {
  initialX: number;
  initialZ: number;
  eyeY: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  yawLimitRadians: number;
  pitchMinRadians: number;
  pitchMaxRadians: number;
  moveSpeedMetersPerSecond: number;
  mouseSensitivityRadiansPerPixel: number;
  maxLeanMeters: number;
  leanSpeedMetersPerSecond: number;
  maxLeanRollRadians: number;
}

export interface FirstPersonPlayerViewState {
  x: number;
  z: number;
  yawRadians: number;
  pitchRadians: number;
  leanMeters: number;
}

export interface FirstPersonPlayerViewInput {
  strafe: number;
  forward: number;
  lean: number;
}

const frontGlassOuterZ =
  M06_CABINET_CONFIG.interiorHalfZ +
  M06_CABINET_CONFIG.wallHalfThickness * 2;

export const M07_FIRST_PERSON_VIEW_CONFIG: FirstPersonPlayerViewConfig = {
  initialX: 0,
  initialZ: 0.68,
  eyeY: 0.98,
  minX: -0.62,
  maxX: 0.62,
  minZ: frontGlassOuterZ + 0.10,
  maxZ: 0.82,
  yawLimitRadians: THREE.MathUtils.degToRad(105),
  pitchMinRadians: THREE.MathUtils.degToRad(-40),
  pitchMaxRadians: THREE.MathUtils.degToRad(30),
  moveSpeedMetersPerSecond: 0.55,
  mouseSensitivityRadiansPerPixel: 0.0022,
  maxLeanMeters: 0.055,
  leanSpeedMetersPerSecond: 0.28,
  maxLeanRollRadians: THREE.MathUtils.degToRad(4),
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function moveToward(
  current: number,
  target: number,
  maxDelta: number,
): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }
  return current + Math.sign(target - current) * maxDelta;
}

function normalizedAxis(value: number): number {
  return clamp(value, -1, 1);
}

export function createFirstPersonPlayerViewState(
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
): FirstPersonPlayerViewState {
  return {
    x: config.initialX,
    z: config.initialZ,
    yawRadians: 0,
    pitchRadians: 0,
    leanMeters: 0,
  };
}

export function applyFirstPersonLookDelta(
  state: FirstPersonPlayerViewState,
  movementX: number,
  movementY: number,
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
): FirstPersonPlayerViewState {
  return {
    ...state,
    yawRadians: clamp(
      state.yawRadians -
        movementX * config.mouseSensitivityRadiansPerPixel,
      -config.yawLimitRadians,
      config.yawLimitRadians,
    ),
    pitchRadians: clamp(
      state.pitchRadians -
        movementY * config.mouseSensitivityRadiansPerPixel,
      config.pitchMinRadians,
      config.pitchMaxRadians,
    ),
  };
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

  const nextX = clamp(
    state.x + strafe * scale * step,
    config.minX,
    config.maxX,
  );
  const nextZ = clamp(
    state.z - forward * scale * step,
    config.minZ,
    config.maxZ,
  );
  const leanTarget =
    normalizedAxis(input.lean) * config.maxLeanMeters;

  return {
    ...state,
    x: nextX,
    z: nextZ,
    leanMeters: moveToward(
      state.leanMeters,
      leanTarget,
      config.leanSpeedMetersPerSecond * dt,
    ),
  };
}

export function applyFirstPersonPlayerCamera(
  camera: THREE.PerspectiveCamera,
  state: FirstPersonPlayerViewState,
  config: FirstPersonPlayerViewConfig = M07_FIRST_PERSON_VIEW_CONFIG,
): void {
  camera.position.set(
    state.x + state.leanMeters,
    config.eyeY,
    state.z,
  );

  const leanFraction =
    config.maxLeanMeters > 0
      ? state.leanMeters / config.maxLeanMeters
      : 0;
  camera.rotation.order = "YXZ";
  camera.rotation.set(
    state.pitchRadians,
    state.yawRadians,
    -leanFraction * config.maxLeanRollRadians,
  );
}

export class FirstPersonPlayerViewController {
  private readonly pressed = new Set<string>();
  private state: FirstPersonPlayerViewState;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly element: HTMLElement,
    private readonly config: FirstPersonPlayerViewConfig =
      M07_FIRST_PERSON_VIEW_CONFIG,
  ) {
    this.state = createFirstPersonPlayerViewState(config);
    applyFirstPersonPlayerCamera(camera, this.state, config);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    element.addEventListener("click", this.onClick);
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
        lean:
          (this.pressed.has("KeyE") ? 1 : 0) -
          (this.pressed.has("KeyQ") ? 1 : 0),
      },
      Math.min(Math.max(deltaSeconds, 0), 0.05),
      this.config,
    );
    applyFirstPersonPlayerCamera(this.camera, this.state, this.config);
  }

  debugLines(): string[] {
    return [
      "Player view       WASD move / mouse look / Q-E lean",
      `Player X/Z       ${this.state.x.toFixed(3)} / ${this.state.z.toFixed(3)} m`,
      `Head yaw/pitch   ${THREE.MathUtils.radToDeg(this.state.yawRadians).toFixed(1)} / ${THREE.MathUtils.radToDeg(this.state.pitchRadians).toFixed(1)} deg`,
      `Lean             ${(this.state.leanMeters * 1000).toFixed(0)} mm`,
      `Pointer look     ${document.pointerLockElement === this.element ? "LOCKED" : "click canvas"}`,
    ];
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code === "KeyW" ||
      event.code === "KeyA" ||
      event.code === "KeyS" ||
      event.code === "KeyD" ||
      event.code === "KeyQ" ||
      event.code === "KeyE"
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

    this.state = applyFirstPersonLookDelta(
      this.state,
      event.movementX,
      event.movementY,
      this.config,
    );
  };

  private readonly onClick = (): void => {
    if (document.pointerLockElement !== this.element) {
      void this.element.requestPointerLock();
    }
  };
}
