import { describe, expect, it } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { CLAW_LAB_CONFIG, advanceMotorCommand } from "./clawLab";
import { M02_GANTRY_CONFIG } from "./gantryLab";
import {
  M04_PLAY_CONFIG,
  advanceM04PlayState,
  applyM04Action,
  createM04PlayState,
  m04FingerShouldClose,
  m04HoldBoostActive,
  m04ForcePhase,
  m04ReelCommand,
  type M04PlayState,
} from "./m04PlayCycle";
import { advanceReel, type ReelState } from "./reelMotion";

const dt = 1 / PHYSICS_HZ;
const reelConfig = {
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
  closeSettleSeconds: M04_PLAY_CONFIG.closeSettleSeconds,
  pickupLiftDistanceMeters: M04_PLAY_CONFIG.pickupLiftDistanceMeters,
  holdBoostDurationSeconds: M04_PLAY_CONFIG.holdBoostDurationSeconds,
  releaseCompletionToleranceRadians:
    M04_PLAY_CONFIG.releaseCompletionToleranceRadians,
};

function settleOpenCommand(): number {
  let command = 0;
  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    command = advanceMotorCommand(
      command,
      CLAW_LAB_CONFIG.openAngle,
      CLAW_LAB_CONFIG.motorSpeedRadiansPerSecond,
      dt,
    );
  }
  return command;
}

function stepCycle(
  state: M04PlayState,
  reel: ReelState,
  fingerCommand: number,
): {
  state: M04PlayState;
  reel: ReelState;
  fingerCommand: number;
} {
  const reelNext = advanceReel(
    reel,
    m04ReelCommand(state),
    reelConfig,
    dt,
  );

  let stateNext = advanceM04PlayState(
    state,
    {
      reelPayoutMeters: reelNext.payout,
      fingerCommandRadians: fingerCommand,
    },
    playConfig,
    0,
  );

  const target = m04FingerShouldClose(stateNext)
    ? CLAW_LAB_CONFIG.closedAngle
    : CLAW_LAB_CONFIG.openAngle;
  const fingerNext = advanceMotorCommand(
    fingerCommand,
    target,
    CLAW_LAB_CONFIG.motorSpeedRadiansPerSecond,
    dt,
  );

  stateNext = advanceM04PlayState(
    stateNext,
    {
      reelPayoutMeters: reelNext.payout,
      fingerCommandRadians: fingerNext,
    },
    playConfig,
    dt,
  );

  return {
    state: stateNext,
    reel: reelNext,
    fingerCommand: fingerNext,
  };
}

