import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import {
  CLAW_LAB_CONFIG,
  advanceMotorCommand,
} from "./clawLab";
import {
  M02_GANTRY_CONFIG,
} from "./gantryLab";
import {
  advanceGantryMotion,
  advanceGantryMotionTowardPosition,
  isGantryAxisAtTarget,
  type GantryMotionConfig,
  type GantryMotionState,
} from "./gantryMotion";
import {
  M04_PLAY_CONFIG,
  advanceM04PlayState,
  createM04PlayState,
  m04FingerShouldClose,
  m04ReelCommand,
  type M04PlayState,
} from "./m04PlayCycle";
import {
  advanceReel,
  type ReelConfig,
  type ReelState,
} from "./reelMotion";

const dt = 1 / PHYSICS_HZ;

const motionConfig: GantryMotionConfig = {
  x: {
    minPosition: M02_GANTRY_CONFIG.xMin,
    maxPosition: M02_GANTRY_CONFIG.xMax,
    maxSpeed: M02_GANTRY_CONFIG.maxSpeed,
    acceleration: M02_GANTRY_CONFIG.acceleration,
    braking: M02_GANTRY_CONFIG.braking,
  },
  z: {
    minPosition: M02_GANTRY_CONFIG.zMin,
    maxPosition: M02_GANTRY_CONFIG.zMax,
    maxSpeed: M02_GANTRY_CONFIG.maxSpeed,
    acceleration: M02_GANTRY_CONFIG.acceleration,
    braking: M02_GANTRY_CONFIG.braking,
  },
};

const reelConfig: ReelConfig = {
  minPayout: M02_GANTRY_CONFIG.reelMinPayout,
  maxPayout: M02_GANTRY_CONFIG.reelMaxPayout,
  maxSpeed: M02_GANTRY_CONFIG.reelMaxSpeed,
  acceleration: M02_GANTRY_CONFIG.reelAcceleration,
  braking: M02_GANTRY_CONFIG.reelBraking,
};

const playConfig = {
  autoClosePayoutMeters: M04_PLAY_CONFIG.autoClosePayoutMeters,
  closedAngleRadians: CLAW_LAB_CONFIG.closedAngle,
  openAngleRadians: CLAW_LAB_CONFIG.openAngle,
  closeCompletionToleranceRadians:
    M04_PLAY_CONFIG.closeCompletionToleranceRadians,
  releaseCompletionToleranceRadians:
    M04_PLAY_CONFIG.releaseCompletionToleranceRadians,
  closeSettleSeconds: M04_PLAY_CONFIG.closeSettleSeconds,
  pickupLiftDistanceMeters:
    M04_PLAY_CONFIG.pickupLiftDistanceMeters,
  holdBoostDurationSeconds:
    M04_PLAY_CONFIG.holdBoostDurationSeconds,
};

