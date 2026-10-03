export type LayoutSettleStatus =
  | "SETTLING"
  | "READY"
  | "TIMEOUT_READY";

export interface LayoutBodyMotionSample {
  linearSpeedMetersPerSecond: number;
  angularSpeedRadiansPerSecond: number;
}

export interface LayoutSettleConfig {
  maxLinearSpeedMetersPerSecond: number;
  maxAngularSpeedRadiansPerSecond: number;
  requiredStableSeconds: number;
  timeoutSeconds: number;
}

export const M09_LAYOUT_SETTLE_CONFIG: LayoutSettleConfig = {
  maxLinearSpeedMetersPerSecond: 0.025,
  maxAngularSpeedRadiansPerSecond: 0.30,
  requiredStableSeconds: 0.30,
  timeoutSeconds: 2.50,
};

export class LayoutSettlePipeline {
  private elapsedSecondsValue = 0;
  private stableSecondsValue = 0;
  private statusValue: LayoutSettleStatus = "SETTLING";

  public constructor(
    private readonly config: LayoutSettleConfig =
      M09_LAYOUT_SETTLE_CONFIG,
  ) {}

  public get status(): LayoutSettleStatus {
    return this.statusValue;
  }

  public get ready(): boolean {
    return this.statusValue !== "SETTLING";
  }

  public get elapsedSeconds(): number {
    return this.elapsedSecondsValue;
  }

  public update(
    stepSeconds: number,
    samples: readonly LayoutBodyMotionSample[],
  ): LayoutSettleStatus {
    if (this.ready) {
      return this.statusValue;
    }

    const dt = Math.max(0, stepSeconds);
    this.elapsedSecondsValue += dt;

    const stable = samples.every(
      (sample) =>
        sample.linearSpeedMetersPerSecond <=
          this.config.maxLinearSpeedMetersPerSecond &&
        sample.angularSpeedRadiansPerSecond <=
          this.config.maxAngularSpeedRadiansPerSecond,
    );

    this.stableSecondsValue = stable
      ? this.stableSecondsValue + dt
      : 0;

    if (
      this.stableSecondsValue >=
      this.config.requiredStableSeconds
    ) {
      this.statusValue = "READY";
    } else if (
      this.elapsedSecondsValue >= this.config.timeoutSeconds
    ) {
      this.statusValue = "TIMEOUT_READY";
    }

    return this.statusValue;
  }
}
