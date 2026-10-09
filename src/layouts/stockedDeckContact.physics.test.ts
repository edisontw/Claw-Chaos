import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createCabinetPhysics, M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";
import {
  CABINET_CLAW_PARK_POSITION,
  CABINET_GANTRY_TRAVEL_BOUNDS,
  CABINET_STOCKED_GRIP_TUNING,
  CABINET_STOCKED_REEL_MAX_SPEED_METERS_PER_SECOND,
  CABINET_STOCKED_APPROACH_REEL_SPEED_METERS_PER_SECOND,
  CABINET_STOCKED_APPROACH_DISTANCE_METERS,
} from "../cabinet/cabinetPlayTuning";
import { FIXED_TIMESTEP_SECONDS, PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createFingerPoints } from "../scenes/clawLab";
import { createGantryLabScene } from "../scenes/gantryLab";

describe("stocked physical deck bottom / visual alignment", () => {
  it("descends briskly and really reaches the deck with coincident visible and physical claw tips", async () => {
    const physics = await PhysicsRuntime.create();
    const cabinet = createCabinetPhysics(physics);
    expect(cabinet.playDeckBodies).toHaveLength(4);
    // Initialize Rapier's node/WASM runtime before stubbing a DOM window.
    // A fake browser global before the first native step can crash Rapier.
    for (let tick = 0; tick < 2; tick += 1) {
      physics.step();
    }

    // Match the real stocked cabinet configuration; no prize should stop
    // descent before the finger physically touches a play-deck collider.
    vi.stubGlobal("window", new EventTarget());
    const scene = new THREE.Scene();
    const gantry = createGantryLabScene(scene, physics, {
      addLabFloor: false,
      initialPosition: { x: 0, z: 0 },
      playReturnTarget: CABINET_CLAW_PARK_POSITION,
      travelBounds: CABINET_GANTRY_TRAVEL_BOUNDS,
      verticalHomeOffset: CABINET_STOCKED_GRIP_TUNING.verticalHomeOffsetMeters,
      additionalPickupDropMeters: CABINET_STOCKED_GRIP_TUNING.additionalPickupDropMeters,
      reelMaxSpeedMetersPerSecond: CABINET_STOCKED_REEL_MAX_SPEED_METERS_PER_SECOND,
      reelApproachMaxSpeedMetersPerSecond: CABINET_STOCKED_APPROACH_REEL_SPEED_METERS_PER_SECOND,
      reelApproachDistanceMeters: CABINET_STOCKED_APPROACH_DISTANCE_METERS,
      descentFloorBodies: () => cabinet.playDeckBodies,
      clawContinuousCollision: true,
      gripProfile: {
        fingerFriction: CABINET_STOCKED_GRIP_TUNING.fingerFriction,
        fingerRodFriction: CABINET_STOCKED_GRIP_TUNING.fingerRodFriction,
        fingerDensity: CABINET_STOCKED_GRIP_TUNING.fingerDensity,
        fingerAngularDamping: CABINET_STOCKED_GRIP_TUNING.fingerAngularDamping,
        descentOpenStiffness: CABINET_STOCKED_GRIP_TUNING.descentOpenStiffness,
        descentOpenDamping: CABINET_STOCKED_GRIP_TUNING.descentOpenDamping,
        descentOpenMaxTorque: CABINET_STOCKED_GRIP_TUNING.descentOpenMaxTorque,
        descentPrizeContactStiffness: CABINET_STOCKED_GRIP_TUNING.descentPrizeContactStiffness,
        descentPrizeContactDamping: CABINET_STOCKED_GRIP_TUNING.descentPrizeContactDamping,
        descentPrizeContactMaxTorque: CABINET_STOCKED_GRIP_TUNING.descentPrizeContactMaxTorque,
        bottomCloseSettleSeconds: CABINET_STOCKED_GRIP_TUNING.bottomCloseSettleSeconds,
        closeRampSeconds: CABINET_STOCKED_GRIP_TUNING.closeRampSeconds,
        closeRampStartTorque: CABINET_STOCKED_GRIP_TUNING.closeRampStartTorque,
        closeMotorDamping: CABINET_STOCKED_GRIP_TUNING.closeMotorDamping,
        closePickupTorque: CABINET_STOCKED_GRIP_TUNING.closePickupTorque,
        retainingTorque: CABINET_STOCKED_GRIP_TUNING.retainingTorque,
        holdBoostTorque: CABINET_STOCKED_GRIP_TUNING.holdBoostTorque,
        pickupLiftDistanceMeters: CABINET_STOCKED_GRIP_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians: CABINET_STOCKED_GRIP_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters: CABINET_STOCKED_GRIP_TUNING.fingerLowerPadRadiusMeters,
        fingerLowerPadLengthMeters: CABINET_STOCKED_GRIP_TUNING.fingerLowerPadLengthMeters,
      },
    });

    const moving = gantry.bindings.filter((binding) => binding.body.isDynamic());
    expect(moving).toHaveLength(4);
    const hub = moving[0]!.body;
    const fingers = moving.slice(1);
    const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      gantry.beforePhysicsStep?.(FIXED_TIMESTEP_SECONDS);
      physics.step();
    }
    expect(gantry.primaryAction?.()).toBe(true);

    let reachedDeck = false;
    let sawClosing = false;
    let maxSpeed = 0;
    let deepestTip = Number.POSITIVE_INFINITY;
    let maxVisualTipError = 0;
    let firstCloseAfterSeconds = Number.NaN;

    for (let tick = 0; tick < PHYSICS_HZ * 5; tick += 1) {
      gantry.beforePhysicsStep?.(FIXED_TIMESTEP_SECONDS);
      physics.step();
      const audio = gantry.getMachineAudioState?.();
      if (audio?.playPhase === "DESCENDING") {
        maxSpeed = Math.max(maxSpeed, Math.abs(audio.reelSpeedMetersPerSecond));
      }
      reachedDeck ||= cabinet.playDeckBodies.some((deck) =>
        fingers.some(({ body }) => physics.countBodyContactPairs(body, deck) > 0),
      );
      for (const [index, { body, mesh }] of fingers.entries()) {
        const position = body.translation();
        const rotation = body.rotation();
        mesh.position.set(position.x, position.y, position.z);
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        mesh.updateMatrixWorld(true);
        const tip = createFingerPoints(angles[index]!).at(-1)!;
        const localTip = new THREE.Vector3(tip.x, tip.y, tip.z);
        const actual = localTip.clone()
          .applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
          .add(new THREE.Vector3(position.x, position.y, position.z));
        const rendered = mesh.localToWorld(localTip);
        maxVisualTipError = Math.max(maxVisualTipError, actual.distanceTo(rendered));
        deepestTip = Math.min(deepestTip, actual.y);
      }
      if (audio?.playPhase === "CLOSING") {
        sawClosing = true;
        firstCloseAfterSeconds = (tick + 1) / PHYSICS_HZ;
        break;
      }
    }

    console.log("stocked true-deck-contact metrics", JSON.stringify({
      reachedDeck, sawClosing, maxSpeed, deepestTip, maxVisualTipError,
      firstCloseAfterSeconds, hubHeight: hub.translation().y,
    }));
    expect(reachedDeck).toBe(true);
    expect(sawClosing).toBe(true);
    expect(maxSpeed).toBeGreaterThan(0.22);
    expect(firstCloseAfterSeconds).toBeLessThan(3.0);
    expect(deepestTip).toBeLessThan(M06_CABINET_CONFIG.playDeckY + 0.030);
    expect(deepestTip).toBeGreaterThan(M06_CABINET_CONFIG.playDeckY - 0.055);
    expect(maxVisualTipError).toBeLessThan(1e-5);
    vi.unstubAllGlobals();
  }, 20_000);
});
