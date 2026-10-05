import { describe, expect, it } from "vitest";
import {
  M10_STAFF_SERVICE_CONFIG,
  advanceStaffServiceState,
  createStaffServiceState,
  staffServicePose,
} from "./staffServiceSequence";

describe("M10 staff approach and service-door sequence", () => {
  it("does not start before the machine reaches service pause", () => {
    const initial = createStaffServiceState();
    const next = advanceStaffServiceState(
      initial,
      false,
      10,
    );

    expect(next).toEqual(initial);
    expect(staffServicePose(next).visible).toBe(false);
  });

  it("advances deterministically from approach to door-open", () => {
    let state = createStaffServiceState();

    state = advanceStaffServiceState(
      state,
      true,
      1 / 120,
    );
    expect(state.phase).toBe("approaching");
    expect(staffServicePose(state).visible).toBe(true);

    for (
      let seconds = 0;
      seconds <
      M10_STAFF_SERVICE_CONFIG.approachSeconds + 0.02;
      seconds += 1 / 120
    ) {
      state = advanceStaffServiceState(
        state,
        true,
        1 / 120,
      );
    }

    expect(state.phase).toBe("opening_door");
    expect(staffServicePose(state).doorOpenFraction)
      .toBeGreaterThanOrEqual(0);
    expect(staffServicePose(state).doorOpenFraction)
      .toBeLessThan(0.1);

    for (
      let seconds = 0;
      seconds <
      M10_STAFF_SERVICE_CONFIG.doorOpeningSeconds + 0.02;
      seconds += 1 / 120
    ) {
      state = advanceStaffServiceState(
        state,
        true,
        1 / 120,
      );
    }

    expect(state.phase).toBe("door_open");
    expect(staffServicePose(state).doorOpenFraction).toBe(1);
  });

  it("ends beside the cabinet rather than inside it", () => {
    let state = createStaffServiceState();
    state = {
      phase: "door_open",
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
    expect(pose.x).toBeGreaterThan(0.46);
    expect(pose.z).toBeGreaterThan(0.36);
  });
});
