export interface FixedStepFrameResult {
  steps: number;
  alpha: number;
  droppedSeconds: number;
}

export class FixedStepLoop {
  private accumulatorSeconds = 0;

  constructor(
    readonly stepSeconds: number,
    readonly maxStepsPerFrame: number,
    readonly maxFrameDeltaSeconds: number,
  ) {
    if (stepSeconds <= 0) throw new Error("stepSeconds must be positive.");
    if (!Number.isInteger(maxStepsPerFrame) || maxStepsPerFrame < 1) {
      throw new Error("maxStepsPerFrame must be a positive integer.");
    }
    if (maxFrameDeltaSeconds <= 0) throw new Error("maxFrameDeltaSeconds must be positive.");
  }

  advance(frameDeltaSeconds: number, onStep: (stepSeconds: number) => void): FixedStepFrameResult {
    const safeFrameDelta = Number.isFinite(frameDeltaSeconds)
      ? Math.max(0, Math.min(frameDeltaSeconds, this.maxFrameDeltaSeconds))
      : 0;

    this.accumulatorSeconds += safeFrameDelta;

    let steps = 0;
    while (
      this.accumulatorSeconds + Number.EPSILON >= this.stepSeconds &&
      steps < this.maxStepsPerFrame
    ) {
      onStep(this.stepSeconds);
      this.accumulatorSeconds -= this.stepSeconds;
      steps += 1;
    }

    let droppedSeconds = 0;
    if (this.accumulatorSeconds >= this.stepSeconds) {
      const remainder = this.accumulatorSeconds % this.stepSeconds;
      droppedSeconds = this.accumulatorSeconds - remainder;
      this.accumulatorSeconds = remainder;
    }

    return {
      steps,
      alpha: this.accumulatorSeconds / this.stepSeconds,
      droppedSeconds,
    };
  }

  reset(): void {
    this.accumulatorSeconds = 0;
  }
}
