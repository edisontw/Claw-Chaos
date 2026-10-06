import { describe, expect, it } from "vitest";
import {
  M10_STAFF_SERVICE_CONFIG,
  advanceStaffServiceState,
  createStaffServiceState,
  staffServicePose,
} from "./staffServiceSequence";

describe("M10 staff service sequence", () => {
  it("does not start before the machine reaches service pause", () => {
    const initial = createStaffServiceState();
    const next = advanceStaffServiceState(
      initial,
      false,
      false,
      10,
    );

    expect(next).toEqual(initial);
    expect(staffServicePose(next).visible).toBe(false);
  });

  it("advances deterministically through approach, open, close and departure", () => {
    let state = createStaffServiceState();
    const dt = 1 / 120;

    state = advanceStaffServiceState(
      state,
      true,
      false,
      dt,
    );
    expect(state.phase).toBe("approaching");

    for (
      let seconds = 0;
      seconds <
      M10_STAFF_SERVICE_CONFIG.approachSeconds +
        0.02;
      seconds += dt
    ) {
      state = advanceStaffServiceState(
        state,
        true,
        false,
        dt,
      );
    }
    expect(state.phase).toBe("opening_door");

    for (
      let seconds = 0;
      seconds <
      M10_STAFF_SERVICE_CONFIG.doorOpeningSeconds +
        0.02;
      seconds += dt
    ) {
      state = advanceStaffServiceState(
        state,
        true,
        false,
        dt,
      );
    }
    expect(state.phase).toBe("door_open");
    expect(staffServicePose(state).doorOpenFraction)
      .toBe(1);

    state = advanceStaffServiceState(
      state,
      true,
      true,
      dt,
    );
    expect(state.phase).toBe("closing_door");

    for (
      let seconds = 0;
      seconds <
      M10_STAFF_SERVICE_CONFIG.doorClosingSeconds +
        0.02;
      seconds += dt
    ) {
      state = advanceStaffServiceState(
        state,
        true,
        true,
        dt,
      );
    }
    expect(state.phase).toBe("departing");
    expect(staffServicePose(state).doorOpenFraction)
      .toBe(0);

    for (
      let seconds = 0;
      seconds <
      M10_STAFF_SERVICE_CONFIG.departureSeconds +
        0.02;
      seconds += dt
    ) {
      state = advanceStaffServiceState(
        state,
        true,
        true,
        dt,
      );
    }
    expect(state.phase).toBe("hidden");
    expect(staffServicePose(state).visible).toBe(false);
  });

  it("keeps the staff outside the cabinet at the service pose", () => {
    const state = {
      phase: "door_open" as const,
      elapsedSeconds:
        M10_STAFF_SERVICE_CONFIG.doorOpeningSeconds,
    };
    const pose = staffServicePose(state);

    expect(pose.x).toBe(
      M10_STAFF_SERVICE_CONFIG.serviceX,
    );
    expect(pose.z).toBe(
      M10_STAFF_SERVICE_CONFIG.serviceZ,
    );
    expect(pose.x).toBeGreaterThan(0.70);
    expect(pose.z).toBeGreaterThan(0);
    expect(pose.z).toBeLessThan(0.20);
    expect(
      Math.hypot(
        pose.x - 1.08,
        pose.z - 1.30,
      ),
    ).toBeGreaterThan(1.10);
  });
});
