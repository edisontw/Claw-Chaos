import { describe, expect, it } from "vitest";
import { LayoutSettlePipeline } from "./layoutSettle";

describe("M09 layout settle pipeline", () => {
  it("becomes ready only after a continuous stable window", () => {
    const pipeline = new LayoutSettlePipeline({
      maxLinearSpeedMetersPerSecond: 0.03,
      maxAngularSpeedRadiansPerSecond: 0.3,
      requiredStableSeconds: 0.3,
      timeoutSeconds: 2,
    });

    const stable = [{
      linearSpeedMetersPerSecond: 0.01,
      angularSpeedRadiansPerSecond: 0.1,
    }];

    expect(pipeline.update(0.1, stable)).toBe("SETTLING");
    expect(pipeline.update(0.1, stable)).toBe("SETTLING");
    expect(pipeline.update(0.1, stable)).toBe("READY");
  });

  it("resets the stable window when a prize is still moving", () => {
    const pipeline = new LayoutSettlePipeline({
      maxLinearSpeedMetersPerSecond: 0.03,
      maxAngularSpeedRadiansPerSecond: 0.3,
      requiredStableSeconds: 0.3,
      timeoutSeconds: 2,
    });

    const stable = [{
      linearSpeedMetersPerSecond: 0.01,
      angularSpeedRadiansPerSecond: 0.1,
    }];
    const moving = [{
      linearSpeedMetersPerSecond: 0.08,
      angularSpeedRadiansPerSecond: 0.1,
    }];

    pipeline.update(0.2, stable);
    expect(pipeline.update(0.1, moving)).toBe("SETTLING");
    expect(pipeline.update(0.2, stable)).toBe("SETTLING");
    expect(pipeline.update(0.1, stable)).toBe("READY");
  });

  it("fails open after the settle timeout instead of trapping controls", () => {
    const pipeline = new LayoutSettlePipeline({
      maxLinearSpeedMetersPerSecond: 0.03,
      maxAngularSpeedRadiansPerSecond: 0.3,
      requiredStableSeconds: 0.3,
      timeoutSeconds: 0.5,
    });

    const moving = [{
      linearSpeedMetersPerSecond: 0.2,
      angularSpeedRadiansPerSecond: 1.2,
    }];

    expect(pipeline.update(0.25, moving)).toBe("SETTLING");
    expect(pipeline.update(0.25, moving)).toBe("TIMEOUT_READY");
    expect(pipeline.ready).toBe(true);
  });
});
