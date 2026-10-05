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
  it("moves the real right-side collider out of the cabinet opening", async () => {
    const physics = await PhysicsRuntime.create();
    const parts = createCabinetPhysics(physics);
    const scene = new THREE.Scene();
    const door = parts.serviceDoorBody;
    const closed = door.translation();

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

    for (
      let tick = 0;
      tick < PHYSICS_HZ * 4;
      tick += 1
    ) {
      visual.update(true, 1 / PHYSICS_HZ);
      physics.step();
    }

    const opened = door.translation();
    const rotation = door.rotation();

    expect(visual.phase).toBe("door_open");
    expect(opened.x).toBeGreaterThan(
      closed.x + 0.20,
    );
    expect(Math.abs(opened.z - closed.z))
      .toBeGreaterThan(0.15);
    expect(Math.abs(rotation.y))
      .toBeGreaterThan(0.40);
  }, 15_000);
});
