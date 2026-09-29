import { describe, expect, it } from "vitest";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { readRigidBodyMassProperties } from "./RigidBodyMassPropertiesDebug";

describe("RigidBodyMassPropertiesDebug", () => {
  it("reports coincident origin and COM for a centered sphere", async () => {
    const physics = await PhysicsRuntime.create();
    const body = physics.createDynamicSphere(
      { x: 0.25, y: 1.0, z: -0.2 },
      0.05,
      0.2,
    );

    physics.step();

    const snapshot = readRigidBodyMassProperties(body);

    expect(snapshot.localCom.x).toBeCloseTo(0, 6);
    expect(snapshot.localCom.y).toBeCloseTo(0, 6);
    expect(snapshot.localCom.z).toBeCloseTo(0, 6);
    expect(snapshot.originToComDistance).toBeLessThan(1e-6);
  });

  it("uses Rapier's actual COM for an offset compound collider", async () => {
    const physics = await PhysicsRuntime.create();
    const body = physics.createDynamicCompound(
      { x: 1, y: 2, z: 3 },
      [
        {
          shape: "sphere",
          center: { x: 0.12, y: 0, z: 0 },
          radius: 0.05,
        },
      ],
      0.4,
    );

    physics.step();

    const snapshot = readRigidBodyMassProperties(body);

    expect(snapshot.localCom.x).toBeCloseTo(0.12, 5);
    expect(snapshot.localCom.y).toBeCloseTo(0, 5);
    expect(snapshot.localCom.z).toBeCloseTo(0, 5);
    expect(snapshot.worldCom.x - snapshot.origin.x).toBeCloseTo(0.12, 5);
    expect(snapshot.originToComDistance).toBeCloseTo(0.12, 5);
  });
});
