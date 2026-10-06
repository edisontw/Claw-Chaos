import type { ContactAudioImpact } from "../physics/PhysicsRuntime";
import type { CabinetRewardKind } from "../cabinet/cabinetRewardFeedback";
import { M08_ARCADE_AMBIENCE } from "./arcadeAmbience";
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
    this.root.dataset.arcadeAmbience = "armed";
    this.root.dataset.rewardAudio = "armed";
  }

  public async unlock(): Promise<boolean> {
    if (typeof AudioContext === "undefined") {
      this.root.dataset.machineAudio = "unavailable";
      this.root.dataset.arcadeAmbience = "unavailable";
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
    this.root.dataset.arcadeAmbience =
      active ? "active" : "suspended";
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

  public playRewardCue(
    kind: CabinetRewardKind,
  ): void {
    if (
      !this.context ||
      this.context.state !== "running" ||
      !this.masterGain
    ) {
      return;
    }

    const now = this.context.currentTime + 0.015;
    const notes =
      kind === "clear"
        ? [
            { hz: 523.25, at: 0.00, duration: 0.16, gain: 0.050 },
            { hz: 659.25, at: 0.14, duration: 0.16, gain: 0.052 },
            { hz: 783.99, at: 0.28, duration: 0.17, gain: 0.054 },
            { hz: 1046.50, at: 0.44, duration: 0.34, gain: 0.060 },
          ]
        : [
            { hz: 659.25, at: 0.00, duration: 0.13, gain: 0.044 },
            { hz: 783.99, at: 0.11, duration: 0.13, gain: 0.046 },
            { hz: 987.77, at: 0.22, duration: 0.22, gain: 0.050 },
          ];

    for (const note of notes) {
      this.playRewardTone(
        note.hz,
        now + note.at,
        note.duration,
        note.gain,
      );
    }

    this.root.dataset.lastRewardAudio = kind;
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

    this.createArcadeAmbience(context, masterGain);

    this.context = context;
    this.masterGain = masterGain;
    this.gantryMotor = gantryMotor;
    this.reelMotor = reelMotor;
    this.impactNoiseBuffer = this.createImpactNoiseBuffer(
      context,
    );
  }

  private createArcadeAmbience(
    context: AudioContext,
    destination: AudioNode,
  ): void {
    const humFundamental = context.createOscillator();
    humFundamental.type = "sine";
    humFundamental.frequency.value =
      M08_ARCADE_AMBIENCE.cabinetHumFundamentalHz;

    const humFundamentalGain = context.createGain();
    humFundamentalGain.gain.value =
      M08_ARCADE_AMBIENCE.cabinetHumFundamentalGain;
    humFundamental.connect(humFundamentalGain);
    humFundamentalGain.connect(destination);
    humFundamental.start();

    const humHarmonic = context.createOscillator();
    humHarmonic.type = "sine";
    humHarmonic.frequency.value =
      M08_ARCADE_AMBIENCE.cabinetHumHarmonicHz;

    const humHarmonicGain = context.createGain();
    humHarmonicGain.gain.value =
      M08_ARCADE_AMBIENCE.cabinetHumHarmonicGain;
    humHarmonic.connect(humHarmonicGain);
    humHarmonicGain.connect(destination);
    humHarmonic.start();

    const roomNoise = context.createBufferSource();
    roomNoise.buffer = this.createAmbientNoiseBuffer(context);
    roomNoise.loop = true;

    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value =
      M08_ARCADE_AMBIENCE.roomHighpassHz;
    highpass.Q.value = 0.35;

    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value =
      M08_ARCADE_AMBIENCE.roomLowpassHz;
    lowpass.Q.value = 0.45;

    const roomGain = context.createGain();
    roomGain.gain.value =
      M08_ARCADE_AMBIENCE.roomNoiseGain;

    const modulation = context.createOscillator();
    modulation.type = "sine";
    modulation.frequency.value =
      M08_ARCADE_AMBIENCE.roomModulationHz;

    const modulationGain = context.createGain();
    modulationGain.gain.value =
      M08_ARCADE_AMBIENCE.roomModulationDepth;

    modulation.connect(modulationGain);
    modulationGain.connect(roomGain.gain);

    roomNoise.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(roomGain);
    roomGain.connect(destination);

    roomNoise.start();
    modulation.start();
  }

  private createAmbientNoiseBuffer(
    context: AudioContext,
  ): AudioBuffer {
    const durationSeconds = 4;
    const sampleCount = Math.max(
      1,
      Math.round(context.sampleRate * durationSeconds),
    );
    const buffer = context.createBuffer(
      1,
      sampleCount,
      context.sampleRate,
    );
    const channel = buffer.getChannelData(0);

    let state = 0x243f6a88;
    let smoothed = 0;
    for (let index = 0; index < channel.length; index += 1) {
      state = Math.imul(state ^ (state >>> 15), state | 1);
      state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
      const unit =
        ((state ^ (state >>> 14)) >>> 0) / 4294967296;
      const white = unit * 2 - 1;
      smoothed += (white - smoothed) * 0.18;
      channel[index] = white * 0.34 + smoothed * 0.66;
    }

    return buffer;
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

  private playRewardTone(
    frequencyHz: number,
    startSeconds: number,
    durationSeconds: number,
    peakGain: number,
  ): void {
    if (!this.context || !this.masterGain) {
      return;
    }

    const oscillator = this.context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(
      frequencyHz,
      startSeconds,
    );

    const gain = this.context.createGain();
    const endSeconds =
      startSeconds + durationSeconds;
    gain.gain.setValueAtTime(0.0001, startSeconds);
    gain.gain.exponentialRampToValueAtTime(
      peakGain,
      startSeconds + 0.018,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      endSeconds,
    );

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(startSeconds);
    oscillator.stop(endSeconds + 0.02);
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
