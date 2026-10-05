import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  M06_CABINET_CONFIG,
  createCabinetPhysics,
} from "../cabinet/cabinetGeometry";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { CabinetStaffServiceVisual } from "./CabinetStaffServiceVisual";

describe("M10 physical service door", () => {
  it("opens the real right-side collider and closes it before staff leaves", async () => {
    const physics = await PhysicsRuntime.create();
    const parts = createCabinetPhysics(physics);
    const scene = new THREE.Scene();
    const door = parts.serviceDoorBody;
    const closed = { ...door.translation() };
    const closedRotation = { ...door.rotation() };

    const visual = new CabinetStaffServiceVisual(
      scene,
      [],
      door,
      {
        x:
          M06_CABINET_CONFIG.interiorHalfX +
          M06_CABINET_CONFIG.wallHalfThickness,
        y: 0,
        z:
          -M06_CABINET_CONFIG.interiorHalfZ -
          M06_CABINET_CONFIG.wallHalfThickness * 2,
      },
    );

    expect(visual.characterVariant).toBe(
      "adult-female-arcade-attendant-v1",
    );
    expect(
      scene.getObjectByName(
        "adult-female-arcade-attendant-v1",
      ),
    ).toBeDefined();

    for (
      let tick = 0;
      tick < PHYSICS_HZ * 4;
      tick += 1
    ) {
      visual.update(
        true,
        false,
        1 / PHYSICS_HZ,
      );
      physics.step();
    }

    const opened = { ...door.translation() };
    const openedRotation = { ...door.rotation() };

    expect(visual.phase).toBe("door_open");
    expect(opened.x).toBeGreaterThan(
      closed.x + 0.20,
    );
    expect(Math.abs(opened.z - closed.z))
      .toBeGreaterThan(0.15);
    expect(Math.abs(openedRotation.y))
      .toBeGreaterThan(0.40);

    for (
      let tick = 0;
      tick < PHYSICS_HZ * 4;
      tick += 1
    ) {
      visual.update(
        true,
        true,
        1 / PHYSICS_HZ,
      );
      physics.step();
    }

    const returned = door.translation();
    const returnedRotation = door.rotation();

    expect(visual.phase).toBe("hidden");
    expect(returned.x).toBeCloseTo(
      closed.x,
      4,
    );
    expect(returned.y).toBeCloseTo(
      closed.y,
      4,
    );
    expect(returned.z).toBeCloseTo(
      closed.z,
      4,
    );
    expect(returnedRotation.x).toBeCloseTo(
      closedRotation.x,
      4,
    );
    expect(returnedRotation.y).toBeCloseTo(
      closedRotation.y,
      4,
    );
    expect(returnedRotation.z).toBeCloseTo(
      closedRotation.z,
      4,
    );
    expect(returnedRotation.w).toBeCloseTo(
      closedRotation.w,
      4,
    );
  }, 15_000);
});