describe("M04 DROP / close / lift state machine", () => {
  it("turns the second action during descent into a timed EARLY CLOSE without stopping descent", () => {
    let state = applyM04Action(createM04PlayState(), 0);
    let reel: ReelState = { payout: 0, velocity: 0 };
    let fingerCommand = settleOpenCommand();

    expect(state.phase).toBe("DESCENDING");
    expect(fingerCommand).toBeCloseTo(CLAW_LAB_CONFIG.openAngle, 6);

    while (reel.payout < 0.10) {
      ({ state, reel, fingerCommand } = stepCycle(
        state,
        reel,
        fingerCommand,
      ));
    }

    const payoutAtAction = reel.payout;
    state = applyM04Action(state, reel.payout);

    expect(state.phase).toBe("CLOSING");
    expect(state.closeReason).toBe("EARLY");
    expect(state.closeStartPayoutMeters).toBeCloseTo(payoutAtAction, 8);
    expect(payoutAtAction).toBeLessThan(
      M04_PLAY_CONFIG.autoClosePayoutMeters,
    );

    const beforeCloseCommand = fingerCommand;
    ({ state, reel, fingerCommand } = stepCycle(
      state,
      reel,
      fingerCommand,
    ));

    expect(fingerCommand).toBeLessThan(beforeCloseCommand);
    expect(beforeCloseCommand - fingerCommand).toBeCloseTo(
      CLAW_LAB_CONFIG.motorSpeedRadiansPerSecond * dt,
      8,
    );
    expect(reel.payout).toBeGreaterThan(payoutAtAction);

    let closeTicks = 1;
    while (state.phase === "CLOSING" && closeTicks < PHYSICS_HZ * 2) {
      ({ state, reel, fingerCommand } = stepCycle(
        state,
        reel,
        fingerCommand,
      ));
      closeTicks += 1;
    }

    console.log("M04 early-close metrics", JSON.stringify({
      payoutAtAction,
      closeTicks,
      closeSeconds: closeTicks / PHYSICS_HZ,
      payoutAtCloseComplete: reel.payout,
      fingerCommand,
    }));

    expect(state.phase).toBe("CLOSED_AT_DEPTH");
    expect(closeTicks).toBeGreaterThan(40);
    expect(closeTicks).toBeLessThan(80);
    expect(reel.payout).toBeGreaterThan(payoutAtAction + 0.05);
    expect(fingerCommand).toBeLessThanOrEqual(
      CLAW_LAB_CONFIG.closedAngle +
        M04_PLAY_CONFIG.closeCompletionToleranceRadians,
    );
  });

  it("uses the configured travel threshold for AUTO CLOSE when no second action is pressed", () => {
    let state = applyM04Action(createM04PlayState(), 0);
    let reel: ReelState = { payout: 0, velocity: 0 };
    let fingerCommand = settleOpenCommand();
    let transitionPayout = 0;
    let transitionTick = 0;

    for (let tick = 1; tick <= PHYSICS_HZ * 4; tick += 1) {
      const previousPhase = state.phase;
      ({ state, reel, fingerCommand } = stepCycle(
        state,
        reel,
        fingerCommand,
      ));

      if (previousPhase === "DESCENDING" && state.phase === "CLOSING") {
        transitionPayout = reel.payout;
        transitionTick = tick;
        break;
      }
    }

    expect(state.phase).toBe("CLOSING");
    expect(state.closeReason).toBe("AUTO");
    expect(transitionPayout).toBeGreaterThanOrEqual(
      M04_PLAY_CONFIG.autoClosePayoutMeters,
    );
    expect(transitionPayout).toBeLessThanOrEqual(
      M02_GANTRY_CONFIG.reelMaxPayout,
    );

    let closeTicks = 0;
    while (state.phase === "CLOSING" && closeTicks < PHYSICS_HZ * 2) {
      ({ state, reel, fingerCommand } = stepCycle(
        state,
        reel,
        fingerCommand,
      ));
      closeTicks += 1;
    }

    console.log("M04 auto-close metrics", JSON.stringify({
      transitionPayout,
      transitionTick,
      closeTicks,
      closeSeconds: closeTicks / PHYSICS_HZ,
      finalPayout: reel.payout,
      fingerCommand,
    }));

    expect(state.phase).toBe("CLOSED_AT_DEPTH");
    expect(closeTicks).toBeGreaterThan(40);
    expect(reel.payout).toBeCloseTo(M02_GANTRY_CONFIG.reelMaxPayout, 4);
  });

  it("settles before physical LIFT, then switches PICKUP to RETAINING after 0.06 m of reel recovery", () => {
    let state = applyM04Action(createM04PlayState(), 0);
    let reel: ReelState = { payout: 0, velocity: 0 };
    let fingerCommand = settleOpenCommand();

    while (state.phase !== "CLOSED_AT_DEPTH") {
      ({ state, reel, fingerCommand } = stepCycle(
        state,
        reel,
        fingerCommand,
      ));
    }

    const closeCompletePayout = reel.payout;
    let settleTicks = 0;
    let minPayoutDuringSettle = reel.payout;
    let maxPayoutDuringSettle = reel.payout;

    while (state.phase === "CLOSED_AT_DEPTH") {
      ({ state, reel, fingerCommand } = stepCycle(
        state,
        reel,
        fingerCommand,
      ));
      settleTicks += 1;
      minPayoutDuringSettle = Math.min(minPayoutDuringSettle, reel.payout);
      maxPayoutDuringSettle = Math.max(maxPayoutDuringSettle, reel.payout);
    }

    expect(state.phase).toBe("PICKUP");
    expect(settleTicks).toBeGreaterThanOrEqual(
      Math.floor(M04_PLAY_CONFIG.closeSettleSeconds * PHYSICS_HZ),
    );
    expect(m04ForcePhase(state)).toBe("PICKUP");
    expect(state.pickupStartPayoutMeters).not.toBeNull();

    const pickupStartPayout = state.pickupStartPayoutMeters!;
    expect(pickupStartPayout).toBeGreaterThanOrEqual(closeCompletePayout);
    expect(maxPayoutDuringSettle - minPayoutDuringSettle).toBeLessThan(0.05);

    let pickupTicks = 0;
    while (state.phase === "PICKUP" && pickupTicks < PHYSICS_HZ * 2) {
      ({ state, reel, fingerCommand } = stepCycle(
        state,
        reel,
        fingerCommand,
      ));
      pickupTicks += 1;
    }

    const physicalLiftAtRetention = pickupStartPayout - reel.payout;

    console.log("M04 pickup-retaining metrics", JSON.stringify({
      closeCompletePayout,
      settleTicks,
      settleSeconds: settleTicks / PHYSICS_HZ,
      pickupStartPayout,
      pickupTicks,
      pickupSeconds: pickupTicks / PHYSICS_HZ,
      retainingStartPayout: reel.payout,
      physicalLiftAtRetention,
      finalFingerCommand: fingerCommand,
    }));

    expect(state.phase).toBe("RETAINING");
    expect(m04ForcePhase(state)).toBe("RETAINING");
    expect(physicalLiftAtRetention).toBeGreaterThanOrEqual(
      M04_PLAY_CONFIG.pickupLiftDistanceMeters,
    );
    expect(physicalLiftAtRetention).toBeLessThan(
      M04_PLAY_CONFIG.pickupLiftDistanceMeters + 0.005,
    );
    expect(reel.velocity).toBeLessThan(0);
    expect(fingerCommand).toBeCloseTo(CLAW_LAB_CONFIG.closedAngle, 6);
  });

  it("activates HOLD BOOST only while requested in RETAINING/RETURNING and exhausts its fixed budget", () => {
    let state: M04PlayState = {
      ...createM04PlayState(),
      phase: "RETAINING",
    };

    expect(m04HoldBoostActive(state, false, playConfig)).toBe(false);
    expect(m04HoldBoostActive(state, true, playConfig)).toBe(true);

    const steps = Math.ceil(
      M04_PLAY_CONFIG.holdBoostDurationSeconds / dt,
    ) + 2;

    for (let tick = 0; tick < steps; tick += 1) {
      state = advanceM04PlayState(
        state,
        {
          reelPayoutMeters: 0.15,
          fingerCommandRadians: CLAW_LAB_CONFIG.closedAngle,
          holdBoostRequested: true,
        },
        playConfig,
        dt,
      );
    }

    expect(state.holdBoostUsedSeconds).toBeCloseTo(
      M04_PLAY_CONFIG.holdBoostDurationSeconds,
      8,
    );
    expect(m04HoldBoostActive(state, true, playConfig)).toBe(false);

    const returning = {
      ...state,
      phase: "RETURNING" as const,
    };
    expect(m04HoldBoostActive(returning, true, playConfig)).toBe(false);

    const releasing = {
      ...createM04PlayState(),
      phase: "RELEASING" as const,
    };
    expect(m04HoldBoostActive(releasing, true, playConfig)).toBe(false);
  });
});
