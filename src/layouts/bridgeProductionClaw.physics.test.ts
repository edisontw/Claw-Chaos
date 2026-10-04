import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createCabinetLabScene } from "../scenes/cabinetLab";

const dt = 1 / PHYSICS_HZ;

function angularDistance(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
): number {
  const dot = Math.abs(
    a.x * b.x +
      a.y * b.y +
      a.z * b.z +
      a.w * b.w,
  );
  return 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

async function simulateOneProductionPlay(
  targetX: number,
  targetZ: number,
): Promise<{
  targetX: number;
  targetZ: number;
  baselineX: number;
  baselineY: number;
  baselineZ: number;
  finalX: number;
  finalY: number;
  finalZ: number;
  horizontalTravelMeters: number;
  rotationTravelRadians: number;
  maxLiftMeters: number;
  completedCycle: boolean;
}> {
  vi.stubGlobal("window", {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });

  const physics = await PhysicsRuntime.create();
  const renderScene = new THREE.Scene();
  const scene = createCabinetLabScene(
    renderScene,
    physics,
    {
      layoutId: "bridge",
      layoutSeed: "production-claw-closure",
    },
  );

  const beamTarget = scene.massPropertiesDebugTargets?.find(
    (target) => target.label === "prize/box_flat",
  );
  if (!beamTarget) {
    throw new Error("bridge beam debug target not found");
  }
  const carriage = scene.bindings[0]?.body;
  if (!carriage) {
    throw new Error("production carriage binding not found");
  }

  const step = (): void => {
    scene.beforePhysicsStep?.(dt);
    physics.step();
  };

  for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
    step();
  }

  for (let tick = 0; tick < PHYSICS_HZ * 6; tick += 1) {
    const position = carriage.translation();
    const dx = targetX - position.x;
    const dz = targetZ - position.z;
    const distance = Math.hypot(dx, dz);
    const velocity = carriage.linvel();
    const speed = Math.hypot(velocity.x, velocity.z);

    if (distance < 0.004 && speed < 0.020) {
      scene.setManualGantryInput?.(0, 0);
      break;
    }

    scene.setManualGantryInput?.(
      clampUnit(dx / 0.06),
      clampUnit(dz / 0.06),
    );
    step();
  }

  scene.setManualGantryInput?.(0, 0);
  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    step();
  }

  const baselinePosition = beamTarget.body.translation();
  const baselineRotation = beamTarget.body.rotation();
  let maxBeamY = baselinePosition.y;

  const started = scene.primaryAction?.() ?? false;
  expect(started).toBe(true);

  let completedCycle = false;
  let sawActivePhase = false;

  for (let tick = 0; tick < PHYSICS_HZ * 12; tick += 1) {
    step();
    const phase = scene.getMachineAudioState?.().playPhase;
    if (phase && phase !== "READY") {
      sawActivePhase = true;
    }
    maxBeamY = Math.max(
      maxBeamY,
      beamTarget.body.translation().y,
    );
    if (sawActivePhase && phase === "READY") {
      completedCycle = true;
      break;
    }
  }

  for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
    step();
  }

  const finalPosition = beamTarget.body.translation();
  const finalRotation = beamTarget.body.rotation();

  return {
    targetX,
    targetZ,
    baselineX: baselinePosition.x,
    baselineY: baselinePosition.y,
    baselineZ: baselinePosition.z,
    finalX: finalPosition.x,
    finalY: finalPosition.y,
    finalZ: finalPosition.z,
    horizontalTravelMeters: Math.hypot(
      finalPosition.x - baselinePosition.x,
      finalPosition.z - baselinePosition.z,
    ),
    rotationTravelRadians: angularDistance(
      baselineRotation,
      finalRotation,
    ),
    maxLiftMeters: maxBeamY - baselinePosition.y,
    completedCycle,
  };
}

describe("M09 bridge production-claw manipulation", () => {
  it("diagnoses reachable off-center production-claw approaches", async () => {
    const approaches = [
      { x: 0.10, z: -0.02 },
      { x: -0.10, z: -0.02 },
      { x: 0.06, z: 0.07 },
      { x: -0.06, z: 0.07 },
    ];

    const results = [];
    for (const approach of approaches) {
      results.push(
        await simulateOneProductionPlay(
          approach.x,
          approach.z,
        ),
      );
    }

    console.log(
      "M09 bridge production-claw approach sweep",
      JSON.stringify(results),
    );

    expect(results.every((result) => result.completedCycle)).toBe(
      true,
    );
  }, 45_000);
});
