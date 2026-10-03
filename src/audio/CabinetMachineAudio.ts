import {
  deriveMachineAudioFrame,
  type MachineAudioState,
  type MachineAudioTransient,
} from "./machineAudioState";

interface ContinuousMotor {
  oscillator: OscillatorNode;
  gain: GainNode;
}

function setParam(
  param: AudioParam,
  value: number,
  context: AudioContext,
  timeConstant = 0.025,
): void {
  param.cancelScheduledValues(context.currentTime);
  param.setTargetAtTime(
    value,
    context.currentTime,
    timeConstant,
  );
}

export class CabinetMachineAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private gantryMotor: ContinuousMotor | null = null;
  private reelMotor: ContinuousMotor | null = null;
  private previousState: MachineAudioState | null = null;

  public constructor(private readonly root: HTMLElement) {
    this.root.dataset.machineAudio = "armed";
  }

  public async unlock(): Promise<boolean> {
    if (typeof AudioContext === "undefined") {
      this.root.dataset.machineAudio = "unavailable";
      return false;
    }

    if (!this.context) {
      this.createGraph(new AudioContext());
    }

    if (!this.context) {
      return false;
    }

    if (this.context.state !== "running") {
      await this.context.resume();
    }

    const active = this.context.state === "running";
    this.root.dataset.machineAudio = active ? "active" : "suspended";
    return active;
  }

  public update(state: MachineAudioState): void {
    const frame = deriveMachineAudioFrame(
      this.previousState,
      state,
    );
    this.previousState = state;

    if (
      !this.context ||
      this.context.state !== "running" ||
      !this.gantryMotor ||
      !this.reelMotor
    ) {
      return;
    }

    setParam(
      this.gantryMotor.gain.gain,
      frame.gantryMotorLevel * 0.020,
      this.context,
    );
    setParam(
      this.gantryMotor.oscillator.frequency,
      frame.gantryMotorFrequencyHz,
      this.context,
      0.04,
    );

    setParam(
      this.reelMotor.gain.gain,
      frame.reelMotorLevel * 0.018,
      this.context,
    );
    setParam(
      this.reelMotor.oscillator.frequency,
      frame.reelMotorFrequencyHz,
      this.context,
      0.035,
    );

    for (const transient of frame.transients) {
      this.playTransient(transient);
    }
  }

  private createGraph(context: AudioContext): void {
    const masterGain = context.createGain();
    masterGain.gain.value = 0.55;
    masterGain.connect(context.destination);

    const gantryMotor = this.createContinuousMotor(
      context,
      masterGain,
      "sawtooth",
      82,
    );
    const reelMotor = this.createContinuousMotor(
      context,
      masterGain,
      "triangle",
      145,
    );

    this.context = context;
    this.masterGain = masterGain;
    this.gantryMotor = gantryMotor;
    this.reelMotor = reelMotor;
  }

  private createContinuousMotor(
    context: AudioContext,
    destination: AudioNode,
    type: OscillatorType,
    frequencyHz: number,
  ): ContinuousMotor {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequencyHz;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 0.7;

    const gain = context.createGain();
    gain.gain.value = 0;

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    oscillator.start();

    return { oscillator, gain };
  }

  private playTransient(
    transient: MachineAudioTransient,
  ): void {
    if (!this.context || !this.masterGain) {
      return;
    }

    const settings = {
      "drop-start": {
        type: "square" as OscillatorType,
        startHz: 115,
        endHz: 82,
        gain: 0.030,
        duration: 0.055,
      },
      "claw-close": {
        type: "triangle" as OscillatorType,
        startHz: 245,
        endHz: 165,
        gain: 0.040,
        duration: 0.075,
      },
      "claw-release": {
        type: "triangle" as OscillatorType,
        startHz: 155,
        endHz: 235,
        gain: 0.032,
        duration: 0.070,
      },
      "gantry-stop": {
        type: "square" as OscillatorType,
        startHz: 96,
        endHz: 70,
        gain: 0.024,
        duration: 0.045,
      },
    }[transient];

    const oscillator = this.context.createOscillator();
    oscillator.type = settings.type;

    const gain = this.context.createGain();
    const now = this.context.currentTime;
    const end = now + settings.duration;

    oscillator.frequency.setValueAtTime(
      settings.startHz,
      now,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      settings.endHz,
      end,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      settings.gain,
      now + 0.008,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      end,
    );

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(end + 0.01);
  }
}
