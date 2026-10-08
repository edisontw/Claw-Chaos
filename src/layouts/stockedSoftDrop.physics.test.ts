import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createCabinetPhysics,
  M06_CABINET_CONFIG,
} from "../cabinet/cabinetGeometry";
import {
  CABINET_CLAW_PARK_POSITION,
  CABINET_GANTRY_TRAVEL_BOUNDS,
  CABINET_STOCKED_GRIP_TUNING,
  CABINET_STOCKED_REEL_MAX_SPEED_METERS_PER_SECOND,
} from "../cabinet/cabinetPlayTuning";
import { cabinetPrizeDefinition } from "../cabinet/cabinetPrizeSizing";
import {
  FIXED_TIMESTEP_SECONDS,
  PHYSICS_HZ,
} from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createPrize } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";
import { createFingerPoints } from "../scenes/clawLab";
import { createGantryLabScene } from "../scenes/gantryLab";

describe("stocked claw descent contact", () => {
  it("lands softly on a real prize and stops the reel without bottom chatter", async () => {
    const physics = await PhysicsRuntime.create();
    createCabinetPhysics(physics);

    const definition = cabinetPrizeDefinition(
      getPrizeDefinition("prize/box_standard"),
      "stocked",
    );
    const prize = createPrize(physics, definition, {
      position: {
        // Put the prize under the +X open finger path, not in the empty
        // center of the three-prong footprint.
        x: 0.14,
        y:
          M06_CABINET_CONFIG.playDeckY +
          definition.dimensions.y * 0.5,
        z: 0,
      },
      variantSeed: "soft-drop-regression",
    });

    for (let tick = 0; tick < PHYSICS_HZ * 2; tick += 1) {
      physics.step();
    }

    const baseline = prize.body.translation();
    // Stub browser input only after Rapier WASM has initialized; otherwise
    // its environment detection can switch execution modes under Node.
    vi.stubGlobal("window", new EventTarget());
    const scene = new THREE.Scene();
    const gantry = createGantryLabScene(scene, physics, {
      addLabFloor: false,
      initialPosition: { x: 0, z: 0 },
      playReturnTarget: CABINET_CLAW_PARK_POSITION,
      travelBounds: CABINET_GANTRY_TRAVEL_BOUNDS,
      verticalHomeOffset:
        CABINET_STOCKED_GRIP_TUNING.verticalHomeOffsetMeters,
      additionalPickupDropMeters:
        CABINET_STOCKED_GRIP_TUNING.additionalPickupDropMeters,
      reelMaxSpeedMetersPerSecond:
        CABINET_STOCKED_REEL_MAX_SPEED_METERS_PER_SECOND,
      clawContinuousCollision: true,
      gripProfile: {
        fingerFriction: CABINET_STOCKED_GRIP_TUNING.fingerFriction,
        fingerDensity: CABINET_STOCKED_GRIP_TUNING.fingerDensity,
        fingerAngularDamping:
          CABINET_STOCKED_GRIP_TUNING.fingerAngularDamping,
        fingerMotorSpeedRadiansPerSecond:
          CABINET_STOCKED_GRIP_TUNING.fingerMotorSpeedRadiansPerSecond,
        descentOpenStiffness:
          CABINET_STOCKED_GRIP_TUNING.descentOpenStiffness,
        descentOpenDamping:
          CABINET_STOCKED_GRIP_TUNING.descentOpenDamping,
        descentOpenMaxTorque:
          CABINET_STOCKED_GRIP_TUNING.descentOpenMaxTorque,
        closePickupTorque:
          CABINET_STOCKED_GRIP_TUNING.closePickupTorque,
        retainingTorque:
          CABINET_STOCKED_GRIP_TUNING.retainingTorque,
        holdBoostTorque:
          CABINET_STOCKED_GRIP_TUNING.holdBoostTorque,
        pickupLiftDistanceMeters:
          CABINET_STOCKED_GRIP_TUNING.pickupLiftDistanceMeters,
        closedAngleRadians:
          CABINET_STOCKED_GRIP_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters:
          CABINET_STOCKED_GRIP_TUNING.fingerLowerPadRadiusMeters,
        fingerLowerPadLengthMeters:
          CABINET_STOCKED_GRIP_TUNING.fingerLowerPadLengthMeters,
      },
    });

    const hub =
      gantry.massPropertiesDebugTargets?.find(
        (entry) => entry.label === "suspended-claw-hub",
      )?.body;
    expect(hub).toBeDefined();

    const dynamicGantryBodies = gantry.bindings
      .map((binding) => binding.body)
      .filter((body) => body.isDynamic());
    const fingers = dynamicGantryBodies.filter((body) => body !== hub);
    expect(fingers).toHaveLength(3);

    const fingerMasses = fingers.map((body) => body.mass());
    for (const mass of fingerMasses) {
      expect(mass).toBeGreaterThan(0.045);
      expect(mass).toBeLessThan(0.075);
    }

    expect(gantry.primaryAction?.()).toBe(true);

    let maxPlanarPrizeSpeed = 0;
    let maxPlanarPrizeSpeedPhase = "";
    let maxPlanarPrizeDisplacement = 0;
    let maxDescentReelSpeed = 0;
    let closingObserved = false;
    let reelSpeedAtClosing = Number.NaN;
    let closedDepthStartTick = -1;
    let minHubY = Number.POSITIVE_INFINITY;
    let maxHubY = Number.NEGATIVE_INFINITY;
    let maxSettledFingerAngularSpeed = 0;
    const fingerTipBounds = fingers.map(() => ({
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    }));
    const fingerThetas = [0, 2 * Math.PI / 3, 4 * Math.PI / 3];

    for (let tick = 0; tick < PHYSICS_HZ * 4; tick += 1) {
      const before = gantry.getMachineAudioState?.();
      gantry.beforePhysicsStep?.(FIXED_TIMESTEP_SECONDS);
      physics.step();
      gantry.afterPhysicsStep?.(FIXED_TIMESTEP_SECONDS);
      const state = gantry.getMachineAudioState?.();

      if (state?.playPhase === "DESCENDING") {
        maxDescentReelSpeed = Math.max(
          maxDescentReelSpeed,
          Math.abs(state.reelSpeedMetersPerSecond),
        );
      }

      if (
        state?.playPhase === "DESCENDING" ||
        state?.playPhase === "CLOSING" ||
        state?.playPhase === "CLOSED_AT_DEPTH"
      ) {
        const velocity = prize.body.linvel();
        const planarSpeed = Math.hypot(velocity.x, velocity.z);
        if (planarSpeed > maxPlanarPrizeSpeed) {
          maxPlanarPrizeSpeed = planarSpeed;
          maxPlanarPrizeSpeedPhase = state.playPhase;
        }
        const position = prize.body.translation();
        maxPlanarPrizeDisplacement = Math.max(
          maxPlanarPrizeDisplacement,
          Math.hypot(
            position.x - baseline.x,
            position.z - baseline.z,
          ),
        );
      }

      if (
        !closingObserved &&
        before?.playPhase === "DESCENDING" &&
        state?.playPhase === "CLOSING"
      ) {
        closingObserved = true;
        reelSpeedAtClosing = Math.abs(
          state.reelSpeedMetersPerSecond,
        );
      }
      if (
        closedDepthStartTick < 0 &&
        state?.playPhase === "CLOSED_AT_DEPTH"
      ) {
        closedDepthStartTick = tick;
      }

      if (
        closedDepthStartTick >= 0 &&
        tick - closedDepthStartTick >= Math.floor(PHYSICS_HZ * 0.20) &&
        state?.playPhase === "CLOSED_AT_DEPTH"
      ) {
        const hubY = hub!.translation().y;
        minHubY = Math.min(minHubY, hubY);
        maxHubY = Math.max(maxHubY, hubY);
        for (let index = 0; index < fingers.length; index += 1) {
          const finger = fingers[index]!;
          const angular = finger.angvel();
          maxSettledFingerAngularSpeed = Math.max(
            maxSettledFingerAngularSpeed,
            Math.hypot(angular.x, angular.y, angular.z),
          );
          const localTip = createFingerPoints(fingerThetas[index]!).at(-1)!;
          const p = finger.translation();
          const q = finger.rotation();
          const worldTip = new THREE.Vector3(
            localTip.x,
            localTip.y,
            localTip.z,
          )
            .applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w))
            .add(new THREE.Vector3(p.x, p.y, p.z));
          const bounds = fingerTipBounds[index]!;
          bounds.minX = Math.min(bounds.minX, worldTip.x);
          bounds.maxX = Math.max(bounds.maxX, worldTip.x);
          bounds.minY = Math.min(bounds.minY, worldTip.y);
          bounds.maxY = Math.max(bounds.maxY, worldTip.y);
          bounds.minZ = Math.min(bounds.minZ, worldTip.z);
          bounds.maxZ = Math.max(bounds.maxZ, worldTip.z);
        }
      }

      if (state?.playPhase === "PICKUP") {
        break;
      }
    }

    const hubVerticalRange =
      Number.isFinite(minHubY) && Number.isFinite(maxHubY)
        ? maxHubY - minHubY
        : Number.NaN;
    const maxSettledFingerTipTravel = Math.max(
      ...fingerTipBounds.map((bounds) =>
        Math.hypot(
          bounds.maxX - bounds.minX,
          bounds.maxY - bounds.minY,
          bounds.maxZ - bounds.minZ,
        ),
      ),
    );

    console.log(
      "stocked soft-drop metrics",
      JSON.stringify({
        fingerMasses,
        maxDescentReelSpeed,
        maxPlanarPrizeSpeed,
        maxPlanarPrizeSpeedPhase,
        maxPlanarPrizeDisplacement,
        closingObserved,
        reelSpeedAtClosing,
        hubVerticalRange,
        maxSettledFingerAngularSpeed,
        maxSettledFingerTipTravel,
      }),
    );

    expect(closingObserved).toBe(true);
    expect(maxDescentReelSpeed).toBeLessThanOrEqual(
      CABINET_STOCKED_REEL_MAX_SPEED_METERS_PER_SECOND + 0.002,
    );
    expect(reelSpeedAtClosing).toBeLessThan(1e-6);
    expect(maxPlanarPrizeSpeed).toBeLessThan(0.75);
    expect(maxPlanarPrizeDisplacement).toBeLessThan(0.10);
    expect(hubVerticalRange).toBeLessThan(0.015);
    // Judge visible post-close chatter by actual fingertip travel, not
    // intentional angular speed while the motor is still closing.
    expect(maxSettledFingerTipTravel).toBeLessThan(0.012);
    vi.unstubAllGlobals();
  }, 20_000);
});
