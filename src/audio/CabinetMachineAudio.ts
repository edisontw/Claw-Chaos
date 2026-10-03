import type { ContactAudioImpact } from "../physics/PhysicsRuntime";
import {
  deriveMachineAudioFrame,
  type MachineAudioState,
  type MachineAudioTransient,
} from "./machineAudioState";
import {
  derivePrizeImpactCue,
  type PrizeImpactFamily,
} from "./prizeImpactAudio";

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
  private impactNoiseBuffer: AudioBuffer | null = null;
  private previousState: MachineAudioState | null = null;
  private readonly lastImpactSeconds = new Map<
    PrizeImpactFamily,
    number
  >();

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

  public playPrizeImpacts(
    impacts: readonly ContactAudioImpact[],
  ): void {
    if (
      !this.context ||
      this.context.state !== "running" ||
      !this.masterGain ||
      !this.impactNoiseBuffer
    ) {
      return;
    }

    for (const impact of impacts) {
      const cue = derivePrizeImpactCue(impact);
      if (!cue) {
        continue;
      }

      const lastSeconds =
        this.lastImpactSeconds.get(cue.family) ??
        Number.NEGATIVE_INFINITY;
      const cooldownSeconds =
        cue.family === "plastic" ? 0.045 : 0.065;
      if (
        this.context.currentTime - lastSeconds <
        cooldownSeconds
      ) {
        continue;
      }

      this.lastImpactSeconds.set(
        cue.family,
        this.context.currentTime,
      );
      this.playPrizeImpactCue(cue);
    }
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
    this.impactNoiseBuffer = this.createImpactNoiseBuffer(
      context,
    );
  }

  private createImpactNoiseBuffer(
    context: AudioContext,
  ): AudioBuffer {
    const durationSeconds = 0.12;
    const sampleCount = Math.max(
      1,
      Math.round(
        context.sampleRate * durationSeconds,
      ),
    );
    const buffer = context.createBuffer(
      1,
      sampleCount,
      context.sampleRate,
    );
    const channel = buffer.getChannelData(0);

    let state = 0x6d2b79f5;
    for (let index = 0; index < channel.length; index += 1) {
      state = Math.imul(state ^ (state >>> 15), state | 1);
      state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
      const unit =
        ((state ^ (state >>> 14)) >>> 0) / 4294967296;
      channel[index] = unit * 2 - 1;
    }

    return buffer;
  }

  private playPrizeImpactCue(
    cue: NonNullable<
      ReturnType<typeof derivePrizeImpactCue>
    >,
  ): void {
    if (
      !this.context ||
      !this.masterGain ||
      !this.impactNoiseBuffer
    ) {
      return;
    }

    const now = this.context.currentTime;
    const end = now + cue.durationSeconds;

    const oscillator = this.context.createOscillator();
    oscillator.type = cue.oscillatorType;
    oscillator.frequency.setValueAtTime(
      cue.startFrequencyHz,
      now,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      cue.endFrequencyHz,
      end,
    );

    const oscillatorGain = this.context.createGain();
    oscillatorGain.gain.setValueAtTime(
      Math.max(0.0001, cue.oscillatorGain),
      now,
    );
    oscillatorGain.gain.exponentialRampToValueAtTime(
      0.0001,
      end,
    );
    oscillator.connect(oscillatorGain);
    oscillatorGain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(end + 0.01);

    const noise = this.context.createBufferSource();
    noise.buffer = this.impactNoiseBuffer;

    const noiseFilter = this.context.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = cue.noiseLowpassHz;

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(
      Math.max(0.0001, cue.noiseGain),
      now,
    );
    noiseGain.gain.exponentialRampToValueAtTime(
      0.0001,
      end,
    );

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(end + 0.01);
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
