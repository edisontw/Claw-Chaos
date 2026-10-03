import type { ContactAudioImpact } from "../physics/PhysicsRuntime";
import {
  deriveMachineAudioFrame,
  type MachineAudioState,
  type MachineAudioTransient,
} from "../audio/machineAudioState";

export type CabinetHapticCue =
  | MachineAudioTransient
  | "prize-impact";

export interface CabinetHapticPulse {
  durationMilliseconds: number;
  weakMagnitude: number;
  strongMagnitude: number;
}

interface DualRumbleActuator {
  playEffect?: (
    type: "dual-rumble",
    params: {
      duration: number;
      startDelay: number;
      weakMagnitude: number;
      strongMagnitude: number;
    },
  ) => Promise<unknown>;
  pulse?: (
    value: number,
    duration: number,
  ) => Promise<boolean> | boolean;
}

interface HapticGamepadExtras {
  hapticActuators?: readonly DualRumbleActuator[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function deriveCabinetHapticPulse(
  cue: CabinetHapticCue,
  intensity = 1,
): CabinetHapticPulse {
  const scaled = clamp01(intensity);

  const base: Record<CabinetHapticCue, CabinetHapticPulse> = {
    "drop-start": {
      durationMilliseconds: 26,
      weakMagnitude: 0.20,
      strongMagnitude: 0.08,
    },
    "claw-close": {
      durationMilliseconds: 42,
      weakMagnitude: 0.34,
      strongMagnitude: 0.20,
    },
    "claw-release": {
      durationMilliseconds: 30,
      weakMagnitude: 0.24,
      strongMagnitude: 0.12,
    },
    "gantry-stop": {
      durationMilliseconds: 18,
      weakMagnitude: 0.16,
      strongMagnitude: 0.06,
    },
    "prize-impact": {
      durationMilliseconds: 34,
      weakMagnitude: 0.30,
      strongMagnitude: 0.18,
    },
  };

  const pulse = base[cue];
  return {
    durationMilliseconds: pulse.durationMilliseconds,
    weakMagnitude: pulse.weakMagnitude * scaled,
    strongMagnitude: pulse.strongMagnitude * scaled,
  };
}

export function derivePrizeImpactHapticIntensity(
  impacts: readonly ContactAudioImpact[],
): number {
  if (impacts.length === 0) {
    return 0;
  }

  const strongestForce = Math.max(
    ...impacts.map((impact) => impact.forceNewtons),
  );
  return clamp01((strongestForce - 2) / 12);
}

export class CabinetHaptics {
  private previousMachineState: MachineAudioState | null = null;
  private lastPulseMilliseconds = Number.NEGATIVE_INFINITY;

  public constructor(private readonly root: HTMLElement) {
    this.root.dataset.controllerHaptics = "armed";
  }

  public updateMachineState(state: MachineAudioState): void {
    const frame = deriveMachineAudioFrame(
      this.previousMachineState,
      state,
    );
    this.previousMachineState = state;

    for (const transient of frame.transients) {
      this.pulse(transient);
    }
  }

  public playPrizeImpacts(
    impacts: readonly ContactAudioImpact[],
  ): void {
    const intensity =
      derivePrizeImpactHapticIntensity(impacts);
    if (intensity <= 0) {
      return;
    }
    this.pulse("prize-impact", intensity);
  }

  private pulse(
    cue: CabinetHapticCue,
    intensity = 1,
  ): void {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.getGamepads !== "function"
    ) {
      return;
    }

    const now = performance.now();
    if (now - this.lastPulseMilliseconds < 16) {
      return;
    }

    const pulse = deriveCabinetHapticPulse(cue, intensity);
    const gamepads = navigator.getGamepads();

    for (const gamepad of gamepads) {
      if (!gamepad?.connected) {
        continue;
      }

      const hapticGamepad =
        gamepad as Gamepad & HapticGamepadExtras;
      const actuators: DualRumbleActuator[] = [];
      const vibrationActuator =
        gamepad.vibrationActuator as unknown as DualRumbleActuator;

      if (vibrationActuator) {
        actuators.push(vibrationActuator);
      }
      if (hapticGamepad.hapticActuators) {
        actuators.push(...hapticGamepad.hapticActuators);
      }

      for (const actuator of actuators) {
        if (typeof actuator.playEffect === "function") {
          void actuator
            .playEffect("dual-rumble", {
              duration: pulse.durationMilliseconds,
              startDelay: 0,
              weakMagnitude: pulse.weakMagnitude,
              strongMagnitude: pulse.strongMagnitude,
            })
            .catch(() => undefined);
        } else if (typeof actuator.pulse === "function") {
          const magnitude = Math.max(
            pulse.weakMagnitude,
            pulse.strongMagnitude,
          );
          try {
            const result = actuator.pulse(
              magnitude,
              pulse.durationMilliseconds,
            );
            if (
              result &&
              typeof (result as Promise<boolean>).catch === "function"
            ) {
              void (result as Promise<boolean>).catch(
                () => undefined,
              );
            }
          } catch {
            // Haptics are optional enhancement only.
          }
        }
      }

      if (actuators.length > 0) {
        this.root.dataset.controllerHaptics = "active";
        this.lastPulseMilliseconds = now;
      }
    }
  }
}