describe("M04 top-return-release lifecycle", () => {
  it("physically reaches the reel top, returns the carriage home, opens, then becomes READY", () => {
    let state: M04PlayState = {
      ...createM04PlayState(),
      phase: "RETAINING",
      closeReason: "AUTO",
      closeStartPayoutMeters: 0.275,
      pickupStartPayoutMeters: 0.28,
      retainingStartPayoutMeters: 0.219,
    };
    let reel: ReelState = {
      payout: 0.12,
      velocity: -0.16,
    };
    let motion: GantryMotionState = {
      x: { position: 0.22, velocity: 0.08 },
      z: { position: -0.16, velocity: -0.05 },
    };
    let fingerCommand = CLAW_LAB_CONFIG.closedAngle;

    let returningTick = -1;
    let releasingTick = -1;
    let readyTick = -1;
    let payoutAtReturn = Number.NaN;
    let homeErrorAtRelease = Number.NaN;
    let fingerAtReleaseStart = Number.NaN;

    for (let tick = 1; tick <= PHYSICS_HZ * 8; tick += 1) {
      reel = advanceReel(
        reel,
        m04ReelCommand(state),
        reelConfig,
        dt,
      );

      const reelAtTop =
        reel.payout <= M02_GANTRY_CONFIG.reelMinPayout + 1e-5 &&
        Math.abs(reel.velocity) < 1e-4;

      const beforeTopTransition = state.phase;
      state = advanceM04PlayState(
        state,
        {
          reelPayoutMeters: reel.payout,
          fingerCommandRadians: fingerCommand,
          reelAtTop,
        },
        playConfig,
        0,
      );

      if (
        beforeTopTransition !== "RETURNING" &&
        state.phase === "RETURNING" &&
        returningTick < 0
      ) {
        returningTick = tick;
        payoutAtReturn = reel.payout;
      }

      if (state.phase === "RETURNING") {
        motion = advanceGantryMotionTowardPosition(
          motion,
          M02_GANTRY_CONFIG.homeX,
          M02_GANTRY_CONFIG.homeZ,
          motionConfig,
          dt,
        );
      } else {
        motion = advanceGantryMotion(
          motion,
          0,
          0,
          motionConfig,
          dt,
        );
      }

      const tolerance = {
        position: M02_GANTRY_CONFIG.homePositionTolerance,
        velocity: M02_GANTRY_CONFIG.homeVelocityTolerance,
      };
      const homeReached =
        isGantryAxisAtTarget(
          motion.x,
          M02_GANTRY_CONFIG.homeX,
          tolerance,
        ) &&
        isGantryAxisAtTarget(
          motion.z,
          M02_GANTRY_CONFIG.homeZ,
          tolerance,
        );

      const beforeHomeTransition = state.phase;
      state = advanceM04PlayState(
        state,
        {
          reelPayoutMeters: reel.payout,
          fingerCommandRadians: fingerCommand,
          reelAtTop,
          homeReached,
        },
        playConfig,
        0,
      );

      if (
        beforeHomeTransition === "RETURNING" &&
        state.phase === "RELEASING" &&
        releasingTick < 0
      ) {
        releasingTick = tick;
        homeErrorAtRelease = Math.hypot(
          motion.x.position - M02_GANTRY_CONFIG.homeX,
          motion.z.position - M02_GANTRY_CONFIG.homeZ,
        );
        fingerAtReleaseStart = fingerCommand;
      }

      const fingerTarget = m04FingerShouldClose(state)
        ? CLAW_LAB_CONFIG.closedAngle
        : CLAW_LAB_CONFIG.openAngle;
      fingerCommand = advanceMotorCommand(
        fingerCommand,
        fingerTarget,
        CLAW_LAB_CONFIG.motorSpeedRadiansPerSecond,
        dt,
      );

      state = advanceM04PlayState(
        state,
        {
          reelPayoutMeters: reel.payout,
          fingerCommandRadians: fingerCommand,
          reelAtTop,
          homeReached,
        },
        playConfig,
        dt,
      );

      if (state.phase === "READY") {
        readyTick = tick;
        break;
      }
    }

    const releaseTicks =
      releasingTick >= 0 && readyTick >= 0
        ? readyTick - releasingTick + 1
        : -1;

    console.log(
      "M04 lifecycle metrics",
      JSON.stringify({
        returningTick,
        releasingTick,
        readyTick,
        releaseTicks,
        releaseSeconds:
          releaseTicks > 0 ? releaseTicks / PHYSICS_HZ : null,
        payoutAtReturn,
        homeErrorAtRelease,
        fingerAtReleaseStart,
        finalFingerCommand: fingerCommand,
        finalPayout: reel.payout,
        finalX: motion.x.position,
        finalZ: motion.z.position,
      }),
    );

    expect(returningTick).toBeGreaterThan(0);
    expect(payoutAtReturn).toBeCloseTo(
      M02_GANTRY_CONFIG.reelMinPayout,
      6,
    );
    expect(releasingTick).toBeGreaterThan(returningTick);
    expect(homeErrorAtRelease).toBeLessThanOrEqual(
      M02_GANTRY_CONFIG.homePositionTolerance * Math.SQRT2,
    );
    expect(fingerAtReleaseStart).toBeCloseTo(
      CLAW_LAB_CONFIG.closedAngle,
      6,
    );
    expect(releaseTicks).toBeGreaterThan(40);
    expect(readyTick).toBeGreaterThan(releasingTick);
    expect(fingerCommand).toBeGreaterThanOrEqual(
      CLAW_LAB_CONFIG.openAngle -
        M04_PLAY_CONFIG.releaseCompletionToleranceRadians,
    );
    expect(reel.payout).toBeCloseTo(
      M02_GANTRY_CONFIG.reelMinPayout,
      6,
    );
    expect(state.phase).toBe("READY");
  });
});
