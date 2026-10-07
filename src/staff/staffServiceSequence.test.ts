import { describe, expect, it } from "vitest";
import { ARCADE_NEIGHBOR_MACHINE_PLACEMENTS } from "../environment/arcadeEnvironment";
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

  it("slows visibly during the final approach to the cabinet", () => {
    const poseAt = (seconds: number) =>
      staffServicePose({
        phase: "approaching" as const,
        elapsedSeconds: seconds,
      });

    const middleA = poseAt(1.6);
    const middleB = poseAt(2.0);
    const lateA = poseAt(2.8);
    const lateB = poseAt(3.2);

    const middleTravel = Math.hypot(
      middleB.x - middleA.x,
      middleB.z - middleA.z,
    );
    const lateTravel = Math.hypot(
      lateB.x - lateA.x,
      lateB.z - lateA.z,
    );

    expect(lateTravel).toBeLessThan(
      middleTravel * 0.35,
    );
  });

  it("keeps the staff outside the cabinet at the service pose", () => {
    const state = {
      phase: "door_open" as const,
      elapsedSeconds:
        M10_STAFF_SERVICE_CONFIG.doorOpeningSeconds,
    };
    const pose = staffServicePose(state);

    expect(pose.x).toBeCloseTo(
      M10_STAFF_SERVICE_CONFIG.serviceX,
      8,
    );
    expect(pose.z).toBeCloseTo(
      M10_STAFF_SERVICE_CONFIG.serviceZ,
      8,
    );
    expect(pose.x).toBeGreaterThan(0.74);
    expect(pose.z).toBeGreaterThan(-0.12);
    expect(pose.z).toBeLessThan(-0.04);
    expect(
      Math.hypot(
        pose.x - 1.08,
        pose.z - 1.30,
      ),
    ).toBeGreaterThan(1.05);
  });
  it("keeps the full curved staff path clear of the right-side neighboring machines", () => {
    const rightMachines =
      ARCADE_NEIGHBOR_MACHINE_PLACEMENTS.filter(
        (machine) => machine.x > 0,
      );
    const sampleCount = 160;

    for (const machine of rightMachines) {
      let minimumClearance = Number.POSITIVE_INFINITY;

      for (
        let index = 0;
        index <= sampleCount;
        index += 1
      ) {
        const elapsedSeconds =
          M10_STAFF_SERVICE_CONFIG.approachSeconds *
          (index / sampleCount);
        const pose = staffServicePose({
          phase: "approaching",
          elapsedSeconds,
        });
        minimumClearance = Math.min(
          minimumClearance,
          Math.hypot(
            machine.x - pose.x,
            machine.z - pose.z,
          ),
        );
      }

      expect(minimumClearance).toBeGreaterThan(0.60);
    }
  });

});
